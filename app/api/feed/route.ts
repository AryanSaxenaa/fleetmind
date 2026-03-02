import { NextResponse } from "next/server";
import { geotabGet, geotabGetFeed } from "@/lib/geotab";

let exceptionsVersion: string | undefined;
let statusVersion: string | undefined;

export async function GET() {
  try {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

    const [exceptions, statuses, logRecords] = await Promise.all([
      geotabGetFeed<any>("ExceptionEvent", exceptionsVersion, {}, 500),
      geotabGetFeed<any>("DeviceStatusInfo", statusVersion, {}, 500),
      geotabGet("LogRecord", {
        fromDate: tenMinutesAgo,
        resultsLimit: 500,
      }),
    ]);

    // Persist feed versions for incremental polling
    // The feed response may be { data, toVersion } or just an array; handle both shapes.
    const exceptionData = (exceptions as any)?.data ?? exceptions ?? [];
    const statusData = (statuses as any)?.data ?? statuses ?? [];
    exceptionsVersion = (exceptions as any)?.toVersion ?? exceptionsVersion;
    statusVersion = (statuses as any)?.toVersion ?? statusVersion;

    return NextResponse.json({
      exceptions: exceptionData,
      statuses: statusData,
      logRecords,
      toVersion: {
        exceptions: exceptionsVersion,
        statuses: statusVersion,
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("feed error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
