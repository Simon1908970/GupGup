import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { KOREA_REGEX, parseExaOutput, withinDays, collectExa, collectRss, parseYtDlpJsonLines, collectShorts, mergeAndDedupe, main } from "./fetch-kculture.mjs";

const NOW = new Date("2026-08-29T00:00:00Z");

// main() / 실패 경로 테스트는 console 로 시끄러우므로 그 동안만 입을 막는다.
async function quiet(fn) {
  const { log, warn, error } = console;
  console.log = () => {};
  console.warn = () => {};
  console.error = () => {};
  try {
    return await fn();
  } finally {
    console.log = log;
    console.warn = warn;
    console.error = error;
  }
}

// sources.json 만 든 임시 kcultureDir. t.after 로 정리.
function makeKcultureDir(t, sources) {
  const dir = mkdtempSync(path.join(tmpdir(), "kculture-test-"));
  writeFileSync(path.join(dir, "sources.json"), JSON.stringify(sources), "utf-8");
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function rawFiles(dir) {
  return readdirSync(dir).filter((f) => f.startsWith("raw-kculture-"));
}

test("KOREA_REGEX: 한/영 키워드 매칭, g 플래그 없음", () => {
  assert.equal(KOREA_REGEX.global, false);
  assert.ok(KOREA_REGEX.test("K-pop comeback"));
  assert.ok(KOREA_REGEX.test("서울 한국 여행"));
  assert.ok(!KOREA_REGEX.test("Tokyo Japan trip"));
});

test("withinDays: ISO / YYYYMMDD / null / 범위", () => {
  assert.equal(withinDays("2026-08-27T00:00:00Z", 7, NOW), true);
  assert.equal(withinDays("2026-08-10T00:00:00Z", 7, NOW), false);
  assert.equal(withinDays("20260828", 7, NOW), true);
  assert.equal(withinDays(null, 7, NOW), false);
  assert.equal(withinDays("not-a-date", 7, NOW), false);
});

test("parseExaOutput: 결과 블록에서 title/link/date/description 추출", () => {
  // Step 1 조사 결과가 '텍스트 경로'라는 가정의 픽스처. JSON 경로면 이 픽스처를
  // 실제 JSON 형태로 바꾸고 아래 기대값은 유지한다.
  const sample = [
    "Title: Korea visa update 2026",
    "URL: https://example.com/a",
    "Published: 2026-08-27T09:00:00.000Z",
    "Highlights:",
    "new E-7 rule ... takes effect ... in September",
    "",
    "Title: Unrelated Tokyo piece",
    "URL: https://example.com/b",
    "Published: 2026-08-26T00:00:00.000Z",
    "Highlights:",
    "cherry blossoms",
  ].join("\n");

  const items = parseExaOutput(sample);
  assert.equal(items.length, 2);
  assert.deepEqual(items[0], {
    title: "Korea visa update 2026",
    link: "https://example.com/a",
    date: "2026-08-27T09:00:00.000Z",
    description: "new E-7 rule takes effect in September",
  });
});

test("parseExaOutput: Published 가 N/A·빈값·null 이면 date = null", () => {
  const sample = [
    "Title: Korea guide with no date",
    "URL: https://example.com/na",
    "Published: N/A",
    "Highlights:",
    "everything about visiting Korea",
    "",
    "Title: Another undated one",
    "URL: https://example.com/none",
    "Published: none",
    "Highlights:",
    "korea",
  ].join("\n");

  const items = parseExaOutput(sample);
  assert.equal(items.length, 2);
  assert.equal(items[0].date, null);
  assert.equal(items[0].title, "Korea guide with no date");
  assert.equal(items[1].date, null);
});

test("collectExa: freshness + KOREA_REGEX 필터, item 스키마", async () => {
  const fakeMcporter = async (query) => {
    assert.equal(query, "K-pop comeback");
    return [
      "Title: BTS new single announced",
      "URL: https://ex.com/kpop1",
      "Published: 2026-08-28T00:00:00.000Z",
      "Highlights:",
      "the group returns with a Korea-wide tour",
      "",
      "Title: Old news from July",
      "URL: https://ex.com/kpop2",
      "Published: 2026-07-01T00:00:00.000Z",
      "Highlights:",
      "korea comeback",
      "",
      "Title: Nothing to do with the topic",
      "URL: https://ex.com/x",
      "Published: 2026-08-28T00:00:00.000Z",
      "Highlights:",
      "generic celebrity gossip",
    ].join("\n");
  };

  const items = await collectExa(
    [{ section: "kpop", query: "K-pop comeback", freshnessDays: 7 }],
    { runMcporter: fakeMcporter, now: NOW },
  );

  assert.equal(items.length, 1);
  assert.deepEqual(items[0], {
    source: "exa",
    keyword: "kpop",
    title: "BTS new single announced",
    description: "the group returns with a Korea-wide tour",
    link: "https://ex.com/kpop1",
    date: "2026-08-28T00:00:00.000Z",
  });
});

test("collectExa: date 가 null 이면 freshness 를 건너뛰고 유지, 한국 게이트는 유지", async () => {
  const fakeMcporter = async () => [
    "Title: Undated Korea travel guide",
    "URL: https://ex.com/undated-korea",
    "Published: N/A",
    "Highlights:",
    "a long-lived guide to travelling in Korea",
    "",
    "Title: Undated and unrelated",
    "URL: https://ex.com/undated-other",
    "Published: N/A",
    "Highlights:",
    "generic celebrity gossip",
  ].join("\n");

  const items = await collectExa(
    [{ section: "dating", query: "q", freshnessDays: 7 }],
    { runMcporter: fakeMcporter, now: NOW },
  );

  assert.equal(items.length, 1);
  assert.equal(items[0].link, "https://ex.com/undated-korea");
  assert.equal(items[0].date, null);
});

test("collectExa: runMcporter 예외는 삼키고 계속", async () => {
  const throwing = async () => { throw new Error("mcporter boom"); };
  const items = await collectExa(
    [{ section: "kpop", query: "q", freshnessDays: 7 }],
    { runMcporter: throwing, now: NOW },
  );
  assert.deepEqual(items, []);
});

test("collectRss: 7일 이내 항목만, 스키마 + description 정리", async () => {
  const fakeParser = {
    async parseURL(url) {
      assert.equal(url, "https://feed.example/rss");
      return {
        items: [
          {
            title: "  New K-pop MV drops  ",
            link: "https://ex.com/mv",
            isoDate: "2026-08-28T00:00:00.000Z",
            contentSnippet: "<p>The <b>group</b> released the video</p>",
          },
          {
            title: "Stale item",
            link: "https://ex.com/old",
            isoDate: "2026-08-01T00:00:00.000Z",
            contentSnippet: "old",
          },
        ],
      };
    },
  };

  const items = await collectRss(
    [{ name: "demo", url: "https://feed.example/rss", section: "kpop" }],
    { parser: fakeParser, now: new Date("2026-08-29T00:00:00Z") },
  );

  assert.equal(items.length, 1);
  assert.deepEqual(items[0], {
    source: "rss:demo",
    keyword: "kpop",
    title: "New K-pop MV drops",
    description: "The group released the video",
    link: "https://ex.com/mv",
    date: "2026-08-28T00:00:00.000Z",
  });
});

test("collectRss: feed.limit 만큼만, 최신순으로 자른다", async () => {
  // 창 안(8/29 기준 7일)에 20건 → limit 3 이면 최신 3건만
  const entries = Array.from({ length: 20 }, (_, i) => ({
    title: `item ${i}`,
    link: `https://ex.com/${i}`,
    // i 가 클수록 오래됨: 8/28 23:00, 8/28 22:00 …
    isoDate: new Date(Date.UTC(2026, 7, 28, 23 - i) ).toISOString(),
  }));
  const parser = { async parseURL() { return { items: entries.slice().reverse() }; } };

  const items = await collectRss(
    [{ name: "demo", url: "https://feed.example/rss", section: "kpop", freshnessDays: 7, limit: 3 }],
    { parser, now: NOW },
  );

  assert.equal(items.length, 3);
  assert.deepEqual(items.map((i) => i.title), ["item 0", "item 1", "item 2"]);
});

test("collectRss: feed.freshnessDays 를 따른다 (하드코딩 7 아님)", async () => {
  const parser = {
    async parseURL() {
      return {
        items: [
          { title: "10일 전", link: "https://ex.com/ten", isoDate: "2026-08-19T00:00:00.000Z" },
          { title: "40일 전", link: "https://ex.com/forty", isoDate: "2026-07-20T00:00:00.000Z" },
        ],
      };
    },
  };

  const wide = await collectRss(
    [{ name: "demo", url: "u", section: "kpop", freshnessDays: 30, limit: 15 }],
    { parser, now: NOW },
  );
  assert.deepEqual(wide.map((i) => i.title), ["10일 전"]);

  const narrow = await collectRss(
    [{ name: "demo", url: "u", section: "kpop", freshnessDays: 7, limit: 15 }],
    { parser, now: NOW },
  );
  assert.deepEqual(narrow, []);
});

test("collectRss: 한 피드가 던져도 다른 피드는 계속", async () => {
  const parser = {
    async parseURL(url) {
      if (url.includes("bad")) throw new Error("404");
      return { items: [{ title: "ok", link: "https://ex.com/ok", isoDate: "2026-08-28T00:00:00.000Z" }] };
    },
  };
  const items = await collectRss(
    [
      { name: "bad", url: "https://bad.example/rss", section: "kpop" },
      { name: "good", url: "https://good.example/rss", section: "kpop" },
    ],
    { parser, now: new Date("2026-08-29T00:00:00Z") },
  );
  assert.deepEqual(items.map((i) => i.source), ["rss:good"]);
});

test("parseYtDlpJsonLines: JSON 줄만 파싱, 진행 로그 줄 무시", () => {
  const out = [
    "[youtube:search] Extracting URL",
    JSON.stringify({ id: "v1", title: "Korea vlog", view_count: 5000, upload_date: "20260828", duration: 40, webpage_url: "https://youtu.be/v1", channel: "A" }),
    "download progress 50%",
    JSON.stringify({ id: "v2", title: "Seoul food", view_count: 900, upload_date: "20260827", duration: 55, webpage_url: "https://youtu.be/v2" }),
  ].join("\n");
  const rows = parseYtDlpJsonLines(out);
  assert.deepEqual(rows.map((r) => r.id), ["v1", "v2"]);
  assert.equal(rows[0].channel, "A");
  assert.equal(rows[1].channel, "");
});

test("collectShorts: 나라별 상위 2개, 7일 우선", async () => {
  const now = new Date("2026-08-29T00:00:00Z");
  const runYtDlp = async (term) => {
    // 모든 term에 대해 동일 후보 반환 (pickTopShorts가 dedupe/rank)
    return [
      JSON.stringify({ id: "hi", title: "Korea " + term, view_count: 9000, upload_date: "20260828", duration: 30, webpage_url: "https://youtu.be/hi", channel: "H" }),
      JSON.stringify({ id: "mid", title: "korea " + term, view_count: 4000, upload_date: "20260827", duration: 30, webpage_url: "https://youtu.be/mid", channel: "M" }),
      JSON.stringify({ id: "lo", title: "korea " + term, view_count: 10, upload_date: "20260827", duration: 30, webpage_url: "https://youtu.be/lo", channel: "L" }),
    ].join("\n");
  };

  const items = await collectShorts(
    [{ country: "vietnam", lang: "vi", terms: ["t1", "t2"] }],
    { runYtDlp, now },
  );

  assert.equal(items.length, 2);
  assert.deepEqual(items.map((i) => i.link), ["https://youtu.be/hi", "https://youtu.be/mid"]);
  assert.equal(items[0].source, "shorts");
  assert.equal(items[0].country, "vietnam");
  assert.equal(items[0].views, 9000);
  assert.equal(items[0].note, undefined);
});

test("collectShorts: 7일 내 0개면 더 넓은 창(14/90)으로 폴백", async () => {
  const now = new Date("2026-08-29T00:00:00Z");
  // 20260817 = 12일 전: 7일 창 밖, 14일 창 안 → 폴백이 성공해야 함
  const runYtDlp = async () =>
    JSON.stringify({ id: "old1", title: "Korea old", view_count: 50, upload_date: "20260817", duration: 30, webpage_url: "https://youtu.be/old1", channel: "O" });

  const items = await collectShorts(
    [{ country: "thailand", lang: "th", terms: ["t"] }],
    { runYtDlp, now },
  );

  assert.equal(items.length, 1);
  assert.equal(items[0].link, "https://youtu.be/old1");
  assert.equal(items[0].note, "조건 충족 영상 부족");
});

test("collectShorts: 90일 내도 0개면 note-only 항목", async () => {
  const now = new Date("2026-08-29T00:00:00Z");
  // 20260101 = 90일보다 훨씬 오래됨 → 모든 창(7/14/90)에서 탈락
  const runYtDlp = async () =>
    JSON.stringify({ id: "ancient", title: "Korea", view_count: 5, upload_date: "20260101", duration: 30, webpage_url: "https://youtu.be/ancient" });

  const items = await collectShorts(
    [{ country: "indonesia", lang: "id", terms: ["t"] }],
    { runYtDlp, now },
  );

  assert.equal(items.length, 1);
  assert.equal(items[0].link, "");
  assert.equal(items[0].country, "indonesia");
  assert.equal(items[0].note, "최근 90일 내 조건 충족 영상 없음");
});

test("collectShorts: 한 term이 던져도 다른 term은 계속", async () => {
  const now = new Date("2026-08-29T00:00:00Z");
  const runYtDlp = async (term) => {
    if (term === "boom") throw new Error("yt-dlp exited 1");
    return JSON.stringify({ id: "ok", title: "Korea ok", view_count: 100, upload_date: "20260828", duration: 20, webpage_url: "https://youtu.be/ok", channel: "K" });
  };
  const items = await collectShorts(
    [{ country: "philippines", lang: "fil", terms: ["boom", "good"] }],
    { runYtDlp, now },
  );
  assert.equal(items.length, 1);
  assert.equal(items[0].link, "https://youtu.be/ok");
});

test("collectShorts: 모든 term 이 실패하면 '검색 결과 없음'이 아니라 실행 실패 note", async () => {
  const now = new Date("2026-08-29T00:00:00Z");
  const runYtDlp = async () => { throw new Error("spawn python ENOENT"); };

  const items = await quiet(() => collectShorts(
    [{ country: "vietnam", lang: "vi", terms: ["t1", "t2"] }],
    { runYtDlp, now },
  ));

  assert.equal(items.length, 1);
  assert.equal(items[0].note, "yt-dlp 실행 실패");
  assert.equal(items[0].error, "spawn python ENOENT");
  assert.equal(items[0].link, "");
  assert.equal(items[0].country, "vietnam");
});

test("collectShorts: 현지어 제목(한국 관련어 미포함)도 통과 — 검색어가 스코프를 잡음", async () => {
  const now = new Date("2026-08-29T00:00:00Z");
  // "Hàn Quốc" 은 KOREA_REGEX 에 안 걸리지만 쇼츠 경로는 키워드 게이트가 없어야 함
  const runYtDlp = async () =>
    JSON.stringify({ id: "vn", title: "Hàn Quốc đẹp quá", view_count: 800, upload_date: "20260828", duration: 25, webpage_url: "https://youtu.be/vn", channel: "V" });

  const items = await collectShorts(
    [{ country: "vietnam", lang: "vi", terms: ["Hàn Quốc #shorts"] }],
    { runYtDlp, now },
  );

  assert.equal(items.length, 1);
  assert.equal(items[0].link, "https://youtu.be/vn");
  assert.equal(items[0].note, "조건 충족 영상 부족");
});

test("mergeAndDedupe: link 기준 중복 제거, 빈 link 보존, 순서 유지", () => {
  const a = [
    { source: "exa", link: "https://x/1", title: "one" },
    { source: "rss:z", link: "https://x/2", title: "two" },
  ];
  const b = [
    { source: "reddit:korea", link: "https://x/1", title: "dup" },
    { source: "shorts", link: "", note: "n1" },
    { source: "shorts", link: "", note: "n2" },
    { source: "tiktok", link: "https://x/3", title: "three" },
  ];
  const out = mergeAndDedupe([a, b]);
  assert.deepEqual(out.map((i) => i.source),
    ["exa", "rss:z", "shorts", "shorts", "tiktok"]);
  assert.equal(out.length, 5);
});

// ── main() ───────────────────────────────────────────────────
const MAIN_SOURCES = {
  exa: [
    { section: "kpop", query: "kpop q1", freshnessDays: 7 },
    { section: "kdrama", query: "kdrama q1", freshnessDays: 7 },
    { section: "dating", query: "dating q1", freshnessDays: 90 },
  ],
  rss: [{ name: "demo", url: "https://feed.example/rss", section: "kpop", freshnessDays: 7, limit: 15 }],
  shorts: [{ country: "vietnam", lang: "vi", terms: ["t1", "t2"] }],
};

const fakeMcporterOk = async (query) => [
  `Title: Korea item for ${query}`,
  `URL: https://ex.com/${encodeURIComponent(query)}`,
  "Published: 2026-08-28T00:00:00.000Z",
  "Highlights:",
  "korea korea",
].join("\n");

const fakeParserOk = {
  async parseURL() {
    return { items: [{ title: "rss hit", link: "https://ex.com/rss1", isoDate: "2026-08-28T00:00:00.000Z" }] };
  },
};

const fakeYtDlpOk = async () =>
  JSON.stringify({ id: "s1", title: "Korea shorts", view_count: 100, upload_date: "20260828", duration: 30, webpage_url: "https://youtu.be/s1", channel: "C" });

const emptyDeps = {
  runMcporter: async () => "",
  parser: { async parseURL() { return { items: [] }; } },
  runYtDlp: async () => "",
};

test("main: 전체 실행은 raw-kculture-<날짜>.json 을 쓰고 0 을 반환", async (t) => {
  const dir = makeKcultureDir(t, MAIN_SOURCES);

  const code = await quiet(() => main(["node", "fetch-kculture.mjs"], {
    runMcporter: fakeMcporterOk,
    parser: fakeParserOk,
    runYtDlp: fakeYtDlpOk,
    kcultureDir: dir,
    now: NOW,
  }));

  assert.equal(code, 0);
  assert.deepEqual(rawFiles(dir), ["raw-kculture-2026-08-29.json"]);
  const saved = JSON.parse(readFileSync(path.join(dir, "raw-kculture-2026-08-29.json"), "utf-8"));
  assert.ok(saved.length >= 3);
  assert.ok(saved.some((i) => i.source === "exa"));
  assert.ok(saved.some((i) => i.source === "rss:demo"));
  assert.ok(saved.some((i) => i.source === "shorts"));
});

test("main: --section=rss 는 canonical raw 파일을 덮어쓰지 않는다", async (t) => {
  const dir = makeKcultureDir(t, MAIN_SOURCES);
  // 주간 세션이 Reddit/TikTok 을 append 해 둔 기존 파일 — 절대 건드리면 안 됨.
  const canonical = path.join(dir, "raw-kculture-2026-08-29.json");
  writeFileSync(canonical, JSON.stringify([{ source: "reddit:korea", link: "https://ex.com/r1" }]), "utf-8");

  const code = await quiet(() => main(["node", "fetch-kculture.mjs", "--section=rss"], {
    parser: fakeParserOk,
    kcultureDir: dir,
    now: NOW,
  }));

  assert.equal(code, 0);
  assert.deepEqual(rawFiles(dir), ["raw-kculture-2026-08-29.json"]);
  assert.deepEqual(JSON.parse(readFileSync(canonical, "utf-8")), [
    { source: "reddit:korea", link: "https://ex.com/r1" },
  ]);
});

test("main: --section=kpop 은 kpop exa 쿼리만 실행", async (t) => {
  const dir = makeKcultureDir(t, MAIN_SOURCES);
  const called = [];
  const runMcporter = async (query) => { called.push(query); return fakeMcporterOk(query); };

  const code = await quiet(() => main(["node", "fetch-kculture.mjs", "--section=kpop"], {
    runMcporter,
    parser: fakeParserOk,
    runYtDlp: fakeYtDlpOk,
    kcultureDir: dir,
    now: NOW,
  }));

  assert.equal(code, 0);
  assert.deepEqual(called, ["kpop q1"]);
  assert.deepEqual(rawFiles(dir), []);
});

test("main: 아무것도 못 모으면 파일을 쓰지 않고 1 을 반환", async (t) => {
  // 이 경우에도 collectShorts 는 note-only placeholder(link: "")를 1건 만든다.
  // placeholder 는 "수집됨"으로 치지 않아야 하므로 결과는 여전히 실패(1)여야 한다.
  const dir = makeKcultureDir(t, MAIN_SOURCES);

  const code = await quiet(() => main(["node", "fetch-kculture.mjs"], {
    ...emptyDeps,
    kcultureDir: dir,
    now: NOW,
  }));

  assert.equal(code, 1);
  assert.deepEqual(rawFiles(dir), []);
});

test("main: 모르는 --section 값은 1 을 반환하고 아무것도 쓰지 않는다", async (t) => {
  const dir = makeKcultureDir(t, MAIN_SOURCES);

  const code = await quiet(() => main(["node", "fetch-kculture.mjs", "--section=bogus"], {
    kcultureDir: dir,
    now: NOW,
  }));

  assert.equal(code, 1);
  assert.deepEqual(rawFiles(dir), []);
});

test("main: --dry-run 은 아무것도 쓰지 않고 0 을 반환", async (t) => {
  const dir = makeKcultureDir(t, MAIN_SOURCES);

  const code = await quiet(() => main(["node", "fetch-kculture.mjs", "--dry-run"], {
    runMcporter: fakeMcporterOk,
    parser: fakeParserOk,
    runYtDlp: fakeYtDlpOk,
    kcultureDir: dir,
    now: NOW,
  }));

  assert.equal(code, 0);
  assert.deepEqual(rawFiles(dir), []);
});
