import { geotabMultiCall, daysAgo } from "@/lib/geotab";

type Urgency = "CRITICAL" | "DUE" | "UPCOMING";

export interface MaintenanceAlert {
  vehicleId: string;
  vehicleName: string;
  urgency: Urgency;
  type: string;
  currentEngineHours: number;
  detail: string;
}

export interface MaintenanceResult {
  totalAlerts: number;
  critical: number;
  due: number;
  upcoming: number;
  alerts: MaintenanceAlert[];
}

// Engine-hour-based maintenance intervals (in hours)
const OIL_CHANGE_HOURS = 250;
const FILTER_REPLACEMENT_HOURS = 500;
const MAJOR_SERVICE_HOURS = 1000;

export async function getMaintenanceAlerts(): Promise<MaintenanceResult> {
  const fromDate = daysAgo(30);

  const [devices, trips, odometerReadings] = await geotabMultiCall<any>([
    { method: "Get", params: { typeName: "Device", resultsLimit: 200 } },
    { method: "Get", params: { typeName: "Trip", search: { fromDate: fromDate.toISOString() }, resultsLimit: 1000 } },
    {
      method: "Get",
      params: {
        typeName: "StatusData",
        search: { diagnosticSearch: { id: "DiagnosticOdometerId" }, fromDate: fromDate.toISOString() },
        resultsLimit: 2000,
      },
    },
  ]);

  const deviceNameMap = new Map<string, string>();
  for (const d of devices) deviceNameMap.set(d.id, d.name);

  // Aggregate engine hours per device from Trip data
  const deviceEngineHours = new Map<string, number>();
  for (const trip of trips) {
    const deviceId = trip.device?.id;
    if (!deviceId) continue;
    // engineHours from Trip is cumulative in seconds
    const hours = (trip.engineHours || 0) / 3600;
    // Keep the maximum (latest reading)
    const current = deviceEngineHours.get(deviceId) || 0;
    if (hours > current) {
      deviceEngineHours.set(deviceId, hours);
    }
  }

  // Aggregate odometer per device from StatusData (latest reading)
  const deviceOdometerKm = new Map<string, number>();
  for (const reading of odometerReadings) {
    const id = reading.device?.id;
    if (!id || typeof reading.data !== "number") continue;
    const km = reading.data / 1000; // meters → km
    const current = deviceOdometerKm.get(id) || 0;
    if (km > current) deviceOdometerKm.set(id, km);
  }

  const alerts: MaintenanceAlert[] = [];

  for (const [deviceId, hours] of deviceEngineHours) {
    const name = deviceNameMap.get(deviceId) || deviceId;
    checkHourInterval(alerts, deviceId, name, hours, OIL_CHANGE_HOURS, "Oil Change");
    checkHourInterval(alerts, deviceId, name, hours, FILTER_REPLACEMENT_HOURS, "Filter Replacement");
    checkHourInterval(alerts, deviceId, name, hours, MAJOR_SERVICE_HOURS, "Major Service");
  }

  // Add odometer-based reminders (km thresholds)
  const KM_INTERVALS = [
    { km: 10000, label: "Oil Change" },
    { km: 15000, label: "Tire Rotation" },
    { km: 25000, label: "Brake Inspection" },
    { km: 50000, label: "Major Service" },
  ];

  for (const [deviceId, km] of deviceOdometerKm) {
    const name = deviceNameMap.get(deviceId) || deviceId;
    for (const interval of KM_INTERVALS) {
      const since = km % interval.km;
      const remaining = interval.km - since;
      const pct = remaining / interval.km;

      let urgency: Urgency | null = null;
      if (pct < 0.1) urgency = "CRITICAL";
      else if (pct < 0.25) urgency = "DUE";
      else if (pct < 0.4) urgency = "UPCOMING";

      if (urgency) {
        alerts.push({
          vehicleId: deviceId,
          vehicleName: name,
          urgency,
          type: `${interval.label} (odometer)`,
          currentEngineHours: Math.round(deviceEngineHours.get(deviceId) || 0),
          detail: `${remaining.toFixed(0)} km until next ${interval.label} (${km.toFixed(0)} km total)`,
        });
      }
    }
  }

  // Sort: CRITICAL first, then DUE, then UPCOMING
  const order: Record<Urgency, number> = { CRITICAL: 0, DUE: 1, UPCOMING: 2 };
  alerts.sort((a, b) => order[a.urgency] - order[b.urgency]);

  return {
    totalAlerts: alerts.length,
    critical: alerts.filter((a) => a.urgency === "CRITICAL").length,
    due: alerts.filter((a) => a.urgency === "DUE").length,
    upcoming: alerts.filter((a) => a.urgency === "UPCOMING").length,
    alerts: alerts.slice(0, 20),
  };
}

function checkHourInterval(
  alerts: MaintenanceAlert[],
  vehicleId: string,
  vehicleName: string,
  engineHours: number,
  interval: number,
  type: string
) {
  const sinceLastService = engineHours % interval;
  const remaining = interval - sinceLastService;
  const pct = remaining / interval;

  let urgency: Urgency | null = null;
  let detail = "";

  if (pct < 0.1) {
    urgency = "CRITICAL";
    detail = `Only ${remaining.toFixed(0)}h remaining — schedule ${type} immediately (${Math.round(engineHours)}h total)`;
  } else if (pct < 0.25) {
    urgency = "DUE";
    detail = `${remaining.toFixed(0)}h until next ${type} (${Math.round(engineHours)}h total)`;
  } else if (pct < 0.4) {
    urgency = "UPCOMING";
    detail = `${remaining.toFixed(0)}h until next ${type} (${Math.round(engineHours)}h total)`;
  }

  if (urgency) {
    alerts.push({
      vehicleId,
      vehicleName,
      urgency,
      type,
      currentEngineHours: Math.round(engineHours),
      detail,
    });
  }
}
