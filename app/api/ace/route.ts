import { NextResponse } from "next/server";
import { queryAce } from "@/lib/ace";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { prompt } = body || {};
    if (!prompt) {
      return NextResponse.json({ error: "prompt is required" }, { status: 400 });
    }
    const data = await queryAce(prompt);
    return NextResponse.json(data);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("ace query error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
