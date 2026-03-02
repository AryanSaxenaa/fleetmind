import { NextResponse } from "next/server";
import { getRecentGPSTraces } from "@/lib/tools/gps-traces";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const hours = parseInt(url.searchParams.get("hours") || "6", 10);
    const maxPointsPerVehicle = parseInt(
      url.searchParams.get("maxPointsPerVehicle") || "200",
      10
    );
    const data = await getRecentGPSTraces(hours, maxPointsPerVehicle);
    return NextResponse.json(data);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("gps-traces error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
