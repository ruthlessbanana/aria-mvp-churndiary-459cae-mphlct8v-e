"use strict";
const fs = require("fs");
const path = require("path");

const dir = process.env.ARIA_AUDIT_DIR || "";
const extStr = process.env.ARIA_AUDIT_EXT || "";
if (!dir) {
  console.error("list-files.cjs requires ARIA_AUDIT_DIR env var");
  process.exit(2);
}
const exts = extStr ? new Set(extStr.split(",").map(function (e) { return e.trim(); })) : null;

const SKIP_DIRS = new Set(["node_modules", ".next", ".git", "dist", ".vercel", ".turbo", "coverage"]);
const matches = [];

function walk(d) {
  let entries;
  try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(d, entry.name);
    if (entry.isDirectory()) { walk(full); continue; }
    if (!entry.isFile()) continue;
    if (exts && !exts.has(path.extname(entry.name))) continue;
    matches.push(full.split(path.sep).join("/"));
    if (matches.length >= 1000) break;
  }
}

if (fs.existsSync(dir)) walk(dir);
process.stdout.write(matches.join("\n") + (matches.length > 0 ? "\n" : ""));
