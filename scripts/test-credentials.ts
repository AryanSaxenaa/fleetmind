/**
 * Quick credential validation script.
 * Run: pnpm tsx scripts/test-credentials.ts
 */
import { readFileSync } from "fs";
import { resolve } from "path";

// Load .env.local manually (no dotenv dependency)
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

async function testGeotab() {
  console.log("\n── Geotab API ──");
  const { GEOTAB_USERNAME, GEOTAB_PASSWORD, GEOTAB_DATABASE, GEOTAB_SERVER } =
    process.env;

  if (!GEOTAB_USERNAME || !GEOTAB_PASSWORD || !GEOTAB_DATABASE) {
    console.log(`${FAIL} Missing Geotab credentials in .env.local`);
    return false;
  }

  console.log(`  Database: ${GEOTAB_DATABASE}`);
  console.log(`  Username: ${GEOTAB_USERNAME}`);
  console.log(`  Server:   ${GEOTAB_SERVER || "my.geotab.com"}`);

  try {
    // Use raw JSON-RPC instead of mg-api-js to avoid module resolution
    const server = GEOTAB_SERVER || "my.geotab.com";
    const authRes = await fetch(`https://${server}/apiv1`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        method: "Authenticate",
        params: {
          database: GEOTAB_DATABASE,
          userName: GEOTAB_USERNAME,
          password: GEOTAB_PASSWORD,
        },
      }),
    });

    const authData = await authRes.json();

    if (authData.error) {
      console.log(`${FAIL} Authentication failed: ${authData.error.message}`);
      return false;
    }

    const sessionId = authData.result?.credentials?.sessionId;
    if (!sessionId) {
      console.log(`${FAIL} No session ID returned`);
      console.log("  Response:", JSON.stringify(authData).slice(0, 200));
      return false;
    }

    console.log(`${PASS} Authenticated (session: ${sessionId.slice(0, 12)}...)`);

    // Test a simple Get call
    const devRes = await fetch(`https://${server}/apiv1`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        method: "Get",
        params: {
          typeName: "Device",
          credentials: authData.result.credentials,
          resultsLimit: 5,
        },
      }),
    });

    const devData = await devRes.json();

    if (devData.error) {
      console.log(`${FAIL} Get Device failed: ${devData.error.message}`);
      return false;
    }

    const devices = devData.result || [];
    console.log(`${PASS} Fetched ${devices.length} devices`);
    if (devices.length > 0) {
      console.log(`  Sample: ${devices[0].name || devices[0].id}`);
    }

    return true;
  } catch (err: any) {
    console.log(`${FAIL} Network error: ${err.message}`);
    return false;
  }
}

async function testGemini() {
  console.log("\n── Google Gemini API ──");
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

  if (!apiKey) {
    console.log(`${FAIL} Missing GOOGLE_GENERATIVE_AI_API_KEY in .env.local`);
    return false;
  }

  console.log(`  Key: ${apiKey.slice(0, 10)}...${apiKey.slice(-4)}`);

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: "Reply with exactly: GEMINI_OK" }],
            },
          ],
        }),
      }
    );

    if (!res.ok) {
      const errBody = await res.text();
      console.log(`${FAIL} HTTP ${res.status}: ${errBody.slice(0, 200)}`);
      return false;
    }

    const data = await res.json();
    const text =
      data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";

    if (text.includes("GEMINI_OK")) {
      console.log(`${PASS} Gemini responded: "${text}"`);
      return true;
    } else {
      console.log(`${PASS} Gemini responded (unexpected text): "${text.slice(0, 100)}"`);
      return true; // Still a valid response
    }
  } catch (err: any) {
    console.log(`${FAIL} Network error: ${err.message}`);
    return false;
  }
}

async function main() {
  console.log("╔══════════════════════════════════════╗");
  console.log("║   FleetMind Credential Validator     ║");
  console.log("╚══════════════════════════════════════╝");

  const geotabOk = await testGeotab();
  const geminiOk = await testGemini();

  console.log("\n── Summary ──");
  console.log(`  Geotab API:  ${geotabOk ? PASS : FAIL}`);
  console.log(`  Gemini API:  ${geminiOk ? PASS : FAIL}`);

  if (geotabOk && geminiOk) {
    console.log("\n🚀 All credentials valid — ready for Phase 2!\n");
  } else {
    console.log("\n⚠️  Fix the failing credentials before proceeding.\n");
    process.exit(1);
  }
}

main();
