"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Map, RefreshCw, ShieldCheck, Sparkles, Target } from "lucide-react";

interface GPSTracePoint {
  latitude: number;
  longitude: number;
  speed: number;
  dateTime: string;
}

interface GPSTraceItem {
  vehicleId: string;
  vehicleName: string;
  points: GPSTracePoint[];
}

interface GPSTraceResult {
  periodHours: number;
  totalPoints: number;
  traces: GPSTraceItem[];
}

interface GeofenceZone {
  id: string;
  name: string;
  points?: Array<{ latitude: number; longitude: number }>;
}

interface DVIRSummaryResult {
  periodDays: number;
  totalInspections: number;
  defectsOpen: number;
  criticalDefects: number;
  logs: Array<{
    id: string;
    vehicleId: string;
    vehicleName: string;
    driverName: string;
    hasDefects: boolean;
    defectsCount: number;
    isRepaired: boolean;
    dateTime: string;
  }>;
}

function useAsync<T>(loader: () => Promise<T>, deps: any[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loader()
      .then((d) => {
        if (!cancelled) {
          setData(d);
          setError(null);
        }
      })
      .catch((e: any) => {
        if (!cancelled) setError(e?.message || "Failed to load");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  return { data, loading, error, reload: () => loader().then(setData).catch(() => null) };
}

export function CommandCenter() {
  const [hours, setHours] = useState(6);
  const [maxPoints, setMaxPoints] = useState(200);
  const [geoName, setGeoName] = useState("Warehouse");
  const [geoLat, setGeoLat] = useState(43.7);
  const [geoLng, setGeoLng] = useState(-79.4);
  const [geoRadius, setGeoRadius] = useState(150);
  const [geoMessage, setGeoMessage] = useState<string | null>(null);
  const [geoZones, setGeoZones] = useState<GeofenceZone[]>([]);
  const [dvirError, setDvirError] = useState<string | null>(null);
  const [replayIndex, setReplayIndex] = useState(0);
  const [replayPlaying, setReplayPlaying] = useState(false);
  const [collapsed, setCollapsed] = useState(true);
  const [focus, setFocus] = useState<"gps" | "geo" | "dvir">("gps");

  const gps = useAsync<GPSTraceResult>(async () => {
    const res = await fetch(`/api/gps-traces?hours=${hours}&maxPointsPerVehicle=${maxPoints}`);
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Failed to fetch GPS traces");
    return json as GPSTraceResult;
  }, [hours, maxPoints]);

  const dvir = useAsync<DVIRSummaryResult>(async () => {
    const res = await fetch(`/api/dvir?periodDays=7`);
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Failed to fetch DVIR");
    return json as DVIRSummaryResult;
  }, []);

  useEffect(() => {
    if (dvir.error) setDvirError(dvir.error);
  }, [dvir.error]);

  const loadGeofences = async () => {
    const res = await fetch("/api/geofence");
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Failed to load geofences");
    setGeoZones(json.zones || []);
  };

  useEffect(() => {
    loadGeofences().catch((e) => setGeoMessage(e?.message || "Failed to load geofences"));
  }, []);

  const createGeofence = async () => {
    setGeoMessage(null);
    const res = await fetch("/api/geofence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: geoName,
        latitude: geoLat,
        longitude: geoLng,
        radiusMeters: geoRadius,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setGeoMessage(json.error || "Failed to create geofence");
      return;
    }
    setGeoMessage(`Created ${json.name}`);
    loadGeofences().catch(() => null);
  };

  const deleteGeofence = async (zoneId: string) => {
    setGeoMessage(null);
    const res = await fetch("/api/geofence", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ zoneId }),
    });
    const json = await res.json();
    if (!res.ok) {
      setGeoMessage(json.error || "Failed to delete geofence");
      return;
    }
    setGeoMessage("Deleted geofence");
    loadGeofences().catch(() => null);
  };

  const topBreadcrumbs = useMemo(() => {
    if (!gps.data) return [] as Array<{ name: string; point: GPSTracePoint }>;
    return gps.data.traces
      .map((t) => ({ name: t.vehicleName, point: t.points[t.points.length - 1] }))
      .filter((p) => p.point)
      .slice(0, 3);
  }, [gps.data]);

  const selectedTrace = gps.data?.traces?.[0];

  useEffect(() => {
    setReplayIndex(0);
    setReplayPlaying(false);
  }, [selectedTrace?.vehicleId]);

  useEffect(() => {
    if (!replayPlaying || !selectedTrace || selectedTrace.points.length === 0) return;
    const handle = setInterval(() => {
      setReplayIndex((idx) => (idx + 1) % selectedTrace.points.length);
    }, 800);
    return () => clearInterval(handle);
  }, [replayPlaying, selectedTrace]);

  const replayPoint = selectedTrace?.points?.[Math.min(replayIndex, (selectedTrace?.points?.length || 1) - 1)];

  const replayPolyline = useMemo(() => {
    if (!selectedTrace || selectedTrace.points.length < 2) return "";
    const lats = selectedTrace.points.map((p) => p.latitude);
    const lngs = selectedTrace.points.map((p) => p.longitude);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const norm = (v: number, min: number, max: number) => (max === min ? 50 : ((v - min) / (max - min)) * 100 + 5);
    return selectedTrace.points
      .map((p) => `${norm(p.longitude, minLng, maxLng)},${100 - norm(p.latitude, minLat, maxLat)}`)
      .join(" ");
  }, [selectedTrace]);

  return (
    <section className="px-6 md:px-10 pt-6 pb-4 border-b border-border bg-white/60 backdrop-blur-sm">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="h-4 w-4 text-primary" />
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
          Command Center
        </p>
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="ml-auto px-2 py-1 text-[10px] border border-border rounded hover:bg-cream"
        >
          {collapsed ? "Expand" : "Collapse"}
        </button>
      </div>

      {collapsed ? (
        <div className="flex flex-col sm:flex-row gap-2 items-center text-[11px] text-primary/80 border border-border rounded-lg bg-white px-3 py-2">
          <span className="text-[11px] font-semibold text-primary">Quick open:</span>
          <select
            className="border border-border rounded px-2 py-1 text-primary bg-cream text-[11px]"
            value={focus}
            onChange={(e) => setFocus(e.target.value as any)}
          >
            <option value="gps">Live GPS</option>
            <option value="geo">Geofences</option>
            <option value="dvir">DVIR</option>
          </select>
          <button
            onClick={() => setCollapsed(false)}
            className="px-2 py-1 text-[10px] border border-border rounded bg-primary text-white"
          >
            Open panel
          </button>
          <span className="text-[10px] text-muted">(Collapsed to keep chat visible)</span>
        </div>
      ) : null}

      {!collapsed && (
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-4 mt-4">
        {/* GPS Live */}
        {(focus === "gps" || focus === "geo" || focus === "dvir") && (
        <div className="p-4 border border-border rounded-lg bg-white h-full flex flex-col">
          <div className="flex items-center gap-2 mb-2">
            <Map className="h-4 w-4 text-primary" />
            <div>
              <p className="text-sm font-semibold text-primary">Live GPS</p>
              <p className="text-[10px] text-muted">Breadcrumbs last {hours}h</p>
            </div>
            <button
              onClick={() => gps.reload()}
              className="ml-auto p-1 rounded hover:bg-cream border border-border text-muted"
              aria-label="Refresh GPS"
            >
              <RefreshCw className="h-3 w-3" />
            </button>
          </div>
          {gps.loading ? (
            <div className="flex items-center gap-2 text-xs text-muted">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading GPS points...
            </div>
          ) : gps.error ? (
            <p className="text-xs text-primary">{gps.error}</p>
          ) : gps.data ? (
            <div className="space-y-3 text-xs text-primary/80">
              <p className="font-semibold text-primary">
                {gps.data.totalPoints} points · {gps.data.traces.length} vehicles
              </p>
              {gps.data.totalPoints === 0 && (
                <p className="text-[11px] text-muted">No breadcrumbs found in the last {hours}h.</p>
              )}
              <div className="space-y-1.5">
                {topBreadcrumbs.map((item) => (
                  <div key={item.name} className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold text-primary">{item.name}</span>
                    <span className="text-[10px] text-muted">
                      {item.point.latitude.toFixed(4)}, {item.point.longitude.toFixed(4)} · {Math.round(item.point.speed)} km/h
                    </span>
                  </div>
                ))}
              </div>
              {selectedTrace && selectedTrace.points.length > 1 && (
                <div className="border border-border rounded-lg p-3 bg-cream/60">
                  <div className="flex items-center gap-2 mb-2">
                    <p className="text-[11px] font-semibold text-primary">Replay — {selectedTrace.vehicleName}</p>
                    <button
                      onClick={() => setReplayPlaying((p) => !p)}
                      className="ml-auto px-2 py-1 text-[10px] border border-border rounded hover:bg-white"
                    >
                      {replayPlaying ? "Pause" : "Play"}
                    </button>
                  </div>
                  <div
                    className="w-full h-24 border border-border rounded overflow-hidden"
                    style={{
                      backgroundImage:
                        "repeating-linear-gradient(0deg, #f7f4ec, #f7f4ec 9px, #ebe7dd 9px, #ebe7dd 18px), repeating-linear-gradient(90deg, #f7f4ec, #f7f4ec 9px, #ebe7dd 9px, #ebe7dd 18px)",
                    }}
                  >
                    {replayPolyline ? (
                      <svg viewBox="0 0 110 110" className="w-full h-full">
                        <polyline
                          points={replayPolyline}
                          fill="none"
                          stroke="#1a1a1a"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          opacity={0.7}
                        />
                        {replayPoint && (
                          <circle
                            cx={(() => {
                              const pts = replayPolyline.split(" ").map((p) => p.split(",").map(Number));
                              const idx = Math.min(replayIndex, pts.length - 1);
                              return pts[idx]?.[0] ?? 0;
                            })()}
                            cy={(() => {
                              const pts = replayPolyline.split(" ").map((p) => p.split(",").map(Number));
                              const idx = Math.min(replayIndex, pts.length - 1);
                              return pts[idx]?.[1] ?? 0;
                            })()}
                            r="2.5"
                            fill="#1a1a1a"
                          />
                        )}
                      </svg>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[11px] text-muted">
                        Not enough points
                      </div>
                    )}
                  </div>
                  {replayPoint && (
                    <div className="flex items-center gap-2 mt-2 text-[10px] text-primary/80">
                      <span>{new Date(replayPoint.dateTime).toLocaleTimeString()}</span>
                      <span>· {replayPoint.latitude.toFixed(4)}, {replayPoint.longitude.toFixed(4)}</span>
                      <span>· {Math.round(replayPoint.speed)} km/h</span>
                      <div className="flex-1 h-1 bg-border rounded-full overflow-hidden ml-2">
                        <div
                          className="h-full bg-primary"
                          style={{ width: `${((replayIndex + 1) / selectedTrace.points.length) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : null}
        </div>
        )}

        {/* Geofence */}
        {(focus === "geo" || focus === "gps" || focus === "dvir") && (
        <div className="p-4 border border-border rounded-lg bg-white h-full flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            <p className="text-sm font-semibold text-primary">Geofences</p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <input
              className="border border-border rounded-lg px-2 py-1 text-primary bg-cream"
              value={geoName}
              onChange={(e) => setGeoName(e.target.value)}
              placeholder="Name"
            />
            <input
              type="number"
              className="border border-border rounded-lg px-2 py-1 text-primary bg-cream"
              value={geoRadius}
              onChange={(e) => setGeoRadius(parseFloat(e.target.value) || 0)}
              placeholder="Radius m"
            />
            <input
              type="number"
              className="border border-border rounded-lg px-2 py-1 text-primary bg-cream"
              value={geoLat}
              onChange={(e) => setGeoLat(parseFloat(e.target.value) || 0)}
              placeholder="Latitude"
            />
            <input
              type="number"
              className="border border-border rounded-lg px-2 py-1 text-primary bg-cream"
              value={geoLng}
              onChange={(e) => setGeoLng(parseFloat(e.target.value) || 0)}
              placeholder="Longitude"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={createGeofence}
              className="px-3 py-1.5 text-xs font-semibold bg-primary text-white rounded-lg hover:bg-dark transition-colors"
            >
              Create Zone
            </button>
            {geoMessage && <span className="text-[10px] text-muted">{geoMessage}</span>}
          </div>
          <div className="border border-dashed border-border rounded-lg p-2 text-xs text-primary/80 bg-cream/60 flex-1">
            <p className="text-[10px] font-semibold text-primary mb-1">Existing</p>
            <div className="space-y-1 max-h-24 overflow-y-auto scrollbar-thin">
              {geoZones.slice(0, 4).map((z) => (
                <div key={z.id} className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-primary line-clamp-1">{z.name}</span>
                  <button
                    onClick={() => deleteGeofence(z.id)}
                    className="ml-auto text-[10px] px-2 py-0.5 border border-border rounded hover:bg-white"
                  >
                    Delete
                  </button>
                </div>
              ))}
              {geoZones.length === 0 && (
                <p className="text-[10px] text-muted">No zones yet.</p>
              )}
            </div>
          </div>
        </div>
        )}

        {/* DVIR */}
        <div className="p-4 border border-border rounded-lg bg-white h-full flex flex-col">
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <p className="text-sm font-semibold text-primary">DVIR</p>
          </div>
          {dvir.loading ? (
            <div className="flex items-center gap-2 text-xs text-muted">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading inspections...
            </div>
          ) : dvirError ? (
            <p className="text-xs text-primary">{dvirError}</p>
          ) : dvir.data ? (
            <div className="text-xs text-primary/80 space-y-1">
              <p className="font-semibold text-primary">
                {dvir.data.totalInspections} inspections · {dvir.data.defectsOpen} open defects
              </p>
              <p>Critical defects: {dvir.data.criticalDefects}</p>
              <div className="border border-border rounded-lg bg-cream/60 p-2 mt-1 space-y-1 max-h-24 overflow-y-auto scrollbar-thin">
                {dvir.data.logs.slice(0, 3).map((log) => (
                  <div key={log.id} className="flex items-start gap-2">
                    <span className="text-[10px] font-semibold text-primary">{log.vehicleName}</span>
                    <span className="text-[10px] text-muted line-clamp-1">
                      {log.driverName} · {log.defectsCount} defects · {log.isRepaired ? "repaired" : "open"}
                    </span>
                  </div>
                ))}
                {dvir.data.logs.length === 0 && (
                  <p className="text-[10px] text-muted">No inspections found.</p>
                )}
              </div>
            </div>
          ) : null}
        </div>

      </div>
      )}
    </section>
  );
}
