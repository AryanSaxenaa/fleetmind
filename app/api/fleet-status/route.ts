import { NextResponse } from "next/server";
import { getFleetStatus } from "@/lib/tools/fleet-status";

export async function GET() {
  try {
    const status = await getFleetStatus();
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
