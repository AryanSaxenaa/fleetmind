import { NextResponse } from "next/server";
import { geotabGet, geotabGetFeed } from "@/lib/geotab";

let exceptionsVersion: string | undefined;
let statusVersion: string | undefined;

// Server-side cache - prevents hammering Geotab when multiple requests arrive
// in the same 30-second window (page navigations, React strict-mode, etc.)
const FEED_CACHE_TTL_MS = 30_000;
let cachedFeedResponse: any = null;
let cachedFeedAt = 0;
let feedInflight: Promise<any> | null = null;

async function fetchFeedFromGeotab() {
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

  const [exceptions, statuses, logRecords] = await Promise.all([
    geotabGetFeed<any>("ExceptionEvent", exceptionsVersion, {}, 500),
    geotabGetFeed<any>("DeviceStatusInfo", statusVersion, {}, 500),
    geotabGet("LogRecord", { fromDate: tenMinutesAgo, resultsLimit: 500 }),
  ]);

  const exceptionData = (exceptions as any)?.data ?? exceptions ?? [];
  const statusData = (statuses as any)?.data ?? statuses ?? [];
  exceptionsVersion = (exceptions as any)?.toVersion ?? exceptionsVersion;
  statusVersion = (statuses as any)?.toVersion ?? statusVersion;

  return {
    exceptions: exceptionData,
    statuses: statusData,
    logRecords,
    toVersion: { exceptions: exceptionsVersion, statuses: statusVersion },
  };
}

export async function GET() {
  // Serve cached response if still fresh
  if (cachedFeedResponse && Date.now() - cachedFeedAt < FEED_CACHE_TTL_MS) {
    return NextResponse.json(cachedFeedResponse);
  }

  // Deduplicate concurrent in-flight requests
  if (feedInflight === null) {
    feedInflight = fetchFeedFromGeotab().then(
      (result) => {
        cachedFeedResponse = result;
        cachedFeedAt = Date.now();
        feedInflight = null;
        return result;
      },
      (err) => {
        feedInflight = null;
        throw err;
      }
    );
  }

  try {
    const result = await feedInflight;
    return NextResponse.json(result);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("feed error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
