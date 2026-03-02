"use client";

import { motion } from "framer-motion";
import { RadarChart } from "./RadarChart";
import { TrendingUp, TrendingDown, Minus, Dna } from "lucide-react";
import type { DNAProfile } from "@/lib/tools/driver-dna";

const trendConfig = {
  improving: { icon: TrendingUp, label: "Improving" },
  stable: { icon: Minus, label: "Stable" },
  declining: { icon: TrendingDown, label: "Declining" },
};

interface DriverDNACardProps {
  driver: DNAProfile;
  index: number;
}

export function DriverDNACard({ driver, index }: DriverDNACardProps) {
  const trend = trendConfig[driver.trend];
  const TrendIcon = trend.icon;
  const compositeScore = Math.round(
    Object.values(driver.scores).reduce((a, b) => a + b, 0) / 5
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 40, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: index * 0.15, duration: 0.5, ease: "easeOut" }}
      className="rounded-lg border border-border bg-white p-5 flex flex-col gap-3 relative overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-cream border border-border">
            <Dna className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-primary font-semibold text-sm leading-tight">
              {driver.name}
            </p>
            <p className="font-editorial text-xl font-bold text-primary leading-none mt-1">
              {driver.archetype}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 text-xs border border-border rounded-lg px-2 py-1">
          <TrendIcon className="h-3.5 w-3.5 text-primary/60" />
          <span className="text-muted text-[11px]">{trend.label}</span>
        </div>
      </div>

      {/* Hatched divider */}
      <div className="hatch-divider" />

      {/* Radar Chart */}
      <div className="flex justify-center -my-1">
        <RadarChart scores={driver.scores} color="#1a1a1a" size={180} />
      </div>

      {/* Composite Score */}
      <div className="flex items-center justify-center gap-2">
        <div className="text-3xl font-bold text-primary">{compositeScore}</div>
        <span className="text-xs text-muted">/100 overall</span>
      </div>

      {/* Score Bars */}
      <div className="grid grid-cols-5 gap-1.5">
        {(
          Object.entries(driver.scores) as [string, number][]
        ).map(([key, val]) => (
          <div key={key} className="text-center">
            <div className="h-1.5 rounded-full bg-cream overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${val}%` }}
                transition={{ delay: index * 0.15 + 0.3, duration: 0.6 }}
                className="h-full rounded-full bg-primary"
              />
            </div>
            <span className="text-[9px] text-muted mt-1 capitalize font-medium">
              {key.slice(0, 4)}
            </span>
          </div>
        ))}
      </div>

      {/* Strength Summary */}
      <p className="text-sm text-primary/80 leading-relaxed italic">
        &ldquo;{driver.strengthSummary}&rdquo;
      </p>

      {/* Coaching Tip */}
      <div className="bg-cream border border-border rounded-lg p-3">
        <p className="text-[10px] text-muted uppercase tracking-wider mb-1 font-semibold">
          Coaching Tip
        </p>
        <p className="text-xs text-primary/80 leading-relaxed">
          {driver.coachingTip}
        </p>
      </div>
    </motion.div>
  );
}
