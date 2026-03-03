"use client";

import { useEffect } from "react";
import { useFleetStore } from "@/store/fleet-store";
import {
  LayoutDashboard,
  Sparkles,
  AlertTriangle,
  Bell,
  RefreshCw,
  X,
  Activity,
} from "lucide-react";
import Link from "next/link";

interface FleetSidebarProps {
  onClose?: () => void;
}

export function FleetSidebar({ onClose }: FleetSidebarProps) {
  const {
    active,
    stopped,
    idling,
    offline,
    total,
    lastUpdated,
    alerts,
    isLoading,
    error,
    fetchStatus,
    fetchGeofences,
    startFeedPolling,
    stopFeedPolling,
  } = useFleetStore();

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 60_000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  useEffect(() => {
    fetchGeofences();
    startFeedPolling();
    return () => stopFeedPolling();
  }, [fetchGeofences, startFeedPolling, stopFeedPolling]);

  const criticalCount = alerts.filter((a) => a.severity === "critical").length;
  const warningCount = alerts.filter((a) => a.severity === "warning").length;

  return (
    <aside
      aria-label="Fleet status sidebar"
      className="w-72 h-full border-r border-border flex flex-col bg-white relative z-10 overflow-y-auto scrollbar-thin"
    >
      {/* Brand */}
      <div className="px-6 py-6 flex items-center gap-3 border-b border-border">
        <div className="size-9 rounded-lg bg-primary flex items-center justify-center">
          <span className="text-white text-sm font-bold">FM</span>
        </div>
        <div>
          <h1 className="text-base font-bold tracking-tight text-primary">
            FleetMind
          </h1>
          <p className="text-[10px] text-muted font-medium uppercase tracking-widest">
            AI Copilot
          </p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="lg:hidden ml-auto p-2 rounded-lg text-muted hover:text-primary hover:bg-cream transition-colors"
            aria-label="Close sidebar"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Metric Cards */
      <div className="px-6 mt-6 space-y-3">
        <p className="text-[10px] font-semibold text-muted uppercase tracking-widest">
          Fleet Overview
        </p>

        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg border border-border bg-white">
            <p className="text-[10px] font-medium text-muted uppercase">Active</p>
            <h3 className="text-xl font-bold text-primary mt-0.5">
              {isLoading ? (
                <span className="inline-block h-6 w-10 rounded bg-cream animate-shimmer" />
              ) : (
                active
              )}
            </h3>
          </div>
          <div className="p-3 rounded-lg border border-border bg-white">
            <p className="text-[10px] font-medium text-muted uppercase">Stopped</p>
            <h3 className="text-xl font-bold text-primary mt-0.5">
              {isLoading ? (
                <span className="inline-block h-6 w-10 rounded bg-cream animate-shimmer" />
              ) : (
                stopped
              )}
            </h3>
          </div>
          <div className="p-3 rounded-lg border border-border bg-white">
            <p className="text-[10px] font-medium text-muted uppercase">Idling</p>
            <h3 className="text-xl font-bold text-primary mt-0.5">
              {isLoading ? (
                <span className="inline-block h-6 w-10 rounded bg-cream animate-shimmer" />
              ) : (
                idling
              )}
            </h3>
          </div>
          <div className="p-3 rounded-lg border border-border bg-white">
            <p className="text-[10px] font-medium text-muted uppercase">Total</p>
            <h3 className="text-xl font-bold text-primary mt-0.5">
              {isLoading ? (
                <span className="inline-block h-6 w-10 rounded bg-cream animate-shimmer" />
              ) : (
                total
              )}
            </h3>
          </div>
        </div>

        {/* Live indicator */}
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse-ring" />
          <span className="text-[10px] font-semibold text-muted tracking-wide uppercase">
            Live Tracking
          </span>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="mx-6 mt-4 flex items-center gap-2 p-3 border border-border rounded-lg bg-cream">
          <AlertTriangle className="h-4 w-4 text-primary shrink-0" />
          <span className="text-xs text-primary flex-1">Failed to load</span>
          <button
            onClick={fetchStatus}
            className="p-1 rounded hover:bg-white transition-colors"
          >
            <RefreshCw className="h-3 w-3 text-primary" />
          </button>
        </div>
      )}

      {/* Hatched divider */}
      <div className="mx-6 mt-6 hatch-divider" />

      {/* Navigation */}
      <nav className="flex-1 px-4 mt-4 space-y-0.5">
        <Link
          href="/"
          className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-primary text-white font-semibold text-sm transition-all"
        >
          <LayoutDashboard className="h-4 w-4" />
          <span>Dashboard</span>
        </Link>
        <Link
          href="/dna"
          className="flex items-center gap-3 px-4 py-2.5 rounded-lg hover:bg-cream transition-all text-primary/60 hover:text-primary text-sm"
        >
          <Sparkles className="h-4 w-4" />
          <span>Driver DNA</span>
        </Link>
        <Link
          href="/alerts"
          className="flex items-center gap-3 px-4 py-2.5 rounded-lg hover:bg-cream transition-all text-primary/60 hover:text-primary text-sm"
        >
          <Bell className="h-4 w-4" />
          <span>Alerts</span>
          {criticalCount > 0 && (
            <span className="ml-auto text-[10px] bg-primary text-white rounded-full px-1.5 py-0.5 min-w-[18px] text-center font-bold">
              {criticalCount}
            </span>
          )}
          {criticalCount === 0 && warningCount > 0 && (
            <span className="ml-auto text-[10px] bg-amber-100 text-amber-800 rounded-full px-1.5 py-0.5 min-w-[18px] text-center font-bold">
              {warningCount}
            </span>
          )}
        </Link>

      </nav>

      {/* Alert Feed (condensed) */}
      {alerts.length > 0 && (
        <div className="px-6 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <Bell className="h-3.5 w-3.5 text-primary" />
            <span className="text-[10px] font-semibold text-primary uppercase tracking-wider">
              Recent Alerts
            </span>
            <span className="ml-auto text-[10px] border border-border text-primary rounded-full px-1.5 py-0.5 font-semibold">
              {alerts.length}
            </span>
          </div>
          <div className="space-y-1.5 max-h-28 overflow-y-auto scrollbar-thin">
            {alerts.slice(0, 4).map((alert) => (
              <div
                key={alert.id}
                className="border border-border rounded-lg p-2 bg-white"
              >
                <div className="flex items-center gap-1.5">
                  <AlertTriangle className="h-3 w-3 text-primary/60 shrink-0" />
                  <span className="text-[10px] font-semibold uppercase text-primary/60">
                    {alert.severity}
                  </span>
                  <span className="text-[10px] text-muted ml-auto">
                    {new Date(alert.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <p className="text-[11px] text-primary/80 mt-0.5 leading-relaxed line-clamp-2">
                  {alert.message}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* System Health */}
      <div className="p-6 mt-auto">
        <div className="p-3 rounded-lg border border-border bg-cream">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="h-3.5 w-3.5 text-primary" />
            <p className="text-[10px] font-semibold text-primary uppercase tracking-wider">
              System Health
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
              <div className="w-[98%] h-full bg-primary rounded-full" />
            </div>
            <span className="text-xs font-bold text-primary">98%</span>
          </div>
        </div>
      </div>

      {/* Timestamp */}
      {lastUpdated && (
        <p className="text-[10px] text-muted text-center pb-4">
          Updated {lastUpdated.toLocaleTimeString()}
        </p>
      )}
    </aside>
  );
}
