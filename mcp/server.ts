import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { getFleetStatus } from "../lib/tools/fleet-status";
import { getDriverSafety } from "../lib/tools/driver-safety";
import { getFuelAnalysis } from "../lib/tools/fuel-analysis";
import { getMaintenanceAlerts } from "../lib/tools/maintenance-alerts";
import { getMorningBriefing } from "../lib/tools/morning-briefing";
import { getDriverDNA } from "../lib/tools/driver-dna";

const server = new McpServer({
  name: "fleetmind",
  version: "2.0.0",
});

// Helper: wrap tool result as MCP content
function ok(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}
function err(msg: string) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify({ error: msg }) }],
    isError: true as const,
  };
}

// fleet_status tool
server.tool(
  "fleet_status",
  "Get current fleet status: active, stopped, idling, offline vehicle counts",
  {},
  async () => {
    try {
      return ok(await getFleetStatus());
    } catch (e: any) {
      return err(e.message);
    }
  }
);

// driver_safety tool
server.tool(
  "driver_safety",
  "Get ranked driver safety data with event counts and coaching recommendations",
  { period: z.enum(["week", "month"]).optional().describe("Time period") },
  async ({ period }) => {
    try {
      return ok(await getDriverSafety(period || "week"));
    } catch (e: any) {
      return err(e.message);
    }
  }
);

// fuel_analysis tool
server.tool(
  "fuel_analysis",
  "Detect fuel waste anomalies with dollar estimates",
  { period: z.enum(["week", "month"]).optional().describe("Time period") },
  async ({ period }) => {
    try {
      return ok(await getFuelAnalysis(period || "week"));
    } catch (e: any) {
      return err(e.message);
    }
  }
);

// maintenance_alerts tool
server.tool(
  "maintenance_alerts",
  "Get prioritized vehicle maintenance queue with urgency labels",
  {},
  async () => {
    try {
      return ok(await getMaintenanceAlerts());
    } catch (e: any) {
      return err(e.message);
    }
  }
);

// morning_briefing tool
server.tool(
  "morning_briefing",
  "Generate comprehensive morning fleet briefing with 3 action items",
  {},
  async () => {
    try {
      return ok(await getMorningBriefing());
    } catch (e: any) {
      return err(e.message);
    }
  }
);

// driver_dna tool
server.tool(
  "driver_dna",
  "Generate Driver DNA personality profiles with radar scores and archetypes",
  { top: z.number().optional().describe("Number of top drivers to profile") },
  async ({ top }) => {
    try {
      return ok(await getDriverDNA(top || 5));
    } catch (e: any) {
      return err(e.message);
    }
  }
);

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("FleetMind MCP server started — 6 tools registered");
}

main().catch(console.error);
