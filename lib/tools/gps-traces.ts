import { geotabMultiCall, daysAgo } from "@/lib/geotab";

export interface GPSPoint {
  latitude: number;
  longitude: number;
  speed: number;
  dateTime: string;
}

export interface GPSTrace {
  vehicleId: string;
  vehicleName: string;
  points: GPSPoint[];
}

export interface GPSTraceResult {
  periodHours: number;
  totalPoints: number;
  traces: GPSTrace[];
}

/**
 * Returns recent GPS breadcrumbs per vehicle using LogRecord.
 */
export async function getRecentGPSTraces(
  periodHours: number = 6,
  maxPointsPerVehicle: number = 200
): Promise<GPSTraceResult> {
  const fromDate = new Date(Date.now() - periodHours * 60 * 60 * 1000);

  const [devices, logRecords] = await geotabMultiCall<any>([
    { method: "Get", params: { typeName: "Device", resultsLimit: 200 } },
    {
      method: "Get",
      params: {
        typeName: "LogRecord",
        search: { fromDate: fromDate.toISOString() },
        resultsLimit: 5000,
      },
    },
  ]);

  const deviceNameMap = new Map<string, string>();
  for (const d of devices) deviceNameMap.set(d.id, d.name);

  const grouped = new Map<string, GPSPoint[]>();
  for (const rec of logRecords) {
    const id = rec.device?.id;
    if (!id) continue;
    if (!grouped.has(id)) grouped.set(id, []);
    grouped.get(id)!.push({
      latitude: rec.latitude,
      longitude: rec.longitude,
      speed: rec.speed,
      dateTime: rec.dateTime,
    });
  }

  const traces: GPSTrace[] = [];
  for (const [id, points] of grouped) {
    points.sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());
    traces.push({
      vehicleId: id,
      vehicleName: deviceNameMap.get(id) || id,
      points: points.slice(-maxPointsPerVehicle),
    });
  }

  const totalPoints = traces.reduce((sum, t) => sum + t.points.length, 0);

  return { periodHours, totalPoints, traces };
}
