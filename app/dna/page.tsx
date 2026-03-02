"use client";

import { useState } from "react";
import { DriverDNAGrid } from "@/components/dna/DriverDNAGrid";
import type { DNAProfile } from "@/lib/tools/driver-dna";
import { Sparkles, ArrowLeft, RefreshCw, AlertTriangle, Image } from "lucide-react";
import Link from "next/link";

export default function DNAPage() {
  const [profiles, setProfiles] = useState<DNAProfile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDNA = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/driver-dna");
      if (!res.ok) throw new Error("Failed to load DNA profiles");
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setProfiles(data.profiles || []);
      setHasLoaded(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-cream">
      {/* Header */}
      <header className="h-14 bg-white border-b border-border flex items-center px-6 sticky top-0 z-20">
        <Link
          href="/"
          className="flex items-center gap-2 text-muted hover:text-primary transition-colors mr-4"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="text-sm font-medium">Back</span>
        </Link>
        <div className="hatch-divider w-px h-6 mx-2" style={{ width: 1, height: 24 }} />
        <div className="flex items-center gap-2.5">
          <Sparkles className="h-5 w-5 text-primary" />
          <span className="font-editorial text-lg font-bold text-primary">
            Driver DNA
          </span>
          <span className="text-muted text-sm font-medium ml-1">
            Personality Profiles
          </span>
        </div>
        <button
          onClick={loadDNA}
          disabled={isLoading}
          className="ml-auto flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-dark disabled:opacity-50 transition-colors"
        >
          <RefreshCw
            className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
          />
          {hasLoaded ? "Refresh" : "Generate Profiles"}
        </button>
      </header>

      {/* Hatch divider */}
      <div className="hatch-divider" />

      {/* Content */}
      <main className="max-w-7xl mx-auto p-6">
        {error && (
          <div className="flex items-center gap-3 p-4 mb-6 border border-border rounded-lg bg-white">
            <AlertTriangle className="h-5 w-5 text-primary shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-primary">
                Failed to load profiles
              </p>
              <p className="text-xs text-muted mt-0.5">{error}</p>
            </div>
            <button
              onClick={loadDNA}
              className="px-3 py-1.5 text-xs font-semibold text-primary border border-border hover:bg-cream rounded-lg transition-colors"
            >
              Retry
            </button>
          </div>
        )}
        {!hasLoaded && !isLoading && !error ? (
          <div className="text-center py-20">
            {/* Illustration placeholder */}
            <div className="w-32 h-32 mx-auto mb-6 illustration-placeholder rounded-lg">
              <Image className="h-8 w-8 opacity-40" />
            </div>
            <h2 className="font-editorial text-2xl font-bold text-primary mb-2">
              Driver DNA Profiles
            </h2>
            <p className="text-muted text-sm max-w-md mx-auto mb-6 leading-relaxed">
              Generate Spotify Wrapped-style personality profiles for your
              drivers. Each profile reveals their driving DNA across 5
              dimensions.
            </p>
            <button
              onClick={loadDNA}
              className="px-6 py-3 rounded-lg bg-primary text-white font-semibold hover:bg-dark transition-colors"
            >
              Generate Driver DNA
            </button>
          </div>
        ) : (
          <DriverDNAGrid profiles={profiles} isLoading={isLoading} />
        )}
      </main>
    </div>
  );
}
