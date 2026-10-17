#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { matchErrors } from "./explain.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

let failures = 0;
function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    failures++;
  }
}

const dataPath = path.join(rootDir, "data", "errors.json");
const catalog = JSON.parse(fs.readFileSync(dataPath, "utf8"));

assert(Array.isArray(catalog.errors) && catalog.errors.length >= 18, `Expected at least 18 error entries, got ${catalog.errors?.length}`);

const ids = new Set();
for (const entry of catalog.errors) {
  assert(entry.id && !ids.has(entry.id), `Duplicate or missing error id: ${entry.id}`);
  ids.add(entry.id);
  assert(entry.title && entry.root_cause && entry.funds_at_risk, `Missing core fields on ${entry.id}`);
  assert(Array.isArray(entry.exact_strings) && entry.exact_strings.length > 0, `Missing exact_strings on ${entry.id}`);
  assert(Array.isArray(entry.fix_steps) && entry.fix_steps.length >= 2, `Expected at least 2 fix_steps on ${entry.id}`);

  // Verify every entry's primary exact string resolves back to itself as top match
  const top = matchErrors(entry.exact_strings[0], catalog.errors)[0];
  assert(top && top.id === entry.id, `Query "${entry.exact_strings[0]}" did not rank ${entry.id} first (got ${top?.id})`);
}

for (const svg of ["hero-banner.svg", "10-block-lock-explained.svg", "missing-balance-decision-tree.svg"]) {
  const svgPath = path.join(rootDir, "assets", svg);
  assert(fs.existsSync(svgPath), `Missing SVG asset: assets/${svg}`);
  const text = fs.readFileSync(svgPath, "utf8");
  assert(text.includes("<svg") && text.includes("</svg>"), `Malformed SVG in assets/${svg}`);
}

const demoPath = path.join(rootDir, "demo", "index.html");
assert(fs.existsSync(demoPath), "Missing interactive demo/index.html");

if (failures > 0) {
  console.error(`\nValidation failed with ${failures} error(s).`);
  process.exit(1);
}

console.log(`OK: Verified ${catalog.errors.length} Monero error definitions, search ranking accuracy, interactive HTML demo, and 3 SVG diagrams.`);
