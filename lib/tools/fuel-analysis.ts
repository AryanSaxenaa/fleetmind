import { geotabMultiCall, daysAgo } from "@/lib/geotab";
import { parseDurationMinutes } from "@/lib/utils";

export interface FuelAnomaly {
  vehicleId: string;
  vehicleName: string;
  fuelUsedLiters: number;
  idleFuelLiters: number;
  idleHours: number;
  fleetAvgIdleHours: number;
  excessIdleHours: number;
  estimatedWaste: number;
  totalDistance: number;
  tripCount: number;
  recommendation: string;
}

export interface FuelAnalysisResult {
  period: string;
  fleetAverageIdleHours: number;
  anomalyCount: number;
  totalEstimatedWaste: number;
  anomalies: FuelAnomaly[];
}

export async function getFuelAnalysis(
  period: "week" | "month" = "week"
): Promise<FuelAnalysisResult> {
  const days = period === "week" ? 7 : 30;
  const fromDate = daysAgo(days);

  const [devices, trips, fuelData, idleFuelData] = await geotabMultiCall<any>([
    { method: "Get", params: { typeName: "Device", resultsLimit: 200 } },
    { method: "Get", params: { typeName: "Trip", search: { fromDate: fromDate.toISOString() }, resultsLimit: 1000 } },
    {
      method: "Get",
      params: {
        typeName: "StatusData",
        search: { diagnosticSearch: { id: "DiagnosticDeviceTotalFuelId" }, fromDate: fromDate.toISOString() },
        resultsLimit: 2000,
      },
    },
    {
      method: "Get",
      params: {
        typeName: "StatusData",
        search: { diagnosticSearch: { id: "DiagnosticDeviceTotalIdleFuelId" }, fromDate: fromDate.toISOString() },
        resultsLimit: 2000,
      },
    },
  ]);

  const deviceNameMap = new Map<string, string>();
  for (const d of devices) deviceNameMap.set(d.id, d.name);

  // Aggregate idle time and trip metrics per vehicle from trips
  const vehicleMetrics = new Map<
    string,
    { totalIdleMinutes: number; totalDistance: number; tripCount: number; fuelUsed: number; idleFuel: number }
  >();

  for (const trip of trips) {
    const deviceId = trip.device?.id;
    if (!deviceId) continue;

    if (!vehicleMetrics.has(deviceId)) {
      vehicleMetrics.set(deviceId, {
        totalIdleMinutes: 0,
        totalDistance: 0,
        tripCount: 0,
        fuelUsed: 0,
        idleFuel: 0,
      });
    }
    const m = vehicleMetrics.get(deviceId)!;
    m.totalIdleMinutes += trip.idlingDuration
      ? parseDurationMinutes(trip.idlingDuration)
      : 0;
    m.totalDistance += (trip.distance || 0) / 1000; // Convert meters to km
    m.tripCount++;
  }

  // Add actual fuel consumption deltas from StatusData
  const accumulateFuelDelta = (
    readings: any[],
    target: "fuelUsed" | "idleFuel"
  ) => {
    const grouped = new Map<string, { min: number; max: number }>();
    for (const r of readings) {
      const id = r.device?.id;
      if (!id || typeof r.data !== "number") continue;
      if (!grouped.has(id)) grouped.set(id, { min: r.data, max: r.data });
      const g = grouped.get(id)!;
      g.min = Math.min(g.min, r.data);
      g.max = Math.max(g.max, r.data);
    }

    for (const [id, bounds] of grouped) {
      const delta = Math.max(0, bounds.max - bounds.min);
      if (!vehicleMetrics.has(id)) {
        vehicleMetrics.set(id, {
          totalIdleMinutes: 0,
          totalDistance: 0,
          tripCount: 0,
          fuelUsed: 0,
          idleFuel: 0,
        });
      }
      const m = vehicleMetrics.get(id)!;
      m[target] = delta;
    }
  };

  accumulateFuelDelta(fuelData, "fuelUsed");
  accumulateFuelDelta(idleFuelData, "idleFuel");

  // Calculate fleet averages
  const allIdle = Array.from(vehicleMetrics.values()).map(
    (v) => v.totalIdleMinutes
  );
  const avgIdle =
    allIdle.reduce((a, b) => a + b, 0) / (allIdle.length || 1);
  const stdIdle = Math.sqrt(
    allIdle.reduce((sum, v) => sum + (v - avgIdle) ** 2, 0) /
      (allIdle.length || 1)
  );

  // Flag anomalies (>1 std deviation above mean)
  const FUEL_PRICE_PER_LITER = 1.05; // configurable
  const anomalies: FuelAnomaly[] = [];

  for (const [deviceId, metrics] of vehicleMetrics) {
    if (metrics.totalIdleMinutes > avgIdle + stdIdle) {
      const excessMinutes = metrics.totalIdleMinutes - avgIdle;
      const idleHours = excessMinutes / 60;
      const fuelWasteLiters = metrics.idleFuel || 0;
      const wastedDollars = fuelWasteLiters > 0 ? fuelWasteLiters * FUEL_PRICE_PER_LITER : idleHours * FUEL_PRICE_PER_LITER;

      anomalies.push({
        vehicleId: deviceId,
        vehicleName: deviceNameMap.get(deviceId) || deviceId,
        fuelUsedLiters: +metrics.fuelUsed.toFixed(2),
        idleFuelLiters: +metrics.idleFuel.toFixed(2),
        idleHours: +(metrics.totalIdleMinutes / 60).toFixed(1),
        fleetAvgIdleHours: +(avgIdle / 60).toFixed(1),
        excessIdleHours: +(excessMinutes / 60).toFixed(1),
        estimatedWaste: +wastedDollars.toFixed(2),
        totalDistance: +metrics.totalDistance.toFixed(1),
        tripCount: metrics.tripCount,
        recommendation:
          "Investigate idle patterns and consider driver coaching on engine-off policy",
      });
    }
  }

  anomalies.sort((a, b) => b.estimatedWaste - a.estimatedWaste);

  return {
    period,
    fleetAverageIdleHours: +(avgIdle / 60).toFixed(1),
    anomalyCount: anomalies.length,
    totalEstimatedWaste: +anomalies
      .reduce((s, a) => s + a.estimatedWaste, 0)
      .toFixed(2),
    anomalies: anomalies.slice(0, 10),
  };
}
