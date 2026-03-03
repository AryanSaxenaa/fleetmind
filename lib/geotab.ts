/**
 * Geotab API client — direct JSON-RPC over fetch.
 * We bypass mg-api-js for reliability with Next.js server components.
 */

interface GeotabCredentials {
  database: string;
  sessionId: string;
  userName: string;
}

let cachedCredentials: GeotabCredentials | null = null;
let cachedServer: string = "my.geotab.com";
let authPromise: Promise<{ credentials: GeotabCredentials; server: string }> | null = null;

export async function getGeotabCredentials(): Promise<{
  credentials: GeotabCredentials;
  server: string;
}> {
  if (cachedCredentials) {
    return { credentials: cachedCredentials, server: cachedServer };
  }
  // Serialize concurrent auth requests so we don't hammer the Geotab auth endpoint
  // if multiple requests arrive simultaneously on a cold start.
  if (authPromise) return authPromise;
  authPromise = _doAuthenticate().finally(() => { authPromise = null; });
  return authPromise;
}

async function _doAuthenticate(): Promise<{
  credentials: GeotabCredentials;
  server: string;
}> {
  if (cachedCredentials) {
    return { credentials: cachedCredentials, server: cachedServer };
  }

  const username = process.env.GEOTAB_USERNAME;
  const password = process.env.GEOTAB_PASSWORD;
  const database = process.env.GEOTAB_DATABASE;
  const server = process.env.GEOTAB_SERVER || "my.geotab.com";

  if (!username || !password || !database) {
    throw new Error(
      "Missing Geotab credentials. Set GEOTAB_USERNAME, GEOTAB_PASSWORD, and GEOTAB_DATABASE in .env.local"
    );
  }

  const res = await fetch(`https://${server}/apiv1`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      method: "Authenticate",
      params: { database, userName: username, password },
    }),
  });

  const data = await res.json();
  if (data.error) {
    throw new Error(`Geotab auth failed: ${data.error.message}`);
  }

  cachedCredentials = data.result.credentials;
  // Only use the returned path if it looks like a real hostname (contains a dot)
  const returnedPath = data.result.path;
  if (returnedPath && returnedPath.includes(".")) {
    cachedServer = returnedPath.startsWith("http") ? new URL(returnedPath).hostname : returnedPath;
  } else {
    cachedServer = server;
  }
  return { credentials: cachedCredentials!, server: cachedServer };
}

async function geotabCallRaw<T = any>(
  method: "Get" | "Add" | "Set" | "Remove" | "GetFeed",
  params: Record<string, any>,
  serverOverride?: string
): Promise<T> {
  const { credentials, server } = await getGeotabCredentials();
  const targetServer = serverOverride || server;

  const res = await fetch(`https://${targetServer}/apiv1`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      method,
      params: {
        credentials,
        ...params,
      },
    }),
  });

  const data = await res.json();
  if (data.error) {
    // Session expired — retry once (only for session/token errors, NOT for wrong credentials)
    const errMsg: string = data.error.message || "";
    const isSessionExpiry =
      errMsg.toLowerCase().includes("session") ||
      errMsg.includes("TokenExpired") ||
      errMsg.includes("InvalidUserException") ||
      (errMsg.includes("Incorrect login") && cachedCredentials !== null);
    if (isSessionExpiry) {
      cachedCredentials = null;
      const fresh = await getGeotabCredentials();
      const retryRes = await fetch(`https://${serverOverride || fresh.server}/apiv1`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method,
          params: {
            credentials: fresh.credentials,
            ...params,
          },
        }),
      });
      const retryData = await retryRes.json();
      if (retryData.error) throw new Error(`Geotab API error: ${retryData.error.message}`);
      return retryData.result as T;
    }
    throw new Error(`Geotab API error: ${data.error.message}`);
  }

  return data.result as T;
}

// Helper: fetch with date range and limit
export async function geotabGet<T = any>(
  typeName: string,
  options?: {
    resultsLimit?: number;
    fromDate?: Date;
    toDate?: Date;
    search?: Record<string, any>;
  }
): Promise<T[]> {
  const search: Record<string, any> = { ...options?.search };
  if (options?.fromDate) search.fromDate = options.fromDate.toISOString();
  if (options?.toDate) search.toDate = options.toDate.toISOString();

  return geotabCallRaw<T[]>("Get", {
    typeName,
    resultsLimit: options?.resultsLimit ?? 50,
    ...(Object.keys(search).length > 0 ? { search } : {}),
  });
}

export async function geotabAdd<T = any>(
  typeName: string,
  entity: Record<string, any>
): Promise<T> {
  return geotabCallRaw<T>("Add", { typeName, entity });
}

export async function geotabSet<T = any>(
  typeName: string,
  entity: Record<string, any>
): Promise<T> {
  return geotabCallRaw<T>("Set", { typeName, entity });
}

export async function geotabRemove<T = any>(
  typeName: string,
  entity: Record<string, any>
): Promise<T> {
  return geotabCallRaw<T>("Remove", { typeName, entity });
}

export async function geotabGetFeed<T = any>(
  typeName: string,
  fromVersion?: string,
  search?: Record<string, any>,
  resultsLimit: number = 500
): Promise<T> {
  const searchPayload: Record<string, any> = { ...(search || {}) };
  return geotabCallRaw<T>("GetFeed", {
    typeName,
    fromVersion,
    resultsLimit,
    ...(Object.keys(searchPayload).length ? { search: searchPayload } : {}),
  });
}

// Batch multiple calls in one HTTP request
export async function geotabMultiCall<T = any>(
  calls: Array<{ method: string; params: Record<string, any> }>
): Promise<T[]> {
  const { credentials, server } = await getGeotabCredentials();
  const invokeSingle = async (call: { method: string; params: Record<string, any> }) => {
    const res = await fetch(`https://${server}/apiv1`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method: call.method, params: { credentials, ...call.params } }),
    });
    const data = await res.json();
    if (data.error) throw new Error(`Geotab API error: ${data.error.message}`);
    return data.result as T;
  };

  const res = await fetch(`https://${server}/apiv1`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ method: "MultiCall", params: { calls, credentials } }),
  });

  const data = await res.json();

  // Fallback for servers that do not expose MultiCall
  if (data?.error && /MultiCall/i.test(data.error.message || "")) {
    const results: T[] = [];
    for (const call of calls) {
      results.push(await invokeSingle(call));
    }
    return results;
  }

  if (data.error) throw new Error(`Geotab MultiCall error: ${data.error.message}`);
  return data.result as T[];
}

// Helper: time ranges
export function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}
