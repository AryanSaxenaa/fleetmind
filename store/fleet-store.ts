import { create } from "zustand";

type Zone = {
  id: string;
  name: string;
  points?: Array<{ latitude: number; longitude: number }>;
};

interface Alert {
  id: string;
  severity: "critical" | "warning" | "info";
  message: string;
  timestamp: string;
  vehicleId?: string;
}

interface FleetState {
  active: number;
  stopped: number;
  idling: number;
  offline: number;
  total: number;
  lastUpdated: Date | null;
  alerts: Alert[];
  isLoading: boolean;
  error: string | null;
  fetchStatus: () => Promise<void>;
  addAlert: (alert: Alert) => void;
  geofences: Zone[];
  fetchGeofences: () => Promise<void>;
  startFeedPolling: () => void;
  stopFeedPolling: () => void;
  _feedInterval?: any;
  _zonePresence: Record<string, boolean>;
  _commState: Record<string, boolean>;
  _recentAlertKeys: Record<string, number>;
}

let alertSeq = 0;
const MAX_ALERTS = 100;
const STALE_MS = 24 * 60 * 60 * 1000; // 24h

function mergeAlerts(existing: Alert[], extras: Alert[]): Alert[] {
  const now = Date.now();
  const combined = [...extras, ...existing]
    .filter((a) => now - new Date(a.timestamp).getTime() < STALE_MS || a.severity !== "info")
    .slice(0, MAX_ALERTS);
  return combined;
}

function makeAlert(
  severity: Alert["severity"],
  message: string,
  timestamp?: string,
  vehicleId?: string
): Alert {
  return {
    id: `alert-${++alertSeq}-${Date.now()}`,
    severity,
    message,
    timestamp: timestamp || new Date().toISOString(),
    vehicleId,
  };
}

function shortId(id: string | undefined): string | undefined {
  if (!id) return undefined;
  const clean = id.replace(/[^a-zA-Z0-9]/g, "");
  if (clean.length <= 6) return clean;
  return `${clean.slice(0, 3)}…${clean.slice(-3)}`;
}

