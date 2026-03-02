import { geotabMultiCall, daysAgo } from "@/lib/geotab";

export interface DriverSafetyProfile {
  driverId: string;
  driverName: string;
  harshBraking: number;
  speeding: number;
  cornering: number;
  totalEvents: number;
  score: number;
}

export interface DriverSafetyResult {
  period: string;
  totalDrivers: number;
  drivers: DriverSafetyProfile[];
  bottomThree: (DriverSafetyProfile & { coachingNote: string })[];
}

export async function getDriverSafety(
  period: "week" | "month" = "week"
): Promise<DriverSafetyResult> {
  const days = period === "week" ? 7 : 30;
  const fromDate = daysAgo(days);

  const [devices, exceptions, drivers] = await geotabMultiCall<any>([
    { method: "Get", params: { typeName: "Device", resultsLimit: 200 } },
    {
      method: "Get",
      params: {
        typeName: "ExceptionEvent",
        search: { fromDate: fromDate.toISOString() },
        resultsLimit: 1000,
      },
    },
    { method: "Get", params: { typeName: "User", search: { isDriver: true }, resultsLimit: 200 } },
  ]);

  const deviceNameMap = new Map<string, string>();
  for (const d of devices) deviceNameMap.set(d.id, d.name);

  const driverNameMap = new Map<string, string>();
  for (const d of drivers) {
    const name = d.name || `${d.firstName || ""} ${d.lastName || ""}`.trim();
    driverNameMap.set(d.id, name || d.id);
  }

  // Aggregate events per driver, fallback to device if UnknownDriverId
  const driverEvents = new Map<
    string,
    { harshBraking: number; speeding: number; cornering: number }
  >();

  for (const evt of exceptions) {
    const driverId = evt.driver?.id && evt.driver.id !== "UnknownDriverId" ? evt.driver.id : evt.device?.id;
    if (!driverId) continue;

    if (!driverEvents.has(driverId)) {
      driverEvents.set(driverId, {
        harshBraking: 0,
        speeding: 0,
        cornering: 0,
      });
    }
    const entry = driverEvents.get(driverId)!;

    const ruleId = evt.rule?.id?.toLowerCase() || "";
    if (ruleId.includes("harshbraking") || ruleId.includes("braking")) {
      entry.harshBraking++;
    } else if (ruleId.includes("speeding") || ruleId.includes("speed")) {
      entry.speeding++;
    } else if (ruleId.includes("cornering") || ruleId.includes("corner")) {
      entry.cornering++;
    }
  }

  // Calculate scores
  const profiles: DriverSafetyProfile[] = [];
  for (const [driverId, events] of driverEvents) {
    const total = events.harshBraking + events.speeding + events.cornering;
    const score = Math.max(0, 100 - total * 5);

    profiles.push({
      driverId,
      driverName:
        driverNameMap.get(driverId) || deviceNameMap.get(driverId) || driverId,
      ...events,
      totalEvents: total,
      score,
    });
  }

  // Sort worst first
  profiles.sort((a, b) => a.score - b.score);

  return {
    period,
    totalDrivers: profiles.length,
    drivers: profiles.slice(0, 20),
    bottomThree: profiles.slice(0, 3).map((d) => ({
      ...d,
      coachingNote: buildCoachingNote(d),
    })),
  };
}

function buildCoachingNote(d: DriverSafetyProfile): string {
  const parts: string[] = [];
  if (d.speeding > 0) parts.push(`${d.speeding} speeding events`);
  if (d.harshBraking > 0) parts.push(`${d.harshBraking} harsh braking events`);
  if (d.cornering > 0) parts.push(`${d.cornering} cornering events`);
  const events = parts.length ? parts.join(", ") : "no recorded harsh events";
  return `${d.driverName}: focus on reducing ${events}; current score ${d.score}.`;
}
