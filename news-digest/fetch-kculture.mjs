// Weekly "K-컬처 & 라이프" collector — Exa + RSS → raw-kculture-<date>.json.
// Does NOT need .env.local. Run: node news-digest/fetch-kculture.mjs [--dry-run] [--section=<name>]
//   --dry-run             collect a small sample, print it, write nothing
//   --section=<name>      kpop | kdrama | dating | exa | rss — partial run,
//                         never overwrites the canonical raw-kculture-<date>.json
// Exit 1 when nothing was collected (the raw json is then left untouched).
// Reddit + TikTok are added later by the weekly agent session (see kculture/README.md).
//
// mcporter output contract (from Task 3 Step 1 investigation): TEXT path.
// The exa MCP tool returns only human-readable text blocks, never structured
// search-result JSON. Forms tried (mcporter 0.13.8):
//   `mcporter call exa web_search_exa "query=korea travel" numResults=2`
//        → text blocks (Title:/URL:/Published:/Author:/Highlights:, "---" separators)
//   `... --json`   → CLI error ("--json requires a JSON object value"; it is the
//                    args-payload flag here, not an output format)
//   `... -f json`  → CLI error ("Too many positional arguments"); no such flag
//   `... --output json` → MCP envelope {content:[{type:"text",text:"<same text blocks>"}]}
//                    i.e. still the same human-readable text, just wrapped.
// Sample (plain form, first block):
//   Title: VISITKOREA - Imagine Your Korea
//   URL: https://english.visitkorea.or.kr/svc/main/index.do
//   Published: N/A
//   Author: Korea Tourism Organization, KTO
//   Highlights:

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { exec } from "node:child_process";

import Parser from "rss-parser";

import { kstDate, stripTags, purgeOldFiles } from "./_lib.mjs";

const execP = promisify(exec);

export const KOREA_REGEX = /korea|korean|한국|케이팝|k-?pop|k-?drama|hallyu|한류|kdrama/i;

const HERE = path.dirname(fileURLToPath(import.meta.url));
const KCULTURE_DIR = path.join(HERE, "kculture");

// ── date helpers ─────────────────────────────────────────────
/** ISO string or YYYYMMDD → epoch ms. Unparseable / empty → NaN. */
function toMs(dateStr) {
  if (!dateStr) return NaN;
  const ymd = /^(\d{4})(\d{2})(\d{2})$/.exec(String(dateStr));
  return ymd
    ? Date.UTC(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]))
    : Date.parse(dateStr);
}

export function withinDays(dateStr, n, now = new Date()) {
  const ms = toMs(dateStr);
  if (Number.isNaN(ms)) return false;
  return ms >= now.getTime() - n * 24 * 60 * 60 * 1000;
}

// ── Exa ──────────────────────────────────────────────────────
// exa often reports "Published: N/A" (see the sample at the top of this file).
// Those placeholders must become a real null, not the literal string, or the
// freshness check silently drops every undated result.
function normalizeExaDate(v) {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s || /^(?:n\/a|na|null|none|unknown|undefined)$/i.test(s)) return null;
  return s;
}

// TEXT PATH (Task 3 Step 1 investigation found no structured JSON output — use this):
export function parseExaOutput(text) {
  const blocks = String(text).split(/\n(?=Title:\s)/);
  const items = [];
  for (const b of blocks) {
    const title = (/^Title:\s*(.+)$/m.exec(b) || [])[1];
    const link = (/^URL(?:\s*Source)?:\s*(\S+)\s*$/m.exec(b) || [])[1];
    if (!title || !link) continue;
    const date = normalizeExaDate((/^Published(?:\s*Time)?:\s*(\S+)\s*$/m.exec(b) || [])[1]);
    const hlRaw = (/^Highlights?:\s*\n?([\s\S]*)$/m.exec(b) || [])[1] || "";
    const description = hlRaw
      .replace(/\s*\.\.\.\s*/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 400);
    items.push({ title: title.trim(), link, date, description });
  }
  return items;
}

/* JSON PATH (unused — kept for reference. Use instead if a future mcporter/exa
   build emits structured JSON search results):
export function parseExaOutput(text) {
  const data = JSON.parse(text);
  const results = data.results || data.data || [];
  return results.map((r) => ({
    title: (r.title || "").trim(),
    link: r.url || r.link || "",
    date: r.publishedDate || r.published || null,
    description: String(r.text || r.snippet || (r.highlights || []).join(" "))
      .replace(/\s+/g, " ").trim().slice(0, 400),
  })).filter((r) => r.title && r.link);
}
*/

