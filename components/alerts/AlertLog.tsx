"use client";

import { useFleetStore } from "@/store/fleet-store";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  AlertCircle,
  Info,
  Clock,
  Filter,
  ArrowLeft,
  Bell,
  RefreshCw,
  Truck,
} from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

type SeverityFilter = "all" | "critical" | "warning" | "info";

const SEVERITY_CONFIG = {
  critical: {
    icon: AlertTriangle,
    border: "border-primary",
    text: "text-primary",
    badge: "bg-primary text-white",
    label: "Critical",
  },
  warning: {
    icon: AlertCircle,
    border: "border-border",
    text: "text-primary/80",
    badge: "bg-cream text-primary border border-border",
    label: "Warning",
  },
  info: {
    icon: Info,
    border: "border-border",
    text: "text-muted",
    badge: "bg-cream text-muted border border-border",
    label: "Info",
  },
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AlertLog() {
  const { alerts, fetchStatus, isLoading } = useFleetStore();
  const [filter, setFilter] = useState<SeverityFilter>("all");
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (alerts.length === 0) fetchStatus();
  }, [alerts.length, fetchStatus]);

  const filtered =
    filter === "all" ? alerts : alerts.filter((a) => a.severity === filter);

  const counts = {
    all: alerts.length,
    critical: alerts.filter((a) => a.severity === "critical").length,
    warning: alerts.filter((a) => a.severity === "warning").length,
    info: alerts.filter((a) => a.severity === "info").length,
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchStatus();
    setRefreshing(false);
  };

  return (
    <div className="min-h-screen bg-cream">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-white border-b border-border">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link
            href="/"
            className="p-2 rounded-lg text-muted hover:text-primary hover:bg-cream transition-colors"
            aria-label="Back to dashboard"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex items-center gap-2.5">
            <Bell className="h-5 w-5 text-primary" />
            <h1 className="font-editorial text-lg font-bold text-primary">
              Alert History
            </h1>
            {counts.critical > 0 && (
              <span className="text-[10px] bg-primary text-white rounded-full px-1.5 py-0.5 font-bold">
                {counts.critical}
              </span>
            )}
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing || isLoading}
            className="ml-auto p-2 rounded-lg text-muted hover:text-primary hover:bg-cream transition-colors disabled:opacity-50"
            aria-label="Refresh alerts"
          >
            <RefreshCw
              className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
            />
          </button>
        </div>
      </header>

      {/* Hatch divider */}
      <div className="hatch-divider" />

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {(["all", "critical", "warning", "info"] as const).map((sev) => {
            const active = filter === sev;
            return (
              <button
                key={sev}
                onClick={() => setFilter(sev)}
                className={`
                  relative p-3.5 rounded-lg border text-left transition-all
                  ${
                    active
                      ? "border-primary bg-primary/5"
                      : "border-border bg-white hover:bg-cream"
                  }
                `}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  {sev === "all" ? (
                    <Filter className="h-4 w-4 text-muted" />
                  ) : (
                    (() => {
                      const Icon = SEVERITY_CONFIG[sev].icon;
                      return <Icon className={`h-4 w-4 ${active ? "text-primary" : "text-muted"}`} />;
                    })()
                  )}
                  <span className="text-[10px] font-semibold text-muted uppercase tracking-wider">
                    {sev}
                  </span>
                </div>
                <span className={`text-2xl font-bold ${active ? "text-primary" : "text-primary/60"}`}>
                  {counts[sev]}
                </span>
              </button>
            );
          })}
        </div>

        {/* Alert List */}
        <div className="space-y-2" role="log" aria-label="Alert history">
          <AnimatePresence mode="popLayout">
            {filtered.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-16"
              >
                <Truck className="h-12 w-12 mx-auto text-border mb-3" />
                <p className="text-muted text-sm">
                  {filter === "all"
                    ? "No alerts yet — fleet is running smooth"
                    : `No ${filter} alerts`}
                </p>
              </motion.div>
            ) : (
              filtered.map((alert, i) => {
                const config = SEVERITY_CONFIG[alert.severity];
                const Icon = config.icon;

                return (
                  <motion.div
                    key={alert.id}
                    layout
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: i * 0.03, duration: 0.25 }}
                    className={`flex items-start gap-3 p-4 rounded-lg border ${config.border} bg-white transition-colors`}
                  >
                    {/* Severity indicator */}
                    <div className="shrink-0 mt-0.5">
                      <Icon className={`h-5 w-5 ${config.text}`} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${config.badge}`}
                        >
                          {alert.severity}
                        </span>
                        {alert.vehicleId && (
                          <span className="text-[10px] text-muted font-mono">
                            {alert.vehicleId}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-primary/80 leading-relaxed">
                        {alert.message}
                      </p>
                    </div>

                    {/* Timestamp */}
                    <div className="shrink-0 flex items-center gap-1 text-muted">
                      <Clock className="h-3 w-3" />
                      <span className="text-[11px] whitespace-nowrap">
                        {formatTime(alert.timestamp)}
                      </span>
                    </div>
                  </motion.div>
                );
              })
            )}
          </AnimatePresence>
        </div>

        {/* Footer hint */}
        {alerts.length > 0 && (
          <p className="text-center text-xs text-muted pb-4">
            Showing latest {filtered.length} of {alerts.length} alerts ·
            Auto-refreshes every 60s
          </p>
        )}
      </div>
    </div>
  );
}
