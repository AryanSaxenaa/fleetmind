/**
 * Phase 2 Acceptance Tests — exercises all tools via /api/chat
 * Run: pnpm tsx scripts/test-phase2.ts
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
}

const PASS = "\x1b[32m✓ PASS\x1b[0m";
const FAIL = "\x1b[31m✗ FAIL\x1b[0m";
const BASE = "http://localhost:3000";

interface TestCase {
  id: string;
  query: string;
  expectKeywords: string[];
  description: string;
}

const tests: TestCase[] = [
  {
    id: "2.1",
    query: "Who are my worst drivers this week?",
    expectKeywords: ["score", "braking", "Demo"],
    description: "Ranked list with names + coaching notes",
  },
  {
    id: "2.2",
    query: "Any fuel waste this week?",
    expectKeywords: ["idle", "$", "waste"],
    description: "Vehicles flagged with $ amount",
  },
  {
    id: "2.3",
    query: "What maintenance is overdue?",
    expectKeywords: ["CRITICAL", "DUE", "km"],
    description: "Priority queue with CRITICAL/DUE/UPCOMING",
  },
  {
    id: "2.4",
    query: "Give me a morning briefing for today",
    expectKeywords: ["morning", "1.", "2.", "3."],
    description: "Full narrative with 3 action items",
  },
  {
    id: "2.5",
    query: "Show me Driver DNA profiles for my top 5 drivers",
    expectKeywords: ["safety", "efficiency", "archetype"],
    description: "DNA profiles with radar scores and archetypes",
  },
];

async function chatQuery(query: string): Promise<string> {
  const res = await fetch(`${BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: [{ role: "user", content: query }],
    }),
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${await res.text().then(t => t.slice(0, 300))}`);
  }

  // Vercel AI SDK returns a streaming response with data protocol
  const text = await res.text();
  
  // Extract text content from the data stream
  // The stream protocol uses lines like: 0:"text chunk"
  const textParts: string[] = [];
  for (const line of text.split("\n")) {
    // Text chunks start with 0:"
    if (line.startsWith('0:"')) {
      try {
        const content = JSON.parse(line.slice(2));
        textParts.push(content);
      } catch {
        // skip malformed lines
      }
    }
  }

  return textParts.join("");
}

async function runTest(test: TestCase): Promise<boolean> {
  console.log(`\n── Test ${test.id}: ${test.description} ──`);
  console.log(`  Query: "${test.query}"`);
  
  try {
    const response = await chatQuery(test.query);
    
    if (!response || response.length < 20) {
      console.log(`${FAIL} Empty or too-short response (${response.length} chars)`);
      console.log(`  Response: "${response.slice(0, 200)}"`);
      return false;
    }

    console.log(`  Response length: ${response.length} chars`);
    console.log(`  Preview: "${response.slice(0, 150).replace(/\n/g, " ")}..."`);

    // Check for expected keywords (case-insensitive)
    const lower = response.toLowerCase();
    const missing = test.expectKeywords.filter(
      (kw) => !lower.includes(kw.toLowerCase())
    );

    if (missing.length > 0) {
      console.log(`${FAIL} Missing keywords: ${missing.join(", ")}`);
      console.log(`  (Found ${test.expectKeywords.length - missing.length}/${test.expectKeywords.length} keywords)`);
      return false;
    }

    console.log(`${PASS} All ${test.expectKeywords.length} keywords found`);
    return true;
  } catch (err: any) {
    console.log(`${FAIL} Error: ${err.message}`);
    return false;
  }
}

async function main() {
  console.log("╔══════════════════════════════════════════╗");
  console.log("║   FleetMind Phase 2 Acceptance Tests     ║");
  console.log("╚══════════════════════════════════════════╝");

  // Check server is running
  try {
    const health = await fetch(`${BASE}`);
    if (!health.ok) throw new Error(`Server returned ${health.status}`);
  } catch {
    console.error("\n✗ Dev server not running at localhost:3000. Start it first:\n  pnpm run dev\n");
    process.exit(1);
  }

  const results: { id: string; passed: boolean }[] = [];

  for (const test of tests) {
    const passed = await runTest(test);
    results.push({ id: test.id, passed });
    // Small delay between tests to avoid rate limiting
    await new Promise((r) => setTimeout(r, 2000));
  }

  console.log("\n══════════════════════════════════════════");
  console.log("  PHASE 2 RESULTS");
  console.log("══════════════════════════════════════════");
  
  for (const r of results) {
    console.log(`  ${r.id}: ${r.passed ? PASS : FAIL}`);
  }

  const passCount = results.filter((r) => r.passed).length;
  console.log(`\n  ${passCount}/${results.length} tests passed`);

  if (passCount === results.length) {
    console.log("\n🚀 Phase 2 complete — ready for Phase 3!\n");
  } else {
    console.log("\n⚠️  Some tests failed. Review the output above.\n");
    process.exit(1);
  }
}

main();
