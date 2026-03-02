/**
 * Fleet Sentinel — autonomous fleet monitoring cron endpoint.
 *
 * Replaces n8n Phase 4.2-4.4 with a native Next.js API route.
 * Trigger every 15 minutes via any external cron service:
 *   - cron-job.org, Railway cron, Cloud Run scheduler, GitHub Actions, Vercel Cron
 *
 * GET  /api/cron/sentinel              → run sentinel check
 * POST /api/cron/sentinel              → run sentinel check (with optional JSON body)
 *
 * Security: Set CRON_SECRET in .env.local and pass it as ?secret=<value> or
 *           Authorization: Bearer <value> header to protect the endpoint.
 */

import { NextRequest, NextResponse } from "next/server";
import { getFleetStatus } from "@/lib/tools/fleet-status";
import { getDriverSafety } from "@/lib/tools/driver-safety";
import { getMaintenanceAlerts } from "@/lib/tools/maintenance-alerts";
import { getFuelAnalysis } from "@/lib/tools/fuel-analysis";
import { sendSlackAlert } from "@/lib/slack";
import { google } from "@ai-sdk/google";
import { generateText } from "ai";

// ─── Threshold configuration ────────────────────────────────────────────────
const THRESHOLDS = {
  offlinePct: 30,            // Alert if >30% of fleet is offline
  harshBrakingPerDriver: 3,  // Alert if any driver has >3 harsh-braking events (week)
  criticalMaintenance: 1,    // Alert if any CRITICAL maintenance items exist
  idlingAnomalies: 2,        // Alert if >2 vehicles have excessive idling
};

// ─── Auth guard ─────────────────────────────────────────────────────────────
function isAuthorized(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true; // No secret configured → allow (dev mode)

  // Vercel Cron sends this header automatically
  const vercelHeader = req.headers.get("x-vercel-cron");
  if (vercelHeader && cronSecret) {
    // Vercel sets CRON_SECRET env and validates internally
    return true;
  }

  const querySecret = req.nextUrl.searchParams.get("secret");
  if (querySecret === cronSecret) return true;

  const authHeader = req.headers.get("authorization");
  if (authHeader === `Bearer ${cronSecret}`) return true;

  return false;
}

// ─── Alert evaluation ───────────────────────────────────────────────────────
interface SentinelAlert {
  severity: "critical" | "warning" | "info";
  category: string;
  detail: string;
}

function evaluateThresholds(
  fleet: Awaited<ReturnType<typeof getFleetStatus>>,
  safety: Awaited<ReturnType<typeof getDriverSafety>>,
  maintenance: Awaited<ReturnType<typeof getMaintenanceAlerts>>,
  fuel: Awaited<ReturnType<typeof getFuelAnalysis>>
): SentinelAlert[] {
  const alerts: SentinelAlert[] = [];

  // 1. Offline vehicles
  const offlinePct = fleet.total > 0 ? (fleet.offline / fleet.total) * 100 : 0;
  if (offlinePct > THRESHOLDS.offlinePct) {
    alerts.push({
      severity: "critical",
      category: "Connectivity",
      detail: `${fleet.offline}/${fleet.total} vehicles offline (${Math.round(offlinePct)}%) — exceeds ${THRESHOLDS.offlinePct}% threshold`,
    });
  } else if (fleet.offline > 0) {
    alerts.push({
      severity: "info",
      category: "Connectivity",
      detail: `${fleet.offline} vehicle${fleet.offline > 1 ? "s" : ""} offline (${Math.round(offlinePct)}%)`,
    });
  }

  // 2. Harsh braking clusters
  const riskDrivers = safety.drivers.filter((d) => d.harshBraking > THRESHOLDS.harshBrakingPerDriver);
  if (riskDrivers.length > 0) {
    alerts.push({
      severity: "warning",
      category: "Safety",
      detail: `${riskDrivers.length} driver${riskDrivers.length > 1 ? "s" : ""} with >${THRESHOLDS.harshBrakingPerDriver} harsh-braking events: ${riskDrivers.map((d) => `${d.driverName} (${d.harshBraking})`).join(", ")}`,
    });
  }

  // 3. Overdue maintenance
  if (maintenance.critical >= THRESHOLDS.criticalMaintenance) {
    const critItems = maintenance.alerts.filter((a) => a.urgency === "CRITICAL").slice(0, 3);
    alerts.push({
      severity: "critical",
      category: "Maintenance",
      detail: `${maintenance.critical} CRITICAL maintenance item${maintenance.critical > 1 ? "s" : ""}: ${critItems.map((a) => `${a.vehicleName} — ${a.type}`).join("; ")}`,
    });
  }
  if (maintenance.due > 0) {
    alerts.push({
      severity: "warning",
      category: "Maintenance",
      detail: `${maintenance.due} vehicle${maintenance.due > 1 ? "s" : ""} with maintenance DUE soon`,
    });
  }

  // 4. Excessive idling
  if (fuel.anomalyCount > THRESHOLDS.idlingAnomalies) {
    const topWasters = fuel.anomalies.slice(0, 3);
    alerts.push({
      severity: "warning",
      category: "Fuel Waste",
      detail: `${fuel.anomalyCount} vehicles with excessive idle time — top offenders: ${topWasters.map((a) => `${a.vehicleName} (${a.idleHours.toFixed(1)}h)`).join(", ")}. Est. waste: $${fuel.totalEstimatedWaste.toFixed(0)}`,
    });
  }

  return alerts;
}

