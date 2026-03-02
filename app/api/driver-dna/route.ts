import { NextResponse } from "next/server";
import { getDriverDNA } from "@/lib/tools/driver-dna";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const top = parseInt(url.searchParams.get("top") || "5", 10);
    const result = await getDriverDNA(top);
    return NextResponse.json(result);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("Driver DNA error:", error);
    return NextResponse.json(
      { error: msg, profiles: [] },
      { status: 500 }
    );
  }
}
