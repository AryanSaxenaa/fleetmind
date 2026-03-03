import { NextResponse } from "next/server";
import { getFleetStatus } from "@/lib/tools/fleet-status";

// Server-side cache for fleet status (30s TTL)
const STATUS_CACHE_TTL_MS = 30_000;
let cachedStatusResponse: any = null;
let cachedStatusAt = 0;
let statusInflight: Promise<any> | null = null;

export async function GET() {
  if (cachedStatusResponse && Date.now() - cachedStatusAt < STATUS_CACHE_TTL_MS) {
    return NextResponse.json(cachedStatusResponse);
  }

  if (!statusInflight) {
    statusInflight = getFleetStatus().then(
      (result) => {
        cachedStatusResponse = result;
        cachedStatusAt = Date.now();
        statusInflight = null;
        return result;
      },
      (err) => {
        statusInflight = null;
        throw err;
      }
    );
  }

  try {
    const status = await statusInflight;
    return NextResponse.json(status);
  } catch (error) {
    console.error("Fleet status error:", error);
    return NextResponse.json(
      {
        active: 0,
        stopped: 0,
        idling: 0,
        offline: 0,
        total: 0,
        timestamp: new Date().toISOString(),
        error: "Failed to fetch fleet status",
      },
      { status: 500 }
    );
  }
}
