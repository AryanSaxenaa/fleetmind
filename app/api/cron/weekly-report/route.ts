/**
 * Weekly Fleet Report — scheduled report generation endpoint.
 *
 * Replaces n8n Phase 5.3 with a native Next.js API route.
 * Trigger weekly (e.g. Sunday 8 AM) via any external cron:
 *   - cron-job.org, Railway cron, Cloud Run scheduler, GitHub Actions, Vercel Cron
 *
 * GET  /api/cron/weekly-report   → generate & return weekly report
 * POST /api/cron/weekly-report   → generate & optionally deliver via Slack
 *
 * Security: Same CRON_SECRET as sentinel endpoint.
 */

import { NextRequest, NextResponse } from "next/server";
import { getFleetStatus } from "@/lib/tools/fleet-status";
import { getDriverSafety } from "@/lib/tools/driver-safety";
import { getMaintenanceAlerts } from "@/lib/tools/maintenance-alerts";
import { getFuelAnalysis } from "@/lib/tools/fuel-analysis";
import { getMorningBriefing } from "@/lib/tools/morning-briefing";
import { sendSlackAlert } from "@/lib/slack";
import { google } from "@ai-sdk/google";
import { generateText } from "ai";

// ─── Auth guard ─────────────────────────────────────────────────────────────
function isAuthorized(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true;

  // Vercel Cron sends this header automatically
  const vercelHeader = req.headers.get("x-vercel-cron");
  if (vercelHeader && cronSecret) return true;

  const querySecret = req.nextUrl.searchParams.get("secret");
  if (querySecret === cronSecret) return true;

  const authHeader = req.headers.get("authorization");
  if (authHeader === `Bearer ${cronSecret}`) return true;

  return false;
}

// ─── Report generation ──────────────────────────────────────────────────────
async function generateWeeklyReport(): Promise<{
  reportMarkdown: string;
  data: {
    fleet: Awaited<ReturnType<typeof getFleetStatus>>;
    safety: Awaited<ReturnType<typeof getDriverSafety>>;
    maintenance: Awaited<ReturnType<typeof getMaintenanceAlerts>>;
    fuel: Awaited<ReturnType<typeof getFuelAnalysis>>;
    briefing: Awaited<ReturnType<typeof getMorningBriefing>>;
  };
}> {
  // Gather all fleet intelligence in parallel
  const [fleet, safety, maintenance, fuel, briefing] = await Promise.all([
    getFleetStatus(),
    getDriverSafety("week"),
    getMaintenanceAlerts(),
    getFuelAnalysis("week"),
    getMorningBriefing(),
  ]);

  // Build structured data prompt for Gemini
  const dataContext = `
FLEET STATUS:
- Total vehicles: ${fleet.total}
- Active: ${fleet.active}, Stopped: ${fleet.stopped}, Idling: ${fleet.idling}, Offline: ${fleet.offline}

SAFETY (7-day):
- ${safety.totalDrivers} drivers monitored, ${safety.drivers.reduce((s, d) => s + d.totalEvents, 0)} total events
- Bottom 3 drivers: ${safety.bottomThree.map((d) => `${d.driverName} (score: ${d.score}, events: ${d.totalEvents})`).join("; ")}

MAINTENANCE:
- ${maintenance.totalAlerts} total alerts: ${maintenance.critical} critical, ${maintenance.due} due, ${maintenance.upcoming} upcoming
- Critical items: ${maintenance.alerts.filter((a) => a.urgency === "CRITICAL").map((a) => `${a.vehicleName} — ${a.type}`).join("; ") || "None"}

FUEL & IDLING (7-day):
- Fleet avg idle: ${fuel.fleetAverageIdleHours.toFixed(1)}h
- ${fuel.anomalyCount} vehicles with excessive idling
- Est. total idle waste: $${fuel.totalEstimatedWaste.toFixed(0)}
- Top wasters: ${fuel.anomalies.slice(0, 3).map((a) => `${a.vehicleName} (${a.idleHours.toFixed(1)}h idle)`).join("; ")}

24H SNAPSHOT:
- ${briefing.tripCount24h} trips completed
- ${briefing.safety.totalExceptions24h} safety exceptions
- ${briefing.fuel.totalIdleHours}h total idle time ($${briefing.fuel.estimatedIdleCost.toFixed(0)} cost)
- ${briefing.faults.totalFaults} active faults across ${briefing.faults.vehiclesWithFaults} vehicles
`;

  let reportMarkdown: string;
  try {
    const { text } = await generateText({
      model: google("gemini-2.0-flash"),
      system:
        "You are FleetMind, an AI fleet management copilot. " +
        "Generate a professional weekly fleet report in Markdown format. " +
        "Include: Executive Summary, Fleet Operations, Safety Scorecard, " +
        "Maintenance Status, Fuel Efficiency, and Recommendations. " +
        "Use specific numbers and vehicle/driver names from the data. " +
        "Be concise but thorough. Use tables where appropriate. " +
        "The report should be suitable for a fleet manager's weekly review.",
      prompt: `Generate the weekly fleet report for the week ending ${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}.\n\nData:\n${dataContext}`,
    });
    reportMarkdown = text;
  } catch (err) {
    console.error("[WeeklyReport] AI generation failed:", err);
    reportMarkdown = `# Weekly Fleet Report\n\n_Generated ${new Date().toISOString()}_\n\n${dataContext}`;
  }

  return {
    reportMarkdown,
    data: { fleet, safety, maintenance, fuel, briefing },
  };
}

// ─── Route handlers ─────────────────────────────────────────────────────────
async function runWeeklyReport(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startTime = Date.now();

  try {
    const { reportMarkdown, data } = await generateWeeklyReport();

    // Send to Slack if configured
    const slackResult = await sendSlackAlert({
      title: "📊 FleetMind Weekly Report",
      severity: "info",
      summary: reportMarkdown.slice(0, 2900), // Slack block limit ~3000 chars
      fields: [
        { label: "Fleet Size", value: `${data.fleet.total} vehicles` },
        { label: "Safety Score", value: `${data.safety.drivers.length > 0 ? Math.round(data.safety.drivers.reduce((s, d) => s + d.score, 0) / data.safety.drivers.length) : "N/A"}/100 avg` },
        { label: "Maintenance", value: `${data.maintenance.critical} critical, ${data.maintenance.due} due` },
        { label: "Fuel Waste", value: `$${data.fuel.totalEstimatedWaste.toFixed(0)} est. idle loss` },
      ],
      footer: `FleetMind Weekly Report • ${new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", year: "numeric" })}`,
    });

    const elapsed = Date.now() - startTime;

    return NextResponse.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      elapsed_ms: elapsed,
      report: reportMarkdown,
      summary: {
        fleet_total: data.fleet.total,
        fleet_active: data.fleet.active,
        fleet_offline: data.fleet.offline,
        safety_events: data.safety.drivers.reduce((s, d) => s + d.totalEvents, 0),
        maintenance_critical: data.maintenance.critical,
        fuel_waste_usd: +data.fuel.totalEstimatedWaste.toFixed(0),
        trips_24h: data.briefing.tripCount24h,
      },
      slack: slackResult,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[WeeklyReport] Error:", message);
    return NextResponse.json({ status: "error", error: message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return runWeeklyReport(req);
}

export async function POST(req: NextRequest) {
  return runWeeklyReport(req);
}
