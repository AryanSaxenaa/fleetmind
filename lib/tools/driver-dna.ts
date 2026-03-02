import { geotabMultiCall, daysAgo } from "@/lib/geotab";

export interface DNAScores {
  safety: number;
  efficiency: number;
  consistency: number;
  responsiveness: number;
  endurance: number;
}

export interface DNAProfile {
  driverId: string;
  name: string;
  scores: DNAScores;
  archetype: string;
  strengthSummary: string;
  coachingTip: string;
  trend: "improving" | "stable" | "declining";
}

export interface DriverDNAResult {
  totalProfiled: number;
  profiles: DNAProfile[];
}

export async function getDriverDNA(top: number = 5): Promise<DriverDNAResult> {
  const fromDate = daysAgo(14); // 2-week analysis window

  const [devices, exceptions, trips, drivers] = await geotabMultiCall<any>([
    { method: "Get", params: { typeName: "Device", resultsLimit: 200 } },
    { method: "Get", params: { typeName: "ExceptionEvent", search: { fromDate: fromDate.toISOString() }, resultsLimit: 1000 } },
    { method: "Get", params: { typeName: "Trip", search: { fromDate: fromDate.toISOString() }, resultsLimit: 1000 } },
    { method: "Get", params: { typeName: "User", search: { isDriver: true }, resultsLimit: 200 } },
  ]);

  const deviceNameMap = new Map<string, string>();
  for (const d of devices) deviceNameMap.set(d.id, d.name);

  const driverNameMap = new Map<string, string>();
  for (const d of drivers) {
    const name = d.name || `${d.firstName || ""} ${d.lastName || ""}`.trim();
    driverNameMap.set(d.id, name || d.id);
  }

  // Aggregate per device
  const driverData = new Map<
    string,
    {
      harshBraking: number;
      speeding: number;
      cornering: number;
      totalTrips: number;
      totalDistance: number;
      totalIdleMinutes: number;
      tripDurations: number[];
    }
  >();

  const ensureEntry = (id: string) => {
    if (!driverData.has(id)) {
      driverData.set(id, {
        harshBraking: 0,
        speeding: 0,
        cornering: 0,
        totalTrips: 0,
        totalDistance: 0,
        totalIdleMinutes: 0,
        tripDurations: [],
      });
    }
    return driverData.get(id)!;
  };

  // Count exceptions per driver (fallback to device when missing)
  for (const e of exceptions) {
    const id = e.driver?.id && e.driver.id !== "UnknownDriverId" ? e.driver.id : e.device?.id;
    if (!id) continue;
    const d = ensureEntry(id);
    const rule = e.rule?.id?.toLowerCase() || "";
    if (rule.includes("braking") || rule.includes("harshbraking")) d.harshBraking++;
    else if (rule.includes("speed")) d.speeding++;
    else if (rule.includes("corner")) d.cornering++;
  }

  // Aggregate trip data per driver/device
  for (const t of trips) {
    const id = t.driver?.id && t.driver.id !== "UnknownDriverId" ? t.driver.id : t.device?.id;
    if (!id) continue;
    const d = ensureEntry(id);
    d.totalTrips++;
    d.totalDistance += (t.distance || 0) / 1000; // m → km

    if (t.idlingDuration) {
      const parts = t.idlingDuration.split(":").map(Number);
      d.totalIdleMinutes += (parts[0] || 0) * 60 + (parts[1] || 0);
    }
    if (t.drivingDuration) {
      const parts = t.drivingDuration.split(":").map(Number);
      d.tripDurations.push((parts[0] || 0) * 60 + (parts[1] || 0));
    }
  }

  // Calculate 5 DNA dimensions per driver
  const profiles: DNAProfile[] = [];

  for (const [id, data] of driverData) {
    const totalEvents = data.harshBraking + data.speeding + data.cornering;

    // Safety: fewer events = higher score (deduct 8 pts per event)
    const safety = Math.max(0, Math.min(100, 100 - totalEvents * 8));

    // Efficiency: lower idle ratio = higher score
    const idleRatio =
      data.totalTrips > 0 ? data.totalIdleMinutes / (data.totalTrips * 30) : 0;
    const efficiency = Math.max(0, Math.min(100, 100 - idleRatio * 50));

    // Consistency: lower std deviation in trip durations = higher score
    const durations = data.tripDurations;
    const avgDur =
      durations.length > 0
        ? durations.reduce((a, b) => a + b, 0) / durations.length
        : 0;
    const stdDur =
      durations.length > 1
        ? Math.sqrt(
            durations.reduce((s, d) => s + (d - avgDur) ** 2, 0) /
              durations.length
          )
        : 0;
    const consistency = Math.max(0, Math.min(100, 100 - stdDur * 0.5));

    // Responsiveness: more trips per day = higher (14-day window)
    const responsiveness = Math.min(100, (data.totalTrips / 14) * 20);

    // Endurance: longer average trips = higher
    const endurance = Math.min(100, avgDur * 1.5);

    const scores: DNAScores = {
      safety: Math.round(safety),
      efficiency: Math.round(efficiency),
      consistency: Math.round(consistency),
      responsiveness: Math.round(responsiveness),
      endurance: Math.round(endurance),
    };

    profiles.push({
      driverId: id,
      name: driverNameMap.get(id) || deviceNameMap.get(id) || id,
      scores,
      // Placeholders — Gemini generates these from the data
      archetype: generateArchetype(scores),
      strengthSummary: generateStrengthSummary(scores, deviceNameMap.get(id) || id),
      coachingTip: generateCoachingTip(scores),
      trend: safety > 70 ? "improving" : safety > 40 ? "stable" : "declining",
    });
  }

  // Sort by composite score (sum of all 5 dimensions), take top N
  profiles.sort((a, b) => {
    const scoreA = Object.values(a.scores).reduce((s, v) => s + v, 0);
    const scoreB = Object.values(b.scores).reduce((s, v) => s + v, 0);
    return scoreB - scoreA;
  });

  return {
    totalProfiled: profiles.length,
    profiles: profiles.slice(0, top),
  };
}