// ─── AI narrative generation ────────────────────────────────────────────────
async function generateAlertNarrative(alerts: SentinelAlert[]): Promise<string> {
  if (alerts.length === 0) return "All clear — no threshold breaches detected this cycle.";

  const alertSummary = alerts
    .map((a, i) => `${i + 1}. [${a.severity.toUpperCase()}] ${a.category}: ${a.detail}`)
    .join("\n");

  try {
    const { text } = await generateText({
      model: google("gemini-2.0-flash"),
      system:
        "You are FleetMind Sentinel, an autonomous fleet monitoring AI. " +
        "Write a concise, actionable alert summary for a fleet manager. " +
        "Use specific vehicle names and numbers from the data. " +
        "Keep it under 200 words. Start with the most urgent issue. " +
        "End with a recommended action.",
      prompt: `Fleet Sentinel detected the following issues:\n\n${alertSummary}\n\nWrite a brief, actionable alert narrative for the fleet manager.`,
    });
    return text;
  } catch (err) {
    console.error("[Sentinel] AI narrative generation failed:", err);
    return `Fleet Sentinel Alert — ${alerts.length} issue(s) detected:\n\n${alertSummary}`;
  }
}

// ─── Route handlers ─────────────────────────────────────────────────────────
async function runSentinel(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startTime = Date.now();

  try {
    // 1. Fetch all fleet data in parallel
    const [fleet, safety, maintenance, fuel] = await Promise.all([
      getFleetStatus(),
      getDriverSafety("week"),
      getMaintenanceAlerts(),
      getFuelAnalysis("week"),
    ]);

    // 2. Evaluate thresholds
    const alerts = evaluateThresholds(fleet, safety, maintenance, fuel);
    const hasCritical = alerts.some((a) => a.severity === "critical");
    const hasWarning = alerts.some((a) => a.severity === "warning");

    // 3. Generate AI narrative
    const narrative = await generateAlertNarrative(alerts);

    // 4. Send Slack notification (only if warnings or critical)
    let slackResult: { sent: boolean; error?: string } = { sent: false, error: "No alerts to send" };
    if (hasCritical || hasWarning) {
      slackResult = await sendSlackAlert({
        title: hasCritical ? "Fleet Sentinel — CRITICAL Alert" : "Fleet Sentinel — Warning",
        severity: hasCritical ? "critical" : "warning",
        summary: narrative,
        fields: [
          { label: "Fleet Status", value: `${fleet.active} active / ${fleet.stopped} stopped / ${fleet.offline} offline` },
          { label: "Safety Events", value: `${safety.drivers.reduce((s, d) => s + d.totalEvents, 0)} total (${safety.totalDrivers} drivers)` },
          { label: "Maintenance", value: `${maintenance.critical} critical / ${maintenance.due} due / ${maintenance.upcoming} upcoming` },
          { label: "Fuel Waste", value: `$${fuel.totalEstimatedWaste.toFixed(0)} est. idle waste` },
        ],
      });
    }

    const elapsed = Date.now() - startTime;

    return NextResponse.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      elapsed_ms: elapsed,
      alerts_count: alerts.length,
      severity: hasCritical ? "critical" : hasWarning ? "warning" : "clear",
      alerts,
      narrative,
      fleet_summary: {
        active: fleet.active,
        stopped: fleet.stopped,
        idling: fleet.idling,
        offline: fleet.offline,
        total: fleet.total,
      },
      slack: slackResult,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[Sentinel] Error:", message);
    return NextResponse.json({ status: "error", error: message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return runSentinel(req);
}

export async function POST(req: NextRequest) {
  return runSentinel(req);
}
