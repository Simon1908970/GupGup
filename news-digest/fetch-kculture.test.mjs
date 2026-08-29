import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { KOREA_REGEX, parseExaOutput, withinDays, collectExa, collectRss, mergeAndDedupe, main } from "./fetch-kculture.mjs";

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

test("mergeAndDedupe: link 기준 중복 제거, 빈 link 보존, 순서 유지", () => {
  const a = [
    { source: "exa", link: "https://x/1", title: "one" },
    { source: "rss:z", link: "https://x/2", title: "two" },
  ];
  const b = [
    { source: "reddit:korea", link: "https://x/1", title: "dup" },
    { source: "reddit:korea", link: "", title: "no-link-a" },
    { source: "reddit:korea", link: "", title: "no-link-b" },
    { source: "tiktok", link: "https://x/3", title: "three" },
  ];
  const out = mergeAndDedupe([a, b]);
  assert.deepEqual(out.map((i) => i.title),
    ["one", "two", "no-link-a", "no-link-b", "three"]);
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

const emptyDeps = {
  runMcporter: async () => "",
  parser: { async parseURL() { return { items: [] }; } },
};

test("main: 전체 실행은 raw-kculture-<날짜>.json 을 쓰고 0 을 반환", async (t) => {
  const dir = makeKcultureDir(t, MAIN_SOURCES);

  const code = await quiet(() => main(["node", "fetch-kculture.mjs"], {
    runMcporter: fakeMcporterOk,
    parser: fakeParserOk,
    kcultureDir: dir,
    now: NOW,
  }));

  assert.equal(code, 0);
  assert.deepEqual(rawFiles(dir), ["raw-kculture-2026-08-29.json"]);
  const saved = JSON.parse(readFileSync(path.join(dir, "raw-kculture-2026-08-29.json"), "utf-8"));
  assert.ok(saved.length >= 2);
  assert.ok(saved.some((i) => i.source === "exa"));
  assert.ok(saved.some((i) => i.source === "rss:demo"));
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
    kcultureDir: dir,
    now: NOW,
  }));

  assert.equal(code, 0);
  assert.deepEqual(called, ["kpop q1"]);
  assert.deepEqual(rawFiles(dir), []);
});

test("main: 아무것도 못 모으면 파일을 쓰지 않고 1 을 반환", async (t) => {
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
    kcultureDir: dir,
    now: NOW,
  }));

  assert.equal(code, 0);
  assert.deepEqual(rawFiles(dir), []);
});
