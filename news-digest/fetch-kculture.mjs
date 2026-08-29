// Weekly "K-컬처 & 라이프" collector — Exa + RSS + YouTube Shorts → raw-kculture-<date>.json.
// Does NOT need .env.local. Run: node news-digest/fetch-kculture.mjs [--dry-run] [--section=<name>]
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
import { exec, execFile } from "node:child_process";

import Parser from "rss-parser";

import { kstDate, stripTags, purgeOldFiles } from "./_lib.mjs";
import { pickTopShorts } from "./kculture/pickTopShorts.mjs";

const execP = promisify(exec);
const execFileP = promisify(execFile);

export const KOREA_REGEX = /korea|korean|한국|케이팝|k-?pop|k-?drama|hallyu|한류|kdrama/i;

const HERE = path.dirname(fileURLToPath(import.meta.url));
const KCULTURE_DIR = path.join(HERE, "kculture");

// ── date helpers ─────────────────────────────────────────────
export function withinDays(dateStr, n, now = new Date()) {
  if (!dateStr) return false;
  const ymd = /^(\d{4})(\d{2})(\d{2})$/.exec(String(dateStr));
  const ms = ymd
    ? Date.UTC(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]))
    : Date.parse(dateStr);
  if (Number.isNaN(ms)) return false;
  return ms >= now.getTime() - n * 24 * 60 * 60 * 1000;
}

// ── Exa ──────────────────────────────────────────────────────
// TEXT PATH (Task 3 Step 1 investigation found no structured JSON output — use this):
export function parseExaOutput(text) {
  const blocks = String(text).split(/\n(?=Title:\s)/);
  const items = [];
  for (const b of blocks) {
    const title = (/^Title:\s*(.+)$/m.exec(b) || [])[1];
    const link = (/^URL(?:\s*Source)?:\s*(\S+)\s*$/m.exec(b) || [])[1];
    if (!title || !link) continue;
    const date = (/^Published(?:\s*Time)?:\s*(\S+)\s*$/m.exec(b) || [])[1] || null;
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
      if (!withinDays(r.date, src.freshnessDays, now)) continue;
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
    for (const entry of parsed.items || []) {
      const date = entry.isoDate || entry.pubDate || null;
      if (!withinDays(date, 7, now)) continue;
      items.push({
        source: `rss:${feed.name}`,
        keyword: feed.section,
        title: (entry.title || "").trim(),
        description: stripTags(entry.contentSnippet || entry.content || "").slice(0, 400),
        link: entry.link || "",
        date,
      });
    }
  }
  return items;
}

// ── YouTube Shorts ───────────────────────────────────────────
export function parseYtDlpJsonLines(stdout) {
  const rows = [];
  for (const line of String(stdout).split("\n")) {
    const t = line.trim();
    if (!t || t[0] !== "{") continue;
    try {
      const j = JSON.parse(t);
      rows.push({
        id: j.id,
        title: j.title || "",
        description: j.description || "",
        channel: j.channel || j.uploader || "",
        view_count: j.view_count ?? 0,
        upload_date: j.upload_date || "",
        duration: typeof j.duration === "number" ? j.duration : null,
        url: j.webpage_url || j.url || (j.id ? `https://www.youtube.com/watch?v=${j.id}` : ""),
      });
    } catch {
      // progress / non-JSON line
    }
  }
  return rows;
}

async function defaultRunYtDlp(term) {
  // Invoke via `python -m yt_dlp`: yt-dlp is installed as a Python module and
  // `python` is on PATH, whereas the `yt-dlp` console-script dir
  // (…\Python\…\Scripts) is not on PATH for non-interactive / scheduled runs.
  const { stdout } = await execFileP(
    "python",
    ["-m", "yt_dlp", "--dump-json", "--no-warnings", "--ignore-errors", `ytsearch12:${term}`],
    { timeout: 180000, maxBuffer: 50 * 1024 * 1024 },
  );
  return stdout;
}

async function gatherCountry(country, maxAgeDays, runYtDlp, now) {
  const all = [];
  for (const term of country.terms) {
    let out;
    try {
      out = await runYtDlp(term);
    } catch (e) {
      console.warn(`  ! shorts ${country.country} "${term}": ${e.message}`);
      continue;
    }
    all.push(...parseYtDlpJsonLines(out));
  }
  return pickTopShorts(all, { maxAgeDays, limit: 2, koreaRegex: KOREA_REGEX, now });
}

export async function collectShorts(shortsSources, { runYtDlp = defaultRunYtDlp, now = new Date() } = {}) {
  const items = [];
  for (const country of shortsSources) {
    let picks = await gatherCountry(country, 7, runYtDlp, now);
    if (picks.length < 2) picks = await gatherCountry(country, 14, runYtDlp, now);

    if (picks.length === 0) {
      items.push({
        source: "shorts", keyword: "shorts",
        country: country.country, lang: country.lang,
        title: "", description: "", link: "", date: null,
        channel: "", views: 0, duration: null,
        note: "최근 14일 내 조건 충족 영상 없음",
      });
      continue;
    }

    const short = picks.length < 2 ? "조건 충족 영상 부족" : undefined;
    for (const p of picks) {
      items.push({
        source: "shorts", keyword: "shorts",
        country: country.country, lang: country.lang,
        title: p.title, description: "", link: p.link, date: p.date,
        channel: p.channel, views: p.views, duration: p.duration,
        ...(short ? { note: short } : {}),
      });
    }
  }
  return items;
}

// ── main (expanded in Tasks 4–6) ─────────────────────────────
async function main(argv) {
  const flags = new Set(argv.slice(2));
  const dryRun = flags.has("--dry-run");
  const sectionArg = [...flags].find((f) => f.startsWith("--section="));
  const only = sectionArg ? sectionArg.split("=")[1] : null;

  const sources = JSON.parse(readFileSync(path.join(KCULTURE_DIR, "sources.json"), "utf-8"));
  const results = [];
  let anyOk = false;

  if (!only || only === "exa" || ["kpop", "kdrama", "dating"].includes(only)) {
    const exaSrc = dryRun ? sources.exa.slice(0, 1) : sources.exa;
    try {
      results.push(await collectExa(exaSrc, {}));
      anyOk = true;
    } catch (e) {
      console.warn(`exa section failed: ${e.message}`);
    }
  }

  if (!only || only === "rss") {
    try {
      results.push(await collectRss(sources.rss, {}));
      anyOk = true;
    } catch (e) {
      console.warn(`rss section failed: ${e.message}`);
    }
  }

  if (!only || only === "shorts") {
    const shortsSrc = dryRun
      ? sources.shorts.map((s) => ({ ...s, terms: s.terms.slice(0, 1) }))
      : sources.shorts;
    try {
      results.push(await collectShorts(shortsSrc, {}));
      anyOk = true;
    } catch (e) {
      console.warn(`shorts section failed: ${e.message}`);
    }
  }

  const merged = results.flat();
  console.log(`collected ${merged.length} items`);

  if (dryRun) {
    console.log(JSON.stringify(merged.slice(0, 5), null, 2));
    console.log("dry run — no file written");
    return;
  }

  const outPath = path.join(KCULTURE_DIR, `raw-kculture-${kstDate()}.json`);
  writeFileSync(outPath, JSON.stringify(merged, null, 2), "utf-8");
  for (const name of purgeOldFiles(KCULTURE_DIR, /^raw-kculture-\d{4}-\d{2}-\d{2}\.json$/, 60)) {
    console.log(`purged old: ${name}`);
  }
  console.log(`saved: ${outPath}`);
  if (!anyOk) process.exit(1);
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  main(process.argv);
}