export const useFleetStore = create<FleetState>((set, get) => ({
  active: 0,
  stopped: 0,
  idling: 0,
  offline: 0,
  total: 0,
  lastUpdated: null,
  alerts: [],
  isLoading: false,
  error: null,
  geofences: [],

  // internal poller handle and presence cache
  _feedInterval: undefined as any,
  _zonePresence: {} as Record<string, boolean>,
  _commState: {} as Record<string, boolean>,
  _recentAlertKeys: {} as Record<string, number>,

  fetchStatus: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch("/api/fleet-status");
      if (!res.ok) throw new Error("Failed to fetch fleet status");
      const data = await res.json();

      const prev = get();
      const newAlerts: Alert[] = [];

      // Generate alerts on meaningful threshold changes
      if (prev.total > 0) {
        // Offline vehicles increased
        if (data.offline > prev.offline && data.offline > 0) {
          const delta = data.offline - prev.offline;
          newAlerts.push(
            makeAlert(
              data.offline > data.total * 0.3 ? "critical" : "warning",
              `${delta} vehicle${delta > 1 ? "s" : ""} went offline (${data.offline} total offline)`
            )
          );
        }

        // Idling spike
        if (data.idling > prev.idling + 2 && data.idling > 0) {
          newAlerts.push(
            makeAlert("warning", `Idle vehicle count increased to ${data.idling} — check for unnecessary idling`)
          );
        }

        // Fleet utilization drop
        const prevUtil = (prev.active / (prev.total || 1)) * 100;
        const newUtil = (data.active / (data.total || 1)) * 100;
        if (prevUtil > 30 && newUtil < 15 && data.total > 0) {
          newAlerts.push(
            makeAlert("warning", `Fleet utilization dropped to ${Math.round(newUtil)}% — only ${data.active} vehicles active`)
          );
        }
      } else {
        // First load — seed initial alerts based on current state
        if (data.offline > data.total * 0.2 && data.offline > 0) {
          newAlerts.push(
            makeAlert("warning", `${data.offline} vehicles offline — check GPS connectivity`)
          );
        }
        if (data.idling > 3) {
          newAlerts.push(
            makeAlert("info", `${data.idling} vehicles currently idling — monitor for fuel waste`)
          );
        }
        if (data.active > 0) {
          newAlerts.push(
            makeAlert("info", `Fleet connected: ${data.active} active, ${data.total} total vehicles`)
          );
        }
      }

      set((state) => ({
        active: data.active,
        stopped: data.stopped,
        idling: data.idling,
        offline: data.offline,
        total: data.total,
        lastUpdated: new Date(),
        isLoading: false,
        error: null,
        alerts: mergeAlerts(state.alerts, newAlerts),
      }));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      set({ isLoading: false, error: msg });
    }
  },

  addAlert: (alert) =>
    set((state) => ({
      alerts: [alert, ...state.alerts].slice(0, 50),
    })),

  fetchGeofences: async () => {
    try {
      const res = await fetch("/api/geofence");
      if (!res.ok) throw new Error("Failed to load geofences");
      const data = await res.json();
      set({ geofences: data.zones || [] });
    } catch (e) {
      // swallow; geofences are optional
    }
  },

  startFeedPolling: () => {
    const state: any = get() as any;
    if (state._feedInterval) return;

    const poll = async () => {
      try {
        const res = await fetch("/api/feed");
        if (!res.ok) throw new Error("Feed fetch failed");
        const data = await res.json();
        const { exceptions = [], statuses = [], logRecords = [] } = data;

        const newAlerts: Alert[] = [];

        // Exception-based alerts (human-friendly, deduped, use event timestamp)
        const recentKeys = { ...(get() as any)._recentAlertKeys } as Record<string, number>;
        const nowMs = Date.now();
        const dedupeWindowMs = 10 * 60 * 1000;

        for (const evt of exceptions) {
          const ruleName = evt.rule?.name || evt.rule?.id || evt.ruleId || "Event";
          const ruleIdLower = (evt.rule?.id || evt.ruleId || "").toLowerCase();
          let sev: Alert["severity"] = "info";
          if (ruleIdLower.includes("harsh") || ruleIdLower.includes("braking")) sev = "warning";
          if (ruleIdLower.includes("fault") || ruleIdLower.includes("critical")) sev = "critical";

          const deviceId = evt.device?.id || evt.deviceId;
          const name = evt.device?.name || shortId(deviceId) || "Vehicle";
          const whenIso = evt.activeFrom || evt.dateTime || new Date().toISOString();
          const when = new Date(whenIso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

          const key = `${deviceId || name}|${ruleName}`;
          const last = recentKeys[key];
          if (last && nowMs - last < dedupeWindowMs) {
            continue; // skip near-duplicate within window
          }
          recentKeys[key] = nowMs;

          const msg = `${name} · ${ruleName} @ ${when}`;
          newAlerts.push(makeAlert(sev, msg, whenIso, deviceId));
        }
        // trim dedupe cache
        const trimmed: Record<string, number> = {};
        Object.entries(recentKeys)
          .filter(([, ts]) => nowMs - ts < dedupeWindowMs * 2)
          .forEach(([k, ts]) => (trimmed[k] = ts));
        set({ _recentAlertKeys: trimmed } as any);

        // Device status-based connectivity alerts (online/offline transitions)
        if (Array.isArray(statuses) && statuses.length) {
          const commState = { ...(get() as any)._commState } as Record<string, boolean>;
          for (const s of statuses) {
            const deviceId = s.device?.id || s.id;
            if (!deviceId) continue;
            const name = s.device?.name || "Vehicle";
            const isUp = s.isCommunicating !== false;
            if (commState[deviceId] === undefined) {
              commState[deviceId] = isUp;
              continue;
            }
            if (commState[deviceId] !== isUp) {
              commState[deviceId] = isUp;
              newAlerts.push(
                makeAlert(
                  isUp ? "info" : "critical",
                  `${name} ${isUp ? "recovered connection" : "lost communication"}`
                )
              );
            }
          }
          set({ _commState: commState } as any);
        }

        // Geofence entry/exit based on latest log records
        const geofences = (get() as any).geofences as Zone[];
        if (geofences.length > 0 && Array.isArray(logRecords)) {
          // latest log per device
          const latestByDevice = new Map<string, any>();
          for (const r of logRecords) {
            const id = r.device?.id;
            if (!id) continue;
            const ts = new Date(r.dateTime).getTime();
            const existing = latestByDevice.get(id);
            if (!existing || ts > existing._ts) latestByDevice.set(id, { ...r, _ts: ts });
          }

          const presence = (get() as any)._zonePresence as Record<string, boolean>;

          for (const [deviceId, rec] of latestByDevice.entries()) {
            let inside = false;
            let zoneName = "zone";
            for (const z of geofences) {
              if (isPointInZone(rec.latitude, rec.longitude, z)) {
                inside = true;
                zoneName = z.name;
                break;
              }
            }
            const wasInside = presence[deviceId] || false;
            if (inside !== wasInside) {
              presence[deviceId] = inside;
              const vehicleName = rec.device?.name || deviceId;
              newAlerts.push(
                makeAlert(
                  inside ? "info" : "warning",
                  `${vehicleName} ${inside ? "entered" : "exited"} ${zoneName}`
                )
              );
            }
          }

          set({ _zonePresence: { ...presence } } as any);
        }

        if (newAlerts.length) {
          set((state) => ({ alerts: mergeAlerts(state.alerts, newAlerts) }));
        }
      } catch (e) {
        // swallow feed errors
      }
    };

    // initial fetch
    poll();
    const handle = setInterval(poll, 20_000);
    set({ _feedInterval: handle } as any);
  },

  stopFeedPolling: () => {
    const state: any = get() as any;
    if (state._feedInterval) {
      clearInterval(state._feedInterval);
      set({ _feedInterval: undefined } as any);
    }
  },
}));

// Haversine distance in meters
function haversine(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function isPointInZone(lat: number, lon: number, zone: Zone): boolean {
  if (!zone.points || zone.points.length === 0) return false;
  const center = zone.points.reduce(
    (acc, p) => ({ lat: acc.lat + p.latitude, lon: acc.lon + p.longitude }),
    { lat: 0, lon: 0 }
  );
  center.lat /= zone.points.length;
  center.lon /= zone.points.length;
  let radius = 0;
  for (const p of zone.points) {
    radius += haversine(center.lat, center.lon, p.latitude, p.longitude);
  }
  radius = radius / zone.points.length || 0;
  const dist = haversine(center.lat, center.lon, lat, lon);
  return dist <= radius * 1.05; // small buffer
}
