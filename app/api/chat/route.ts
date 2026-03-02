import { streamText, tool } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";
import { getFleetStatus } from "@/lib/tools/fleet-status";
import { getDriverSafety } from "@/lib/tools/driver-safety";
import { getFuelAnalysis } from "@/lib/tools/fuel-analysis";
import { getMaintenanceAlerts } from "@/lib/tools/maintenance-alerts";
import { getMorningBriefing } from "@/lib/tools/morning-briefing";
import { getDriverDNA } from "@/lib/tools/driver-dna";
import { getRecentGPSTraces } from "@/lib/tools/gps-traces";
import { createGeofenceCircle, deleteGeofence, listGeofences } from "@/lib/tools/geofence";
import { getDVIRSummary } from "@/lib/tools/dvir";
import { getAceInsight } from "@/lib/tools/ace-analytics";

const FLEET_SYSTEM_PROMPT = `You are FleetMind, an AI fleet management copilot built for the Geotab ecosystem.

PERSONALITY:
- Professional but approachable — like a senior fleet analyst who genuinely cares about driver wellbeing
- Always specific — reference real vehicle IDs (e.g. "Demo - 03"), driver names, dollar amounts
- Always actionable — every insight ends with a concrete, numbered recommendation
- Concise — no filler text, no "I'd be happy to help", no "Certainly!"

RESPONSE FORMAT:
- Use emojis purposefully for urgency: 🚨 critical, ⚠️ warning, ✅ good, 📊 data
- **Bold** vehicle IDs and driver names on first mention
- Include dollar estimates for fuel waste and maintenance costs
- Use line breaks and short paragraphs for readability
- For morning briefings: start with "Good morning" + date, end with exactly 3 prioritized action items labeled 1/2/3
- For driver safety: present as a ranked table with scores, highlight bottom 3 with coaching notes
- For fuel analysis: lead with total waste $, then rank anomalies
- For maintenance: group by urgency (CRITICAL first), include km/miles remaining
- For Driver DNA: present each driver's archetype with their radar scores and coaching tip

TOOL SELECTION:
- "how many vehicles" / "fleet status" → fleet_status
- "worst drivers" / "safety" / "harsh braking" → driver_safety  
- "fuel waste" / "idle" / "consumption" → fuel_analysis
- "maintenance" / "overdue" / "service" → maintenance_alerts
- "morning briefing" / "daily update" / "executive summary" → morning_briefing
- "Driver DNA" / "driver profile" / "personality" / "radar" → driver_dna

RULES:
- Never fabricate data — only use what tools return
- If a tool returns empty data, say "No data available for this period" and suggest checking credentials
- If asked about something outside fleet management, politely redirect
- When presenting morning briefing data, synthesize it into a narrative executive briefing
- For Driver DNA, generate creative archetype descriptions that feel like Spotify Wrapped for drivers
- Always provide coaching that is encouraging, not punitive`;

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: google("gemini-2.0-flash"),
    system: FLEET_SYSTEM_PROMPT,
    messages,
    tools: {
      fleet_status: tool({
        description:
          "Get current fleet status: active, stopped, idling, offline vehicle counts",
        parameters: z.object({}),
        execute: async () => {
          try {
            return await getFleetStatus();
          } catch (e: any) {
            console.error("[fleet_status] Tool error:", e);
            return { error: e.message };
          }
        },
      }),
      gps_traces: tool({
        description: "Get recent GPS breadcrumbs per vehicle for a live map or trip replay",
        parameters: z.object({
          hours: z
            .number()
            .optional()
            .describe("Hours to look back (default 6)"),
          maxPointsPerVehicle: z
            .number()
            .optional()
            .describe("Maximum breadcrumb points per vehicle (default 200)"),
        }),
        execute: async ({ hours, maxPointsPerVehicle }) => {
          try {
            return await getRecentGPSTraces(hours, maxPointsPerVehicle);
          } catch (e: any) {
            console.error("[gps_traces] Tool error:", e);
            return { error: e.message };
          }
        },
      }),
      geofence_manage: tool({
        description: "Create or delete geofences (zones). Actions: create/delete/list",
        parameters: z.object({
          action: z.enum(["create", "delete", "list"]),
          name: z.string().optional(),
          latitude: z.number().optional(),
          longitude: z.number().optional(),
          radiusMeters: z.number().optional(),
          zoneId: z.string().optional(),
        }),
        execute: async ({ action, name, latitude, longitude, radiusMeters, zoneId }) => {
          try {
            if (action === "create") {
              if (latitude === undefined || longitude === undefined || !name) {
                return { error: "name, latitude, and longitude are required to create a geofence" };
              }
              return await createGeofenceCircle({ name, latitude, longitude, radiusMeters });
            }
            if (action === "delete") {
              if (!zoneId) return { error: "zoneId is required to delete a geofence" };
              return await deleteGeofence(zoneId);
            }
            // list
            return await listGeofences(100);
          } catch (e: any) {
            console.error("[geofence_manage] Tool error:", e);
            return { error: e.message };
          }
        },
      }),
      dvir_summary: tool({
        description: "Fetch DVIR inspection summaries for compliance and defect tracking",
        parameters: z.object({
          periodDays: z
            .number()
            .optional()
            .describe("Days to look back (default 7)"),
        }),
        execute: async ({ periodDays }) => {
          try {
            return await getDVIRSummary(periodDays);
          } catch (e: any) {
            console.error("[dvir_summary] Tool error:", e);
            return { error: e.message };
          }
        },
      }),
      ace_query: tool({
        description: "Query Geotab Ace for natural language analytics via GetAceResults",
        parameters: z.object({
          prompt: z.string(),
        }),
        execute: async ({ prompt }) => {
          try {
            return await getAceInsight(prompt);
          } catch (e: any) {
            console.error("[ace_query] Tool error:", e);
            return { error: e.message };
          }
        },
      }),
      driver_safety: tool({
        description:
          "Get ranked driver safety data with event counts and coaching recommendations",
        parameters: z.object({
          period: z
            .enum(["week", "month"])
            .optional()
            .describe("Time period to analyze"),
        }),
        execute: async ({ period }) => {
          try {
            return await getDriverSafety(period || "week");
          } catch (e: any) {
            console.error("[driver_safety] Tool error:", e);
            return { error: e.message };
          }
        },
      }),
      fuel_analysis: tool({
        description:
          "Detect fuel waste anomalies: excessive idle time, fuel consumption outliers with dollar estimates",
        parameters: z.object({
          period: z
            .enum(["week", "month"])
            .optional()
            .describe("Time period to analyze"),
        }),
        execute: async ({ period }) => {
          try {
            return await getFuelAnalysis(period || "week");
          } catch (e: any) {
            console.error("[fuel_analysis] Tool error:", e);
            return { error: e.message };
          }
        },
      }),
      maintenance_alerts: tool({
        description:
          "Get prioritized vehicle maintenance queue with urgency labels: CRITICAL, DUE, UPCOMING",
        parameters: z.object({}),
        execute: async () => {
          try {
            return await getMaintenanceAlerts();
          } catch (e: any) {
            console.error("[maintenance_alerts] Tool error:", e);
            return { error: e.message };
          }
        },
      }),
      morning_briefing: tool({
        description:
          "Generate comprehensive morning fleet briefing data with safety, fuel, maintenance insights. Synthesize the returned data into a narrative with exactly 3 prioritized action items.",
        parameters: z.object({}),
        execute: async () => {
          try {
            return await getMorningBriefing();
          } catch (e: any) {
            console.error("[morning_briefing] Tool error:", e);
            return { error: e.message };
          }
        },
      }),
      driver_dna: tool({
        description:
          "Generate Driver DNA personality profiles with 5-dimension radar scores (safety, efficiency, consistency, responsiveness, endurance), creative archetypes like Spotify Wrapped, and coaching tips",
        parameters: z.object({
          top: z
            .number()
            .optional()
            .describe("Number of top drivers to profile (default 5)"),
        }),
        execute: async ({ top }) => {
          try {
            return await getDriverDNA(top || 5);
          } catch (e: any) {
            console.error("[driver_dna] Tool error:", e);
            return { error: e.message };
          }
        },
      }),
    },
    maxSteps: 5,
  });

  return result.toDataStreamResponse();
}
