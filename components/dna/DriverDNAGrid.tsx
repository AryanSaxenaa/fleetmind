"use client";

import { DriverDNACard } from "./DriverDNACard";
import type { DNAProfile } from "@/lib/tools/driver-dna";
import { Dna, Loader2 } from "lucide-react";

interface DriverDNAGridProps {
  profiles: DNAProfile[];
  isLoading?: boolean;
}

export function DriverDNAGrid({ profiles, isLoading }: DriverDNAGridProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="ml-2 text-sm text-muted">
          Generating Driver DNA profiles...
        </span>
      </div>
    );
  }

  if (profiles.length === 0) {
    return (
      <div className="text-center py-12 text-muted">
        <Dna className="h-10 w-10 mx-auto mb-3 opacity-50" />
        <p className="text-sm">No Driver DNA data available yet.</p>
        <p className="text-xs mt-1">
          Ask FleetMind to &quot;Show Driver DNA&quot; to generate profiles.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {profiles.map((driver, i) => (
        <DriverDNACard key={driver.driverId} driver={driver} index={i} />
      ))}
    </div>
  );
}
