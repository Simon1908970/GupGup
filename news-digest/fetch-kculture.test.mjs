import { test } from "node:test";
import assert from "node:assert/strict";
import { KOREA_REGEX, parseExaOutput, withinDays, collectExa } from "./fetch-kculture.mjs";

const NOW = new Date("2026-08-29T00:00:00Z");

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

test("collectExa: runMcporter 예외는 삼키고 계속", async () => {
  const throwing = async () => { throw new Error("mcporter boom"); };
  const items = await collectExa(
    [{ section: "kpop", query: "q", freshnessDays: 7 }],
    { runMcporter: throwing, now: NOW },
  );
  assert.deepEqual(items, []);
});
