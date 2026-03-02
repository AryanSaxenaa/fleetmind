import { geotabMultiCall, geotabGet, daysAgo } from "@/lib/geotab";

export interface MorningBriefingResult {
  date: string;
  fleet: {
    total: number;
    active: number;
    stopped: number;
    offline: number;
    operationalPct: number;
  };
  safety: {
    totalExceptions24h: number;
    worstVehicles: { vehicle: string; events: number }[];
  };
  fuel: {
    totalIdleHours: number;
    estimatedIdleCost: number;
  };
  faults: {
    vehiclesWithFaults: number;
    totalFaults: number;
  };
  tripCount24h: number;
}

export async function getMorningBriefing(): Promise<MorningBriefingResult> {
  const fromDate = daysAgo(1);

  const [devices, statuses, exceptions, trips] = await geotabMultiCall<any>([
    { method: "Get", params: { typeName: "Device", resultsLimit: 200 } },
    { method: "Get", params: { typeName: "DeviceStatusInfo", resultsLimit: 200 } },
    { method: "Get", params: { typeName: "ExceptionEvent", search: { fromDate: fromDate.toISOString() }, resultsLimit: 500 } },
    { method: "Get", params: { typeName: "Trip", search: { fromDate: fromDate.toISOString() }, resultsLimit: 500 } },
  ]);

  // FaultData may not be available in demo DB — gracefully fallback
  let faults: any[] = [];
  try {
    faults = await geotabGet("FaultData", { resultsLimit: 50, fromDate });
  } catch {
    // Demo DB doesn't support FaultData — ignore
  }

  const deviceNameMap = new Map<string, string>();
  for (const d of devices) deviceNameMap.set(d.id, d.name);

  // Fleet status summary
  const now = Date.now();
  let active = 0,
    stopped = 0,
    offline = 0;
  for (const s of statuses) {
    const age = now - new Date(s.dateTime).getTime();
    if (age > 30 * 60 * 1000) offline++;
    else if (s.isDriving) active++;
    else stopped++;
  }

  // Safety summary
  const safetyByDevice = new Map<string, number>();
  for (const e of exceptions) {
    const id = e.device?.id;
    if (id) safetyByDevice.set(id, (safetyByDevice.get(id) || 0) + 1);
  }
  const worstSafety = Array.from(safetyByDevice.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id, count]) => ({
      vehicle: deviceNameMap.get(id) || id,
      events: count,
    }));

  // Trip / idle summary
  let totalIdleMinutes = 0;
  for (const t of trips) {
    if (t.idlingDuration) {
      const parts = t.idlingDuration.split(":").map(Number);
      totalIdleMinutes += (parts[0] || 0) * 60 + (parts[1] || 0);
    }
  }
  const estIdleCost = (totalIdleMinutes / 60) * 3.5;

  // Faults summary
  const faultDevices = new Set(
    faults.map((f: any) => f.device?.id).filter(Boolean)
  );

  return {
    date: new Date().toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
    fleet: {
      total: devices.length,
      active,
      stopped,
      offline,
      operationalPct: Math.round(
        ((active + stopped) / (devices.length || 1)) * 100
      ),
    },
    safety: {
      totalExceptions24h: exceptions.length,
      worstVehicles: worstSafety,
    },
    fuel: {
      totalIdleHours: +(totalIdleMinutes / 60).toFixed(1),
      estimatedIdleCost: +estIdleCost.toFixed(2),
    },
    faults: {
      vehiclesWithFaults: faultDevices.size,
      totalFaults: faults.length,
    },
    tripCount24h: trips.length,
  };
}