async function defaultRunMcporter(query) {
  // query comes from sources.json (trusted, human-maintained). Shell used so the
  // Windows npm shim (mcporter.cmd) resolves.
  const q = String(query).replace(/"/g, '\\"');
  const { stdout } = await execP(
    `mcporter call exa web_search_exa "query=${q}" numResults=10`,
    { timeout: 60000, maxBuffer: 10 * 1024 * 1024 },
  );
  return stdout;
}

export async function collectExa(exaSources, { runMcporter = defaultRunMcporter, now = new Date() } = {}) {
  const items = [];
  for (const src of exaSources) {
    let raw;
    try {
      raw = await runMcporter(src.query);
    } catch (e) {
      console.warn(`  ! exa "${src.query}": ${e.message}`);
      continue;
    }
    for (const r of parseExaOutput(raw)) {
      // Undated result (exa "Published: N/A"): keep it — the weekly agent filters
      // editorially anyway, and dropping them cost us nearly the whole exa yield.
      // The Korea gate below still applies.
      if (r.date !== null && !withinDays(r.date, src.freshnessDays, now)) continue;
      if (!KOREA_REGEX.test(`${r.title} ${r.description}`)) continue;
      items.push({
        source: "exa",
        keyword: src.section,
        title: r.title,
        description: r.description,
        link: r.link,
        date: r.date,
      });
    }
  }
  return items;
}

// ── RSS ──────────────────────────────────────────────────────
export async function collectRss(rssSources, { parser = new Parser(), now = new Date() } = {}) {
  const items = [];
  for (const feed of rssSources) {
    let parsed;
    try {
      parsed = await parser.parseURL(feed.url);
    } catch (e) {
      console.warn(`  ! rss ${feed.name}: ${e.message}`);
      continue;
    }
    // Freshness and per-feed cap come from sources.json — a single busy feed
    // (soompi alone was 60 of 86 items) must not crowd out everything else.
    const fresh = [];
    for (const entry of parsed.items || []) {
      const date = entry.isoDate || entry.pubDate || null;
      if (!withinDays(date, feed.freshnessDays ?? 7, now)) continue;
      fresh.push({
        source: `rss:${feed.name}`,
        keyword: feed.section,
        title: (entry.title || "").trim(),
        description: stripTags(entry.contentSnippet || entry.content || "").slice(0, 400),
        link: entry.link || "",
        date,
      });
    }
    fresh.sort((a, b) => toMs(b.date) - toMs(a.date));
    items.push(...fresh.slice(0, feed.limit ?? Infinity));
  }
  return items;
}

// ── merge ────────────────────────────────────────────────────
export function mergeAndDedupe(itemArrays) {
  const seen = new Set();
  const out = [];
  for (const arr of itemArrays) {
    for (const it of arr) {
      if (it.link) {
        if (seen.has(it.link)) continue;
        seen.add(it.link);
      }
      out.push(it);
    }
  }
  return out;
}

// ── main ─────────────────────────────────────────────────────
const EXA_SECTIONS = ["kpop", "kdrama", "dating"];

/**
 * @param {string[]} argv  process.argv shaped
 * @param {{runMcporter?:Function, parser?:object,
 *          kcultureDir?:string, now?:Date}} deps  injected for tests
 * @returns {Promise<number>} exit code (0 ok, 1 nothing collected)
 */
export async function main(argv, deps = {}) {
  const { runMcporter, parser, kcultureDir = KCULTURE_DIR, now = new Date() } = deps;

  const flags = new Set(argv.slice(2));
  const dryRun = flags.has("--dry-run");
  const sectionArg = [...flags].find((f) => f.startsWith("--section="));
  const only = sectionArg ? sectionArg.split("=")[1] : null;

  const KNOWN_SECTIONS = [...EXA_SECTIONS, "exa", "rss"];
  if (only && !KNOWN_SECTIONS.includes(only)) {
    console.error(`unknown --section=${only} (expected: ${KNOWN_SECTIONS.join(" | ")})`);
    return 1;
  }

  const sources = JSON.parse(readFileSync(path.join(kcultureDir, "sources.json"), "utf-8"));
  const results = [];

  if (!only || only === "exa" || EXA_SECTIONS.includes(only)) {
    // --section=kpop|kdrama|dating narrows to that section's queries only.
    let exaSrc = EXA_SECTIONS.includes(only)
      ? sources.exa.filter((s) => s.section === only)
      : sources.exa;
    if (dryRun) exaSrc = exaSrc.slice(0, 1);
    try {
      results.push(await collectExa(exaSrc, { runMcporter, now }));
    } catch (e) {
      console.warn(`exa section failed: ${e.message}`);
    }
  }

  if (!only || only === "rss") {
    try {
      results.push(await collectRss(sources.rss, { parser, now }));
    } catch (e) {
      console.warn(`rss section failed: ${e.message}`);
    }
  }

  const merged = mergeAndDedupe(results);
  console.log(`collected ${merged.length} items`);

  if (dryRun) {
    console.log(JSON.stringify(merged.slice(0, 5), null, 2));
    console.log("dry run — no file written");
    return 0;
  }

  // Health comes from the output, not from "a section was attempted": every
  // collector swallows its own errors, so count only items that actually carry
  // a link — otherwise a run where every source failed still looks fine.
  const collected = merged.filter((it) => it.link).length;
  if (collected === 0) {
    console.error(
      `no items collected${only ? ` for --section=${only}` : ""} — not writing (existing raw json left intact)`,
    );
    return 1;
  }

  // A --section run is partial by definition. The weekly agent appends Reddit /
  // TikTok items to the canonical raw json and those cannot be regenerated, so a
  // partial run must never overwrite it.
  if (only) {
    console.log(`--section=${only}: partial run — canonical raw-kculture-*.json not written`);
    return 0;
  }

  const outPath = path.join(kcultureDir, `raw-kculture-${kstDate(now)}.json`);
  writeFileSync(outPath, JSON.stringify(merged, null, 2), "utf-8");
  for (const name of purgeOldFiles(kcultureDir, /^raw-kculture-\d{4}-\d{2}-\d{2}\.json$/, 60)) {
    console.log(`purged old: ${name}`);
  }
  console.log(`saved: ${outPath}`);
  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  // process.exitCode (not process.exit) so buffered stdout is flushed first —
  // run-fetch-kculture.ps1 pipes this into a log file and reads $LASTEXITCODE.
  main(process.argv).then(
    (code) => { process.exitCode = code; },
    (e) => { console.error(e); process.exitCode = 1; },
  );
}
