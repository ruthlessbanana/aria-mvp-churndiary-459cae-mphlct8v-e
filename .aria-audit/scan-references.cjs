"use strict";
const fs = require("fs");
const path = require("path");

const patternStr = process.env.ARIA_AUDIT_PATTERN || "";
const dirsStr = process.env.ARIA_AUDIT_DIRS || "";
const excludeStr = process.env.ARIA_AUDIT_EXCLUDE || "";
if (!patternStr || !dirsStr) {
  console.error("scan-references.cjs requires ARIA_AUDIT_PATTERN and ARIA_AUDIT_DIRS env vars");
  process.exit(2);
}

let pattern;
let exclude = null;
try {
  pattern = new RegExp(patternStr);
  if (excludeStr) exclude = new RegExp(excludeStr);
} catch (e) {
  console.error("invalid regex:", e && e.message);
  process.exit(2);
}

const SKIP_DIRS = new Set(["node_modules", ".next", ".git", "dist", ".vercel", ".turbo", "coverage"]);
const ALLOWED_EXT = new Set([".ts", ".tsx", ".js", ".jsx", ".sql", ".json"]);
const MAX_BYTES = 1_500_000;
const matches = [];

function walk(dir) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { walk(full); continue; }
    if (!entry.isFile()) continue;
    const ext = path.extname(entry.name);
    if (!ALLOWED_EXT.has(ext)) continue;
    let stat; try { stat = fs.statSync(full); } catch { continue; }
    if (stat.size > MAX_BYTES) continue;
    let body; try { body = fs.readFileSync(full, "utf8"); } catch { continue; }
    if (!pattern.test(body)) continue;
    const normalized = full.split(path.sep).join("/");
    if (exclude && exclude.test(normalized)) continue;
    matches.push(normalized);
    if (matches.length >= 400) break;
  }
}

for (const d of dirsStr.split(",")) {
  if (!d) continue;
  if (fs.existsSync(d)) walk(d);
}

process.stdout.write(matches.join("\n") + (matches.length > 0 ? "\n" : ""));
