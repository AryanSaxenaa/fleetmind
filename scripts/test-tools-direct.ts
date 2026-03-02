/**
 * Direct tool test — bypass chat route, call tools directly
 * Run: pnpm tsx scripts/test-tools-direct.ts
 */
import { readFileSync } from "fs";
import { resolve } from "path";

// Load .env.local
const envPath = resolve(process.cwd(), ".env.local");
try {
  const envContent = readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
} catch {
  console.error("Could not read .env.local");
  process.exit(1);
}

const PASS = "\x1b[32m✓ PASS\x1b[0m";
const FAIL = "\x1b[31m✗ FAIL\x1b[0m";

async function testGeotabRaw() {
  console.log("\n── Raw Geotab API test ──");
  const server = process.env.GEOTAB_SERVER || "my.geotab.com";
  
  // Authenticate
  const authRes = await fetch(`https://${server}/apiv1`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      method: "Authenticate",
      params: {
        database: process.env.GEOTAB_DATABASE,
        userName: process.env.GEOTAB_USERNAME,
        password: process.env.GEOTAB_PASSWORD,
      },
    }),
  });
  const authData = await authRes.json();
  if (authData.error) {
    console.log(`${FAIL} Auth: ${authData.error.message}`);
    return;
  }
  console.log(`${PASS} Authenticated`);
  const creds = authData.result.credentials;

  // Test DeviceStatusInfo
  console.log("\n  Testing DeviceStatusInfo...");
  const statusRes = await fetch(`https://${server}/apiv1`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      method: "Get",
      params: { typeName: "DeviceStatusInfo", credentials: creds, resultsLimit: 5 },
    }),
  });
  const statusData = await statusRes.json();
  if (statusData.error) {
    console.log(`${FAIL} DeviceStatusInfo: ${statusData.error.message}`);
  } else {
    const items = statusData.result || [];
    console.log(`${PASS} DeviceStatusInfo: ${items.length} results`);
    if (items[0]) {
      console.log(`  Sample keys: ${Object.keys(items[0]).join(", ")}`);
      console.log(`  dateTime: ${items[0].dateTime}, isDriving: ${items[0].isDriving}, speed: ${items[0].speed}`);
    }
  }

  // Test Device
  console.log("\n  Testing Device...");
  const devRes = await fetch(`https://${server}/apiv1`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      method: "Get",
      params: { typeName: "Device", credentials: creds, resultsLimit: 5 },
    }),
  });
  const devData = await devRes.json();
  if (devData.error) {
    console.log(`${FAIL} Device: ${devData.error.message}`);
  } else {
    const items = devData.result || [];
    console.log(`${PASS} Device: ${items.length} results`);
    if (items[0]) console.log(`  Sample: id=${items[0].id}, name=${items[0].name}`);
  }

  // Test ExceptionEvent (last 7 days)
  console.log("\n  Testing ExceptionEvent...");
  const fromDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const excRes = await fetch(`https://${server}/apiv1`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      method: "Get",
      params: {
        typeName: "ExceptionEvent",
        credentials: creds,
        resultsLimit: 10,
        search: { fromDate },
      },
    }),
  });
  const excData = await excRes.json();
  if (excData.error) {
    console.log(`${FAIL} ExceptionEvent: ${excData.error.message}`);
  } else {
    const items = excData.result || [];
    console.log(`${PASS} ExceptionEvent: ${items.length} results`);
    if (items[0]) {
      console.log(`  Sample: rule=${JSON.stringify(items[0].rule)}, device=${JSON.stringify(items[0].device)}`);
    }
  }

  // Test Trip
  console.log("\n  Testing Trip...");
  const tripRes = await fetch(`https://${server}/apiv1`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      method: "Get",
      params: {
        typeName: "Trip",
        credentials: creds,
        resultsLimit: 5,
        search: { fromDate },
      },
    }),
  });
  const tripData = await tripRes.json();
  if (tripData.error) {
    console.log(`${FAIL} Trip: ${tripData.error.message}`);
  } else {
    const items = tripData.result || [];
    console.log(`${PASS} Trip: ${items.length} results`);
    if (items[0]) {
      console.log(`  Sample keys: ${Object.keys(items[0]).join(", ")}`);
      console.log(`  distance: ${items[0].distance}, idlingDuration: ${items[0].idlingDuration}, drivingDuration: ${items[0].drivingDuration}`);
    }
  }
}

testGeotabRaw().catch(err => console.error("Fatal:", err));
