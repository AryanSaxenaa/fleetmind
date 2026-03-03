import { geotabAdd, geotabRemove, geotabGet } from "@/lib/geotab";

export interface ZoneCreateRequest {
  name: string;
  latitude: number;
  longitude: number;
  radiusMeters?: number;
  color?: string;
}

export interface ZoneCreateResult {
  id: string;
  name: string;
  pointCount: number;
}

function createCirclePoints(lat: number, lng: number, radiusMeters: number, segments: number = 16) {
  const points = [] as Array<{ x: number; y: number }>;
  const earthRadius = 6371000;
  const latRad = (lat * Math.PI) / 180;
  const lngRad = (lng * Math.PI) / 180;

  for (let i = 0; i < segments; i++) {
    const theta = (2 * Math.PI * i) / segments;
    const dLat = (radiusMeters / earthRadius) * Math.sin(theta);
    const dLng = (radiusMeters / earthRadius) * Math.cos(theta) / Math.cos(latRad);
    const newLat = latRad + dLat;
    const newLng = lngRad + dLng;
    points.push({
      y: (newLat * 180) / Math.PI, // Geotab expects y = latitude
      x: (newLng * 180) / Math.PI, // Geotab expects x = longitude
    });
  }
  return points;
}

export async function createGeofenceCircle(req: ZoneCreateRequest): Promise<ZoneCreateResult> {
  const groups = await geotabGet<any>("Group", { resultsLimit: 200 });
  const companyGroup =
    groups.find((g: any) => g.id === "GroupCompanyId") ||
    groups.find((g: any) => !g.parent) ||
    groups[0];
  if (!companyGroup) {
    throw new Error("No groups found to attach zone");
  }

  const radius = req.radiusMeters ?? 150;
  const zone = {
    name: req.name,
    activeFrom: new Date().toISOString(),
    activeTo: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    color: req.color || "#111111",
    groups: [{ id: companyGroup.id }],
    points: createCirclePoints(req.latitude, req.longitude, radius),
  };

  const result = await geotabAdd<{ id: string }>("Zone", zone);
  return { id: result.id, name: req.name, pointCount: zone.points.length };
}

export async function deleteGeofence(zoneId: string) {
  return geotabRemove("Zone", { id: zoneId });
}

export async function listGeofences(limit: number = 100) {
  // Only fetch zones in the accessible company group to avoid listing
  // system/restricted zones that the user cannot delete.
  let groupFilter: Record<string, any> | undefined;
  try {
    const groups = await geotabGet<any>("Group", { resultsLimit: 200 });
    const companyGroup =
      groups.find((g: any) => g.id === "GroupCompanyId") ||
      groups.find((g: any) => !g.parent) ||
      groups[0];
    if (companyGroup) {
      groupFilter = { groups: [{ id: companyGroup.id }] };
    }
  } catch {
    // Fall through without filter
  }
  const zones = await geotabGet<any>("Zone", {
    resultsLimit: limit,
    ...(groupFilter ? { search: groupFilter } : {}),
  });
  return zones.map((z) => ({
    ...z,
    points: Array.isArray(z.points)
      ? z.points.map((p: any) => ({ latitude: p.y, longitude: p.x }))
      : [],
  }));
}
