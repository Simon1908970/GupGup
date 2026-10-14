import { test } from "node:test";
import assert from "node:assert/strict";
import {
  COUNTRIES,
  countryLabel,
  nextCountry,
  advanceRotation,
  filterNewItems,
  markSeen,
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
