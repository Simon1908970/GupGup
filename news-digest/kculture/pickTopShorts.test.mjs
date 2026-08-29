import { test } from "node:test";
import assert from "node:assert/strict";
import { pickTopShorts } from "./pickTopShorts.mjs";

const KOREA = /korea|한국/i;
const NOW = new Date("2026-08-29T00:00:00Z");

function cand(over = {}) {
  const result = {
    id: Math.random().toString(36).slice(2),
    title: "Korea vlog",
    description: "",
    channel: "chan",
    view_count: 1000,
    upload_date: "20260828",
    duration: 30,
    url: "https://youtu.be/x",
  };
  return { ...result, ...over };
}

test("duration > 60초 후보 제외", () => {
  const out = pickTopShorts([cand({ duration: 61 }), cand({ id: "ok", duration: 59 })],
    { maxAgeDays: 7, limit: 5, koreaRegex: KOREA, now: NOW });
  assert.deepEqual(out.map((x) => x.id), ["ok"]);
});

test("업로드가 maxAgeDays보다 오래되면 제외", () => {
  const out = pickTopShorts(
    [cand({ id: "old", upload_date: "20260810" }), cand({ id: "new", upload_date: "20260827" })],
    { maxAgeDays: 7, limit: 5, koreaRegex: KOREA, now: NOW });
  assert.deepEqual(out.map((x) => x.id), ["new"]);
});

test("한국 관련어 없으면 제외 (title+description 모두 검사)", () => {
  const out = pickTopShorts(
    [cand({ id: "no", title: "Japan trip", description: "tokyo" }),
     cand({ id: "yes", title: "trip", description: "seoul korea" })],
    { maxAgeDays: 7, limit: 5, koreaRegex: KOREA, now: NOW });
  assert.deepEqual(out.map((x) => x.id), ["yes"]);
});

test("view_count 내림차순 정렬 후 limit개", () => {
  const out = pickTopShorts(
    [cand({ id: "a", view_count: 10 }), cand({ id: "b", view_count: 300 }), cand({ id: "c", view_count: 50 })],
    { maxAgeDays: 7, limit: 2, koreaRegex: KOREA, now: NOW });
  assert.deepEqual(out.map((x) => x.id), ["b", "c"]);
});

test("id 중복 제거 (첫 등장 유지)", () => {
  const out = pickTopShorts(
    [cand({ id: "dup", view_count: 5 }), cand({ id: "dup", view_count: 999 })],
    { maxAgeDays: 7, limit: 5, koreaRegex: KOREA, now: NOW });
  assert.equal(out.length, 1);
  assert.equal(out[0].views, 5);
});

test("반환 형태: date는 YYYY-MM-DD, link는 url, channel 폴백", () => {
  const out = pickTopShorts(
    [cand({ id: "z", upload_date: "20260827", url: "https://youtu.be/z", channel: undefined })],
    { maxAgeDays: 7, limit: 1, koreaRegex: KOREA, now: NOW });
  assert.deepEqual(out[0], {
    id: "z", title: "Korea vlog", channel: "", views: 1000,
    link: "https://youtu.be/z", date: "2026-08-27", duration: 30,
  });
});

test("빈 입력 → 빈 배열", () => {
  assert.deepEqual(pickTopShorts([], { maxAgeDays: 7, limit: 2, koreaRegex: KOREA, now: NOW }), []);
});

test("duration이 숫자가 아니면 제외", () => {
  const out = pickTopShorts([cand({ id: "nan", duration: null })],
    { maxAgeDays: 7, limit: 5, koreaRegex: KOREA, now: NOW });
  assert.deepEqual(out, []);
});
