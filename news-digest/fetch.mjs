// Fetches raw Naver search results for every keyword in keywords.md and
// writes them to news-digest/daily/raw-<date>.json. Run with:
//   node --env-file=.env.local news-digest/fetch.mjs
// The raw file is then read and turned into a curated daily/<date>.md by
// a separate summarization step (done by an agent, not this script).

import { readFileSync, mkdirSync, readdirSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const CLIENT_ID = process.env.NAVER_SEARCH_CLIENT_ID;
const CLIENT_SECRET = process.env.NAVER_SEARCH_CLIENT_SECRET;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error(
    "Missing NAVER_SEARCH_CLIENT_ID / NAVER_SEARCH_CLIENT_SECRET. Run with `node --env-file=.env.local news-digest/fetch.mjs`.",
  );
  process.exit(1);
}

const ENDPOINTS = ["news", "blog", "cafearticle"];
const DISPLAY_PER_KEYWORD = 5;
const MAX_AGE_DAYS = 3;
const RAW_RETENTION_DAYS = 60;

// The news/blog/cafearticle search APIs share one free pool of 775,000
// calls/month (NAVER API HUB). A normal run uses ~keywords.length * 3 calls
// (currently ~195/day, ~6,000/month) -- well under 1% of the cap. This is
// just a hard stop so a much larger keyword list can't run away and
// approach it.
const MAX_CALLS_PER_RUN = 400;
let callCount = 0;

function readKeywords() {
  const text = readFileSync(path.join(__dirname, "keywords.md"), "utf-8");
  return text
    .split("\n")
    .filter((line) => line.trim().startsWith("- "))
    .map((line) => line.trim().slice(2).trim())
    .filter(Boolean);
}

function stripTags(s) {
  return s
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

function parseDate(item) {
  if (item.pubDate) return new Date(item.pubDate);
  if (item.postdate) {
    const s = item.postdate;
    return new Date(`${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`);
  }
  return null; // cafearticle has no date field
}

function purgeOldRawFiles(outDir) {
  const cutoff = Date.now() - RAW_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  let files;
  try {
    files = readdirSync(outDir);
  } catch {
    return; // outDir doesn't exist yet on a first-ever run
  }
  for (const name of files) {
    if (!/^raw-\d{4}-\d{2}-\d{2}\.json$/.test(name)) continue;
    const filePath = path.join(outDir, name);
    if (statSync(filePath).mtimeMs < cutoff) {
      unlinkSync(filePath);
      console.log(`Purged (> ${RAW_RETENTION_DAYS} days old): ${name}`);
    }
  }
}

async function searchOne(endpoint, keyword) {
  callCount += 1;
  const url = new URL(`https://naverapihub.apigw.ntruss.com/search/v1/${endpoint}`);
  url.searchParams.set("query", keyword);
  url.searchParams.set("display", String(DISPLAY_PER_KEYWORD));
  url.searchParams.set("sort", endpoint === "cafearticle" ? "sim" : "date");

  const res = await fetch(url, {
    headers: {
      "X-NCP-APIGW-API-KEY-ID": CLIENT_ID,
      "X-NCP-APIGW-API-KEY": CLIENT_SECRET,
    },
  });
  if (!res.ok) {
    console.error(`  ! ${endpoint}/${keyword}: HTTP ${res.status}`);
    return [];
  }
  const data = await res.json();
  return (data.items ?? []).map((item) => ({
    source: endpoint,
    keyword,
    title: stripTags(item.title),
    description: stripTags(item.description),
    link: item.originallink || item.link,
    date: parseDate(item)?.toISOString() ?? null,
  }));
}

async function main() {
  const keywords = readKeywords();
  console.log(`${keywords.length} keywords x ${ENDPOINTS.length} endpoints`);

  const all = [];
  outer: for (const keyword of keywords) {
    for (const endpoint of ENDPOINTS) {
      if (callCount >= MAX_CALLS_PER_RUN) {
        console.warn(
          `Stopping early: hit the per-run safety cap of ${MAX_CALLS_PER_RUN} API calls.`,
        );
        break outer;
      }
      const items = await searchOne(endpoint, keyword);
      all.push(...items);
    }
  }

  const cutoff = Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
  const seen = new Set();
  const filtered = all.filter((item) => {
    if (item.date && new Date(item.date).getTime() < cutoff) return false;
    if (seen.has(item.link)) return false;
    seen.add(item.link);
    return true;
  });

  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
  const outDir = path.join(ROOT, "news-digest", "daily");
  mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `raw-${today}.json`);
  writeFileSync(outPath, JSON.stringify(filtered, null, 2), "utf-8");
  purgeOldRawFiles(outDir);

  console.log(`${all.length} results -> ${filtered.length} after dedupe/age filter`);
  console.log(`Saved: ${outPath}`);
  console.log(`API calls this run: ${callCount} (free pool: 775,000/month, shared across news/blog/cafe)`);
}

main();
