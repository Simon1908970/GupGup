// Shared helpers for the news-digest scripts (fetch.mjs, fetch-kculture.mjs).

import { readdirSync, statSync, unlinkSync } from "node:fs";
import path from "node:path";

/** Current date as "YYYY-MM-DD" in Asia/Seoul. */
export function kstDate(d = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(d);
}

/** Strip HTML tags and decode the handful of entities the search APIs emit. */
export function stripTags(s) {
  return String(s)
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

/**
 * Delete files in `dir` whose name matches `pattern` and whose mtime is older
 * than `retentionDays`. Returns the list of deleted file names. Missing dir → [].
 */
export function purgeOldFiles(dir, pattern, retentionDays) {
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  const purged = [];
  let files;
  try {
    files = readdirSync(dir);
  } catch {
    return purged;
  }
  for (const name of files) {
    if (!pattern.test(name)) continue;
    const filePath = path.join(dir, name);
    if (statSync(filePath).mtimeMs < cutoff) {
      unlinkSync(filePath);
      purged.push(name);
    }
  }
  return purged;
}
