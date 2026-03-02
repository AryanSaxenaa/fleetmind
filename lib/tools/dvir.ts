import { geotabMultiCall, daysAgo } from "@/lib/geotab";

export interface DVIRLogSummary {
  id: string;
  vehicleId: string;
  vehicleName: string;
  driverName: string;
  hasDefects: boolean;
  defectsCount: number;
  isRepaired: boolean;
  dateTime: string;
}

export interface DVIRSummaryResult {
  periodDays: number;
  totalInspections: number;
  defectsOpen: number;
  criticalDefects: number;
  logs: DVIRLogSummary[];
}

export async function getDVIRSummary(periodDays: number = 7): Promise<DVIRSummaryResult> {
  const fromDate = daysAgo(periodDays);

  const [devices, drivers, dvirLogs] = await geotabMultiCall<any>([
    { method: "Get", params: { typeName: "Device", resultsLimit: 200 } },
    { method: "Get", params: { typeName: "User", search: { isDriver: true }, resultsLimit: 200 } },
    {
      method: "Get",
      params: {
        typeName: "DVIRLog",
        search: { fromDate: fromDate.toISOString() },
        resultsLimit: 500,
      },
    },
  ]);

  const deviceNameMap = new Map<string, string>();
  for (const d of devices) deviceNameMap.set(d.id, d.name);

  const driverNameMap = new Map<string, string>();
  for (const d of drivers) {
    const name = d.name || `${d.firstName || ""} ${d.lastName || ""}`.trim();
    driverNameMap.set(d.id, name || d.id);
  }

  const summaries: DVIRLogSummary[] = [];
  let defectsOpen = 0;
  let criticalDefects = 0;

  for (const log of dvirLogs) {
    const defects = Array.isArray(log.defects) ? log.defects : [];
    const hasDefects = defects.length > 0;
    const repaired = Boolean(log.isRepaired || log.defectsCorrected);

    if (hasDefects && !repaired) defectsOpen++;
    if (defects.some((d: any) => d.severity === "CRITICAL")) criticalDefects++;

    summaries.push({
      id: log.id,
      vehicleId: log.device?.id || "unknown",
      vehicleName: deviceNameMap.get(log.device?.id) || log.device?.id || "Unknown",
      driverName:
        log.driver?.id === "UnknownDriverId"
          ? "Unassigned"
          : driverNameMap.get(log.driver?.id) || log.driver?.id || "Unknown",
      hasDefects,
      defectsCount: defects.length,
      isRepaired: repaired,
      dateTime: log.dateTime,
    });
  }

  summaries.sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime());

  return {
    periodDays,
    totalInspections: summaries.length,
    defectsOpen,
    criticalDefects,
    logs: summaries.slice(0, 50),
  };
}