// Pre-generate archetype names based on score patterns
function generateArchetype(scores: DNAScores): string {
  const { safety, efficiency, consistency, responsiveness, endurance } = scores;
  const max = Math.max(safety, efficiency, consistency, responsiveness, endurance);

  if (max === safety && safety >= 80) return "The Guardian";
  if (max === efficiency && efficiency >= 80) return "The Optimizer";
  if (max === consistency && consistency >= 80) return "The Metronome";
  if (max === responsiveness && responsiveness >= 80) return "The Sprinter";
  if (max === endurance && endurance >= 80) return "The Marathon Runner";

  // Combo archetypes
  if (safety >= 70 && efficiency >= 70) return "The Highway Hawk";
  if (endurance >= 70 && consistency >= 70) return "The Iron Horse";
  if (responsiveness >= 70 && safety >= 60) return "The Quick Shield";
  if (efficiency >= 60 && endurance >= 60) return "The Steady Cruiser";

  // Fallback
  if (safety < 50) return "The Risk Taker";
  if (efficiency < 50) return "The Fuel Burner";
  return "The Road Warrior";
}

function generateStrengthSummary(scores: DNAScores, name: string): string {
  const entries = Object.entries(scores) as [keyof DNAScores, number][];
  const sorted = entries.sort((a, b) => b[1] - a[1]);
  const top1 = sorted[0];
  const top2 = sorted[1];

  const labels: Record<keyof DNAScores, string> = {
    safety: "safe driving habits",
    efficiency: "fuel-efficient operation",
    consistency: "route consistency",
    responsiveness: "quick task turnaround",
    endurance: "sustained long-haul performance",
  };

  return `${name} excels in ${labels[top1[0]]} (${top1[1]}/100) and ${labels[top2[0]]} (${top2[1]}/100). A reliable contributor to overall fleet performance.`;
}

function generateCoachingTip(scores: DNAScores): string {
  const entries = Object.entries(scores) as [keyof DNAScores, number][];
  const weakest = entries.sort((a, b) => a[1] - b[1])[0];

  const tips: Record<keyof DNAScores, string> = {
    safety: "Focus on reducing harsh braking and speeding events — consider defensive driving refresher.",
    efficiency: "Reduce idle time between stops — try engine-off policy during scheduled breaks.",
    consistency: "Work on maintaining more predictable trip patterns for better route planning.",
    responsiveness: "Try to increase daily trip completion rate while maintaining safety standards.",
    endurance: "Build up to longer routes gradually — take structured breaks to maintain alertness.",
  };

  return tips[weakest[0]];
}
