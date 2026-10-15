import { test } from "node:test";
import assert from "node:assert/strict";
import {
  COUNTRIES,
  countryLabel,
  nextCountry,
  advanceRotation,
  filterNewItems,
  filterRoundItems,
  markSeen,
  canonicalizeUrl,
  renderCountrySection,
  appendCountryFile,
} from "./_lib.mjs";

test("COUNTRIES: 8개국, 순서 고정", () => {
  assert.deepEqual(
    COUNTRIES.map((c) => c.code),
    ["vi", "th", "lo", "id", "my", "tl", "mn", "ru"],
  );
});

test("countryLabel: 알려진 코드는 한글 라벨, 모르는 코드는 코드 그대로", () => {
  assert.equal(countryLabel("vi"), "베트남");
  assert.equal(countryLabel("zz"), "zz");
});

test("nextCountry: order[nextIndex]를 반환", () => {
  const rotation = { order: ["vi", "th"], nextIndex: 1, history: [] };
  assert.equal(nextCountry(rotation), "th");
});

test("advanceRotation: 인덱스 증가 + history 추가", () => {
  const rotation = { order: ["vi", "th", "lo"], nextIndex: 0, history: [] };
  const next = advanceRotation(rotation, "vi", "2026-10-20");
  assert.equal(next.nextIndex, 1);
  assert.deepEqual(next.history, [{ country: "vi", date: "2026-10-20" }]);
  assert.deepEqual(rotation.history, [], "원본 객체는 그대로 둔다 (불변)");
});

test("advanceRotation: 마지막 국가 다음엔 0으로 랩어라운드", () => {
  const rotation = { order: ["vi", "th", "lo"], nextIndex: 2, history: [] };
  const next = advanceRotation(rotation, "lo", "2026-10-20");
  assert.equal(next.nextIndex, 0);
});

test("advanceRotation: order에 없는 국가면 에러", () => {
  const rotation = { order: ["vi", "th"], nextIndex: 0, history: [] };
  assert.throws(() => advanceRotation(rotation, "zz", "2026-10-20"), /zz/);
});

test("filterNewItems: 이미 본 URL은 빼고 새 것만 남긴다", () => {
  const seen = { vi: { "https://a.example/1": "2026-10-01" } };
  const items = [
    { url: "https://a.example/1", title: "old" },
    { url: "https://a.example/2", title: "new" },
  ];
  assert.deepEqual(filterNewItems(seen, "vi", items), [{ url: "https://a.example/2", title: "new" }]);
});

test("filterNewItems: 해당 국가 기록이 아예 없으면 전부 새 것", () => {
  const items = [{ url: "https://a.example/1", title: "x" }];
  assert.deepEqual(filterNewItems({}, "vi", items), items);
});

test("filterNewItems: 이번 라운드 배열 안에서 같은 URL이 여러 번 나와도 한 번만 남긴다", () => {
  const items = [
    { url: "https://a.example/1", title: "첫 검색" },
    { url: "https://a.example/1", title: "같은 글이 다른 검색어로 또 걸림" },
    { url: "https://a.example/2", title: "y" },
  ];
  const result = filterNewItems({}, "vi", items);
  assert.equal(result.length, 2);
  assert.deepEqual(result.map((it) => it.url), ["https://a.example/1", "https://a.example/2"]);
});

test("markSeen: 새 URL을 그 국가 밑에 추가, 다른 국가는 안 건드림", () => {
  const seen = { th: { "https://b.example/1": "2026-09-01" } };
  const items = [{ url: "https://a.example/1", title: "x" }, { url: "https://a.example/2", title: "y" }];
  const updated = markSeen(seen, "vi", items, "2026-10-20");
  assert.deepEqual(updated.th, { "https://b.example/1": "2026-09-01" });
  assert.deepEqual(updated.vi, {
    "https://a.example/1": "2026-10-20",
    "https://a.example/2": "2026-10-20",
  });
});

test("markSeen: 같은 라운드 안에서 같은 URL이 두 번 들어와도 한 번만 기록", () => {
  const items = [
    { url: "https://a.example/1", title: "x" },
    { url: "https://a.example/1", title: "x (중복 검색 결과)" },
  ];
  const updated = markSeen({}, "vi", items, "2026-10-20");
  assert.deepEqual(Object.keys(updated.vi), ["https://a.example/1"]);
});

