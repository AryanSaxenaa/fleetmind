import { NextResponse } from "next/server";
import {
  createGeofenceCircle,
  deleteGeofence,
  listGeofences,
} from "@/lib/tools/geofence";

export async function GET() {
  try {
    const zones = await listGeofences(200);
    return NextResponse.json({ zones });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("geofence list error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, latitude, longitude, radiusMeters } = body || {};
    if (typeof latitude !== "number" || typeof longitude !== "number" || !name) {
      return NextResponse.json(
        { error: "name, latitude, and longitude are required" },
        { status: 400 }
      );
    }
    const result = await createGeofenceCircle({ name, latitude, longitude, radiusMeters });
    return NextResponse.json(result);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("geofence create error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const body = await req.json();
    const { zoneId } = body || {};
    if (!zoneId) {
      return NextResponse.json({ error: "zoneId is required" }, { status: 400 });
    }
    await deleteGeofence(zoneId);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("geofence delete error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
