#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataPath = path.resolve(__dirname, "..", "data", "errors.json");
const catalog = JSON.parse(fs.readFileSync(dataPath, "utf8"));

export function matchErrors(query, errors = catalog.errors) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return [];

  const tokens = q.split(/[^a-z0-9_.]+/).filter((t) => t.length >= 2);

  const scored = errors.map((entry) => {
    let score = 0;
    if (entry.id.toLowerCase() === q) score += 100;
    if (entry.title.toLowerCase().includes(q)) score += 60;

    for (const exact of entry.exact_strings) {
      const exLower = exact.toLowerCase();
      if (q.includes(exLower) || exLower.includes(q)) {
        score += 80;
      }
    }

    const haystack = [
      entry.id,
      entry.title,
      entry.category,
      entry.root_cause,
      ...entry.exact_strings,
      ...entry.fix_steps,
    ]
      .join(" ")
      .toLowerCase();

    for (const tok of tokens) {
      if (haystack.includes(tok)) score += 10;
    }

    return { entry, score };
  });

  return scored
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.entry);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  const args = process.argv.slice(2);
  if (args.includes("--list") || args.includes("-l")) {
    console.log(`Monero Error Catalog (${catalog.errors.length} entries):\n`);
    for (const err of catalog.errors) {
      console.log(`  [${err.id}] (${err.category})`);
      console.log(`    ${err.title}`);
    }
    process.exit(0);
  }

  const query = args.join(" ").trim();
  if (!query) {
    console.error("Usage:");
    console.error("  node scripts/explain.mjs \"<error message or symptom>\"");
    console.error("  node scripts/explain.mjs --list");
    process.exit(1);
  }

  const matches = matchErrors(query).slice(0, 2);
  if (matches.length === 0) {
    console.log(`No matching entry found for: "${query}"`);
    console.log("Run 'node scripts/explain.mjs --list' to browse all known error IDs.");
    process.exit(1);
  }

  for (const m of matches) {
    console.log("------------------------------------------------------------");
    console.log(`ERROR      : ${m.title}`);
    console.log(`ID         : ${m.id} (${m.category})`);
    console.log(`FUNDS SAFE : ${m.funds_at_risk}`);
    console.log(`\nWHY IT HAPPENS:\n  ${m.root_cause}`);
    console.log("\nHOW TO FIX IT:");
    m.fix_steps.forEach((step, idx) => {
      console.log(`  ${idx + 1}. ${step}`);
    });
    if (m.guide_url) {
      console.log(`\nDETAILED GUIDE:\n  ${m.guide_url}`);
    }
    console.log("------------------------------------------------------------\n");
  }
}