test("renderCountrySection: 항목이 있으면 글머리표로, 없으면 안내 문구", () => {
  const md = renderCountrySection(
    "2026-10-20",
    [{ title: "비자 서류", summary: "요약1", url: "https://a.example/1" }],
    [],
  );
  assert.match(md, /## 2026-10-20 수집/);
  assert.match(md, /### 실용정보/);
  assert.match(md, /- \*\*비자 서류\*\* — 요약1 \[출처\]\(https:\/\/a\.example\/1\)/);
  assert.match(md, /### 연애·팬덤/);
  assert.match(md, /이번 라운드엔 새로 찾은 항목 없음/);
});

test("appendCountryFile: 빈 파일(처음)이면 제목 헤더부터 생성", () => {
  const out = appendCountryFile("", "베트남", "2026-10-20", [], []);
  assert.match(out, /^# 베트남 — SNS 리서치\n\n## 2026-10-20 수집/);
});

test("appendCountryFile: 기존 내용이 있으면 끝에 새 섹션만 이어붙임", () => {
  const existing = "# 베트남 — SNS 리서치\n\n## 2026-10-20 수집\n### 실용정보 (비자·서류·장학금·유학생 등)\n- (이번 라운드엔 새로 찾은 항목 없음)\n\n### 연애·팬덤 (K-pop/K-drama 반응, 국제커플)\n- (이번 라운드엔 새로 찾은 항목 없음)\n";
  const out = appendCountryFile(existing, "베트남", "2026-11-24", [], []);
  assert.ok(out.startsWith(existing.trimEnd()));
  assert.match(out, /## 2026-11-24 수집/);
  assert.equal(out.match(/^# 베트남/gm).length, 1, "헤더가 중복되면 안 된다");
});

test("canonicalizeUrl: 트래킹 파라미터(fb/ig/tiktok/utm) 제거, 호스트 소문자화, 끝 슬래시·해시 제거", () => {
  assert.equal(
    canonicalizeUrl("https://WWW.Facebook.com/reel/123/?__cft__[0]=abc&__tn__=xyz&mibextid=aaa"),
    "https://www.facebook.com/reel/123",
  );
  assert.equal(
    canonicalizeUrl("https://www.instagram.com/p/abc/?igsh=xyz123#comment"),
    "https://www.instagram.com/p/abc",
  );
  assert.equal(
    canonicalizeUrl("https://www.tiktok.com/@user/video/1?is_from_webapp=1&sender_device=pc"),
    "https://www.tiktok.com/@user/video/1",
  );
  assert.equal(
    canonicalizeUrl("https://example.com/a?utm_source=x&utm_medium=y&rdid=z&share_url=w"),
    "https://example.com/a",
  );
});

test("canonicalizeUrl: 파싱 불가능한 문자열은 그대로 반환, 빈 값은 null", () => {
  assert.equal(canonicalizeUrl("not a url"), "not a url");
  assert.equal(canonicalizeUrl(undefined), null);
  assert.equal(canonicalizeUrl(""), null);
});

test("filterNewItems: 트래킹 파라미터만 다른 같은 URL은 중복으로 처리", () => {
  const seen = { vi: { "https://www.facebook.com/reel/123": "2026-10-01" } };
  const items = [{ url: "https://www.facebook.com/reel/123?__cft__[0]=abc", title: "같은 글, 파라미터만 다름" }];
  assert.deepEqual(filterNewItems(seen, "vi", items), []);
});

test("filterNewItems / filterRoundItems: URL 없는 항목은 항상 통과(중복 판단 대상 아님)", () => {
  const items = [
    { title: "링크 못 받아온 글 1", summary: "s1" },
    { title: "링크 못 받아온 글 2", summary: "s2" },
  ];
  assert.equal(filterNewItems({}, "vi", items).length, 2);
  const { practical, fandom } = filterRoundItems({}, "vi", items, items);
  assert.equal(practical.length, 2);
  assert.equal(fandom.length, 2);
});

test("filterRoundItems: 같은 URL이 실용정보·연애팬덤 양쪽에 걸리면 한쪽에만 남는다", () => {
  const dup = { url: "https://www.tiktok.com/@user/video/1", title: "비자 얘기도 하고 K팝 얘기도 함" };
  const onlyFandom = { url: "https://www.tiktok.com/@user/video/2", title: "K팝 얘기만" };
  const { practical, fandom } = filterRoundItems({}, "vi", [dup], [dup, onlyFandom]);
  assert.deepEqual(practical, [dup]);
  assert.deepEqual(fandom, [onlyFandom]);
});

test("filterRoundItems: 기존 seen 기록은 양쪽 축 모두에 적용된다", () => {
  const seen = { vi: { "https://a.example/1": "2026-10-01" } };
  const { practical, fandom } = filterRoundItems(
    seen, "vi",
    [{ url: "https://a.example/1", title: "실용정보 쪽" }],
    [{ url: "https://a.example/1", title: "연애팬덤 쪽" }],
  );
  assert.deepEqual(practical, []);
  assert.deepEqual(fandom, []);
});

test("markSeen: URL 없는 항목은 기록하지 않는다 ('undefined'/'' 키가 생기면 안 됨)", () => {
  const items = [
    { title: "링크 없음", summary: "s" },
    { url: "https://a.example/1", title: "링크 있음" },
  ];
  const updated = markSeen({}, "vi", items, "2026-10-20");
  assert.deepEqual(Object.keys(updated.vi), ["https://a.example/1"]);
});

test("renderCountrySection: URL 없는 항목은 '링크 미확보'로 표시", () => {
  const md = renderCountrySection(
    "2026-10-20",
    [{ title: "링크 못 받아온 글", summary: "요약" }],
    [],
  );
  assert.match(md, /- \*\*링크 못 받아온 글\*\* — 요약 \(⚠️ 링크 미확보\)/);
  assert.doesNotMatch(md, /undefined/);
});
