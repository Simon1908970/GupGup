// Pure filter + rank for the "동남아 쇼츠" section. No I/O — unit tested with fixtures.

const YYYYMMDD = /^(\d{4})(\d{2})(\d{2})$/;

function uploadDateToMs(uploadDate) {
  const m = YYYYMMDD.exec(String(uploadDate ?? ""));
  if (!m) return null;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/**
 * @param {Array<object>} candidates  yt-dlp --dump-json shaped entries
 * @param {{maxAgeDays:number, limit:number, koreaRegex:RegExp, now?:Date}} opts
 *   koreaRegex MUST NOT carry the global flag.
 * @returns {Array<{id,title,channel,views,link,date,duration}>}
 */
export function pickTopShorts(candidates, { maxAgeDays, limit, koreaRegex, now = new Date() }) {
  const cutoff = now.getTime() - maxAgeDays * 24 * 60 * 60 * 1000;
  const seen = new Set();
  const kept = [];

  for (const c of candidates) {
    if (c == null) continue;
    if (typeof c.duration !== "number" || c.duration > 60) continue;
    const ms = uploadDateToMs(c.upload_date);
    if (ms == null || ms < cutoff) continue;
    if (!koreaRegex.test(`${c.title ?? ""} ${c.description ?? ""}`)) continue;
    if (seen.has(c.id)) continue;
    seen.add(c.id);
    kept.push(c);
  }

  kept.sort((a, b) => (b.view_count ?? 0) - (a.view_count ?? 0));

  return kept.slice(0, limit).map((c) => ({
    id: c.id,
    title: c.title ?? "",
    channel: c.channel ?? c.uploader ?? "",
    views: c.view_count ?? 0,
    link: c.url ?? c.webpage_url ?? "",
    date: new Date(uploadDateToMs(c.upload_date)).toISOString().slice(0, 10),
    duration: c.duration,
  }));
}
