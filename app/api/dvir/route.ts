import { NextResponse } from "next/server";
import { getDVIRSummary } from "@/lib/tools/dvir";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const periodDays = parseInt(url.searchParams.get("periodDays") || "7", 10);
    const data = await getDVIRSummary(periodDays);
    return NextResponse.json(data);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("dvir error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
