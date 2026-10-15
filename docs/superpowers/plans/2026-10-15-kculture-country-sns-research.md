# K컬처 국가별 SNS 리서치 레이어 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** K컬처 파이프라인에 "국가별 SNS 리서치" 서브 레이어를 추가해서, 8개 대상 국가(베트남/태국/라오스/인도네시아/미얀마/필리핀/몽골/기타)를 라운드당 1개국씩 돌며 그 나라 언어로 SNS에서 (1)비자·서류·장학금 등 실용정보, (2)연애·팬덤 콘텐츠를 찾아 국가별 파일에 누적하고, 줍줍 뷰어의 K컬처 탭에서 국가별로 바로 볼 수 있게 한다.

**Architecture:** 순수 로직(로테이션 진행, 중복 URL 억제, 국가 파일에 새 섹션 append)은 `news-digest/kculture/countries/_lib.mjs`에 모아 단위 테스트로 검증한다. 실제 SNS 브라우징은 Claude in Chrome을 쓰는 에이전트 세션이 수동으로 수행하고 그 결과를 이 라이브러리로 파일에 반영한다(이 계획에서는 라이브러리·데이터·뷰어만 구현; 실제 브라우징 세션은 범위 밖). 뷰어(`viewer/server.mjs`, `viewer/index.html`)는 기존 날짜 기반 목록 옆에 국가 기반 목록을 추가로 보여주는 것으로 확장한다.

**Tech Stack:** Node.js (내장 `node:test`/`node:assert`/`node:fs`/`node:http`만 사용, 신규 npm 의존성 없음), 바닐라 JS 프런트엔드(`viewer/index.html`), Markdown/JSON 데이터 파일.

**Spec:** [docs/superpowers/specs/2026-10-15-kculture-country-sns-research-design.md](../specs/2026-10-15-kculture-country-sns-research-design.md)

## Global Constraints

- 대상 8개국·언어 매핑은 고정: vi=베트남, th=태국, lo=라오스, id=인도네시아, my=미얀마, tl(+en)=필리핀, mn=몽골, ru=기타(중앙아시아 등). 이 순서가 `rotation.json`의 `order` 기본값이다.
- 일반 뉴스 파이프라인(`news-digest/keywords.md`, `news-digest/fetch.mjs`, 네이버 검색)과 기존 Exa/RSS/Reddit 주간 다이제스트(`fetch-kculture.mjs`, `kculture/<날짜>.md`)는 이 작업에서 변경하지 않는다.
- 중복 억제는 카운트 기반(`seen-topics.json` 방식)이 아니라 "같은 URL은 다시 추가하지 않는다"는 1회성 체크다.
- `kculture/countries/<code>.md`(국가별 수집 결과)는 기존 kculture 규칙과 동일하게 **로컬 전용 — git에 커밋하지 않는다.** 반면 `rotation.json`/`seen.json`은 `news-digest/seen-topics.json`과 같은 급의 북키핑 상태 파일이라 **커밋한다.**
- 뷰어에 새 최상위 탭을 만들지 않는다 — 기존 "K컬처" 탭의 사이드바 안에 "국가별 리서치" 그룹을 추가하는 것으로 구현한다.
- 플랫폼(틱톡/인스타/페이스북)에는 "거주지=한국 AND 사용언어=X" 같은 계정 필터가 없다 — 이 사실을 `countries/README.md`에 명시하고, 대안으로 키워드/해시태그 기반 검색어를 쓴다.

## Review Focus

- 국가 파일이 아직 없는 나라(로테이션 1라운드 전)를 뷰어에서 클릭했을 때 — 에러 화면이 아니라 "아직 조사 전" 안내가 보여야 한다.
- `advanceRotation`에 `order`에 없는 국가 코드를 넘겼을 때 — 조용히 틀린 상태를 쓰지 말고 에러로 멈춰야 한다.
- 빈 문자열(파일이 아예 없던 상태)에 첫 섹션을 append할 때와, 이미 내용이 있는 파일에 두 번째 섹션을 append할 때 — 양쪽 다 헤더 중복이나 빈 줄 깨짐 없이 깨끗하게 이어붙어야 한다.
- 한 라운드에서 수집한 항목 배열 안에 같은 URL이 두 번 들어와도(같은 검색이 중복으로 걸린 경우) — `seen.json`에 중복 키가 쌓이거나 파일에 같은 항목이 두 번 추가되지 않아야 한다.
- 뷰어에서 국가별 리서치를 보다가 다른 날짜나 다른 탭(일반 뉴스)으로 옮겼을 때 — 이전에 보던 국가 내용이 그대로 남아있지(stale) 않아야 한다.

---

### Task 1: 로테이션/중복억제/파일누적 라이브러리

**Files:**
- Create: `news-digest/kculture/countries/_lib.mjs`
- Test: `news-digest/kculture/countries/_lib.test.mjs`
- Create: `news-digest/kculture/countries/rotation.json`
- Create: `news-digest/kculture/countries/seen.json`

**Interfaces:**
- Produces: `COUNTRIES` (배열, `{code, label}` 8개, 순서 고정), `countryLabel(code)`, `nextCountry(rotation)`, `advanceRotation(rotation, country, date)`, `filterNewItems(seen, country, items)` (items는 `{url, title, summary}` 배열), `markSeen(seen, country, items, date)`, `renderCountrySection(date, practicalItems, fandomItems)`, `appendCountryFile(existingMarkdown, countryLabel, date, practicalItems, fandomItems)` — 모두 Task 4에서 import해서 쓴다.

- [ ] **Step 1: 테스트 파일 작성 (실패할 것)**

```js
// news-digest/kculture/countries/_lib.test.mjs
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
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `node --test news-digest/kculture/countries/_lib.test.mjs`
Expected: FAIL (모듈 `./_lib.mjs`를 찾을 수 없음)

- [ ] **Step 3: 라이브러리 구현**

```js
// news-digest/kculture/countries/_lib.mjs
// K컬처 "국가별 SNS 리서치" 로테이션/중복억제/파일누적 순수 로직.
// 실제 SNS 브라우징(Claude in Chrome)은 이 모듈을 쓰는 에이전트 세션이 담당한다.

export const COUNTRIES = [
  { code: "vi", label: "베트남" },
  { code: "th", label: "태국" },
  { code: "lo", label: "라오스" },
  { code: "id", label: "인도네시아" },
  { code: "my", label: "미얀마" },
  { code: "tl", label: "필리핀" },
  { code: "mn", label: "몽골" },
  { code: "ru", label: "기타(중앙아시아 등)" },
];

export function countryLabel(code) {
  const found = COUNTRIES.find((c) => c.code === code);
  return found ? found.label : code;
}

export function nextCountry(rotation) {
  return rotation.order[rotation.nextIndex % rotation.order.length];
}

export function advanceRotation(rotation, country, date) {
  const idx = rotation.order.indexOf(country);
  if (idx === -1) throw new Error(`advanceRotation: unknown country code "${country}" (not in order)`);
  return {
    ...rotation,
    nextIndex: (idx + 1) % rotation.order.length,
    history: [...rotation.history, { country, date }],
  };
}

export function filterNewItems(seen, country, items) {
  const seenUrls = new Set(Object.keys(seen[country] || {}));
  const batchUrls = new Set();
  const result = [];
  for (const item of items) {
    if (seenUrls.has(item.url) || batchUrls.has(item.url)) continue;
    batchUrls.add(item.url);
    result.push(item);
  }
  return result;
}

export function markSeen(seen, country, items, date) {
  const updated = { ...seen, [country]: { ...(seen[country] || {}) } };
  for (const item of items) updated[country][item.url] = date;
  return updated;
}

function renderItems(items) {
  return items.length
    ? items.map((it) => `- **${it.title}** — ${it.summary} [출처](${it.url})`).join("\n")
    : "- (이번 라운드엔 새로 찾은 항목 없음)";
}

export function renderCountrySection(date, practicalItems, fandomItems) {
  return [
    `## ${date} 수집`,
    "### 실용정보 (비자·서류·장학금·유학생 등)",
    renderItems(practicalItems),
    "",
    "### 연애·팬덤 (K-pop/K-drama 반응, 국제커플)",
    renderItems(fandomItems),
  ].join("\n");
}

export function appendCountryFile(existingMarkdown, label, date, practicalItems, fandomItems) {
  const section = renderCountrySection(date, practicalItems, fandomItems);
  if (!existingMarkdown || !existingMarkdown.trim()) {
    return `# ${label} — SNS 리서치\n\n${section}\n`;
  }
  return `${existingMarkdown.trimEnd()}\n\n${section}\n`;
}
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `node --test news-digest/kculture/countries/_lib.test.mjs`
Expected: PASS (전체 테스트 통과)

- [ ] **Step 5: 로테이션/중복억제 초기 상태 파일 생성**

```json
// news-digest/kculture/countries/rotation.json
{
  "order": ["vi", "th", "lo", "id", "my", "tl", "mn", "ru"],
  "nextIndex": 0,
  "history": []
}
```

```json
// news-digest/kculture/countries/seen.json
{}
```

- [ ] **Step 6: 커밋**

```bash
git add news-digest/kculture/countries/_lib.mjs news-digest/kculture/countries/_lib.test.mjs news-digest/kculture/countries/rotation.json news-digest/kculture/countries/seen.json
git commit -m "feat(kculture): 국가별 SNS 리서치 로테이션/중복억제 라이브러리 추가"
```

---

### Task 2: 국가별 검색어 참고 목록 + 절차 문서

**Files:**
- Create: `news-digest/kculture/countries/keywords.md`
- Create: `news-digest/kculture/countries/README.md`

**Interfaces:**
- Consumes: Task 1의 `COUNTRIES` 목록 (8개국 코드/라벨)과 동일한 국가 순서를 그대로 따른다.
- Produces: 없음 (콘텐츠 전용 — 에이전트 세션이 라운드를 진행할 때 참고하는 문서).

이 태스크는 코드가 아니라 참고 문서라 자동 테스트가 없다. "테스트"는 파일이 8개국 전부를 빠짐없이 다루는지 눈으로 확인하는 것이다.

- [ ] **Step 1: 국가별 검색어 참고 목록 작성**

`news-digest/keywords.md`의 실용정보 카테고리(비자 연장, 체류자격, 외국인등록증, 사회통합프로그램, 장학금, 입국 전 준비 등)와 `news-digest/kculture/sources.json`의 연애·K-pop·K-drama 쿼리를 8개 언어로 번역해서 정리한다. 각 국가 섹션에 "유학생/거주자 식별용" 검색어를 별도로 넣는다(스펙의 "검색어 설계" 섹션 참고).

```markdown
# 국가별 SNS 검색어 참고 목록

`news-digest/keywords.md`(실용정보)와 `news-digest/kculture/sources.json`(연애·팬덤)을
8개 언어로 번역한 참고 목록. 자유롭게 추가·수정하세요. `countries/_lib.mjs`의 `COUNTRIES`
순서와 동일합니다.

## 베트남 (vi)
### 실용정보
- 베트남 유학생, du học sinh Việt Nam tại Hàn Quốc
- người Việt ở Hàn Quốc (한국에 사는 베트남인)
- gia hạn visa Hàn Quốc (한국 비자 연장)
- đăng ký người nước ngoài Hàn Quốc (외국인등록증)
- học bổng du học Hàn Quốc (한국 유학 장학금)
### 연애·팬덤
- hẹn hò với người Hàn Quốc (한국인과 연애)
- cặp đôi quốc tế Hàn Quốc (국제커플 한국)
- phản ứng Kpop Việt Nam (K-pop 베트남 반응)
- phim Hàn Quốc được yêu thích (인기 한국 드라마)

## 태국 (th)
### 실용정보
- นักเรียนไทยในเกาหลี (태국 유학생 한국)
- คนไทยอาศัยอยู่เกาหลี (한국에 사는 태국인)
- ต่อวีซ่าเกาหลี (한국 비자 연장)
- ทะเบียนคนต่างด้าวเกาหลี (외국인등록증)
- ทุนเรียนต่อเกาหลี (한국 유학 장학금)
### 연애·팬덤
- เดทกับผู้ชายเกาหลี / เดทกับผู้หญิงเกาหลี (한국인과 연애)
- คู่รักนานาชาติเกาหลี (국제커플 한국)
- ปฎิกิริยาแฟนเพลงเกาหลีไทย (K-pop 태국 반응)

## 라오스 (lo)
### 실용정보
- ນັກສຶກສາລາວໃນເກົາຫຼີ (라오스 유학생 한국)
- ຄົນລາວຢູ່ເກົາຫຼີ (한국에 사는 라오스인)
- ຕໍ່ວີຊາເກົາຫຼີ (한국 비자 연장)
- ທະບຽນຄົນຕ່າງປະເທດເກົາຫຼີ (외국인등록증)
### 연애·팬덤
- ອອກເດດກັບຄົນເກົາຫຼີ (한국인과 연애)
- ຄູ່ຮັກສາກົນເກົາຫຼີ (국제커플 한국)

## 인도네시아 (id)
### 실용정보
- mahasiswa Indonesia di Korea (인도네시아 유학생 한국)
- orang Indonesia tinggal di Korea (한국에 사는 인도네시아인)
- perpanjang visa Korea (한국 비자 연장)
- kartu pendaftaran orang asing Korea (외국인등록증)
- beasiswa kuliah di Korea (한국 유학 장학금)
### 연애·팬덤
- pacaran dengan orang Korea (한국인과 연애)
- pasangan internasional Korea (국제커플 한국)
- reaksi Kpop Indonesia (K-pop 인도네시아 반응)

## 미얀마 (my)
### 실용정보
- မြန်မာကျောင်းသား ကိုရီးယား (미얀마 유학생 한국)
- ကိုရီးယားမှာနေထိုင်တဲ့ မြန်မာလူမျိုး (한국에 사는 미얀마인)
- ကိုရီးယားဗီဇာသက်တမ်းတိုး (한국 비자 연장)
- ကိုရီးယားနိုင်ငံခြားသားမှတ်ပုံတင် (외국인등록증)
### 연애·팬덤
- ကိုရီးယားလူမျိုးနှင့် တွေ့ဆုံခြင်း (한국인과 연애)
- နိုင်ငံတကာချစ်သူများ ကိုရီးယား (국제커플 한국)

## 필리핀 (tl + en)
### 실용정보
- Pilipino estudyante sa Korea / Filipino student in Korea
- Pilipino naninirahan sa Korea / Filipino living in Korea
- pag-renew ng Korea visa / Korea visa extension
- Alien Registration Card Korea
- scholarship mag-aral sa Korea / scholarship study in Korea
### 연애·팬덤
- dating a Korean guy/girl (Filipino experience)
- international couple Korea Philippines
- Pinoy Kpop fan reaction / Pinoy K-drama reaction

## 몽골 (mn)
### 실용정보
- Солонгост байдаг монгол оюутнууд (몽골 유학생 한국)
- Солонгост амьдардаг монголчууд (한국에 사는 몽골인)
- Солонгосын визээ сунгах (한국 비자 연장)
- Солонгосын гадаадын иргэний бүртгэл (외국인등록증)
- Солонгост суралцах тэтгэлэг (한국 유학 장학금)
### 연애·팬덤
- Солонгос хүнтэй үерхэх (한국인과 연애)
- олон улсын хос Солонгос (국제커플 한국)

## 기타(중앙아시아 등, ru)
### 실용정보
- узбекские/казахские студенты в Корее (우즈벡/카자흐 유학생 한국)
- живу в Корее (иностранец) (한국에 거주하는 외국인)
- продление визы Корея (한국 비자 연장)
- регистрация иностранца в Корее (외국인등록증)
- стипендия на учёбу в Корее (한국 유학 장학금)
### 연애·팬덤
- встречаюсь с корейцем/корейкой (한국인과 연애)
- международная пара Корея (국제커플 한국)
```

- [ ] **Step 2: 절차 문서 작성**

```markdown
# 국가별 SNS 리서치 — 절차

K컬처 "국가별 SNS 리서치" 레이어의 운영 절차. 전체 설계는
[2026-10-15-kculture-country-sns-research-design.md](../../../docs/superpowers/specs/2026-10-15-kculture-country-sns-research-design.md)
참고. `../README.md`의 기존 주간 다이제스트(Exa/RSS/Reddit, 날짜별)와는 별개 레이어다.

## 중요: 플랫폼엔 "거주지=한국 + 언어=X" 필터가 없다

틱톡·인스타그램·페이스북 어디에도 "이 계정은 한국에 거주하고 베트남어를 쓴다" 같은
조합 필터를 일반 검색/탐색에서 쓸 방법이 없다(광고주 전용 타겟팅 도구로만 존재).
그래서 이 절차는 그런 필터를 흉내 내지 않고, **본인이 스스로 "한국에 사는 OO인"
또는 "한국 유학생"이라고 밝히는 계정·게시물**을 `keywords.md`의 검색어로 찾는다.

## 라운드 진행 순서

1. `rotation.json`을 읽어 `nextCountry(rotation)`으로 이번 라운드의 국가를 정한다.
2. `keywords.md`에서 그 나라 섹션(실용정보 + 연애·팬덤)의 검색어를 가져온다.
3. Claude in Chrome으로 사용자의 로그인된 세션에 들어가 페이스북·인스타·틱톡에서
   가볍게 검색한다 — 계정 보호 원칙은 `../README.md`의 "SNS 직접 브라우징" 섹션과
   동일(검색 2~3개, 좋아요·팔로우 등 액션 없음, 느리게).
4. 찾은 항목을 `{url, title, summary}` 형태로 정리하고, `seen.json`과
   `filterNewItems(seen, country, items)`로 신규 항목만 추려낸다.
5. `appendCountryFile(기존 내용, 국가 라벨, 오늘 날짜, 실용정보 신규 항목, 연애팬덤 신규 항목)`로
   `countries/<code>.md`를 갱신한다(파일이 없으면 새로 생성).
6. `markSeen`으로 `seen.json`을 갱신하고, `advanceRotation`으로 `rotation.json`을 다음
   국가로 넘긴다.
7. `countries/<code>.md`는 기존 kculture 규칙과 동일하게 **로컬 전용 — git 커밋 안 함**.
   `rotation.json`/`seen.json`은 북키핑 상태 파일이라 커밋한다.
8. 처리한 국가·건수를 대화창에 짧게 보고한다.
```

- [ ] **Step 3: 커밋**

```bash
git add news-digest/kculture/countries/keywords.md news-digest/kculture/countries/README.md
git commit -m "docs(kculture): 국가별 SNS 검색어 참고 목록 + 절차 문서 추가"
```

---

### Task 3: 기존 K컬처 README의 아세안 로테이션 섹션 교체

**Files:**
- Modify: `news-digest/kculture/README.md`

**Interfaces:**
- Consumes: Task 2의 `countries/README.md`, `countries/keywords.md` (경로 참조).

- [ ] **Step 1: 기존 "아세안 국가 커버리지 진행 현황" 섹션을 새 레이어 안내로 교체**

`news-digest/kculture/README.md`에서 다음 블록(아세안 10개국 로테이션 설명)을 찾는다:

```
### 아세안 국가 커버리지 진행 현황 (매 회차 갱신)
완료: 베트남, 필리핀 (2026-10-14)
다음 순번: 태국 → 인도네시아 → 말레이시아 → 미얀마 → 라오스 → 캄보디아 → 싱가포르 →
브루나이 (한 바퀴 돌면 다시 베트남부터)
```

이 블록을 아래로 교체한다:

```
### 국가별 SNS 리서치 (2026-10-15 개편)
아세안 10개국을 라운드당 2개국씩 돌던 방식은 폐기했다. 대신 줍줍이 실제 쓰는 8개
국가(베트남/태국/라오스/인도네시아/미얀마/필리핀/몽골/기타)를 라운드당 1개국씩 돌면서,
연애·팬덤뿐 아니라 비자·서류·장학금 등 실용정보까지 같이 찾아 국가별 파일에 누적하는
방식으로 바뀌었다. 절차는 `countries/README.md`, 검색어는 `countries/keywords.md`,
로테이션 상태는 `countries/rotation.json` 참고. 2026-10-14에 옛 방식으로 수집한
베트남·필리핀 내용(연애·팬덤만)은 이 `kculture/2026-10-14.md`에 그대로 남아있다 —
새 국가별 파일로 옮기지 않았다.
```

- [ ] **Step 2: 커밋**

```bash
git add news-digest/kculture/README.md
git commit -m "docs(kculture): README의 아세안 로테이션 안내를 국가별 리서치 레이어로 교체"
```

---

### Task 4: 뷰어 백엔드 — 국가 목록/내용 API

**Files:**
- Modify: `news-digest/viewer/server.mjs`
- Test: `news-digest/viewer/server.test.mjs`

**Interfaces:**
- Consumes: Task 1의 `COUNTRIES` (`import { COUNTRIES } from "../kculture/countries/_lib.mjs"`).
- Produces: `listCountries(dir = COUNTRIES_DIR)` → `[{code, label, updated: number|null}]` (Task 5가 `/api/list`와 `/api/country/:code` 응답 형태로 소비).
  - `GET /api/list`의 `kculture` 항목에 `countries: listCountries()` 필드 추가.
  - `GET /api/country/:code` → 200 `{file, mtime, markdown}` (파일 있음) / 400 (모르는 코드) / 404 (아직 파일 없음).

- [ ] **Step 1: 실패하는 테스트 작성**

```js
// news-digest/viewer/server.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { listCountries } from "./server.mjs";

test("listCountries: 파일이 하나도 없으면 8개국 전부 updated=null", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "kculture-countries-"));
  try {
    const list = listCountries(dir);
    assert.equal(list.length, 8);
    assert.ok(list.every((c) => c.updated === null));
    assert.deepEqual(list.map((c) => c.code), ["vi", "th", "lo", "id", "my", "tl", "mn", "ru"]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("listCountries: 파일이 있는 나라만 mtime을 돌려준다", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "kculture-countries-"));
  try {
    writeFileSync(path.join(dir, "vi.md"), "# 베트남 — SNS 리서치\n");
    const list = listCountries(dir);
    const vi = list.find((c) => c.code === "vi");
    const th = list.find((c) => c.code === "th");
    assert.ok(typeof vi.updated === "number" && vi.updated > 0);
    assert.equal(th.updated, null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `node --test news-digest/viewer/server.test.mjs`
Expected: FAIL (`listCountries`가 `server.mjs`에서 export되지 않음)

- [ ] **Step 3: `server.mjs` 수정**

`import` 블록 상단(`import { exec } from "node:child_process";` 바로 아래)에 추가:

```js
import { pathToFileURL } from "node:url";
import { COUNTRIES } from "../kculture/countries/_lib.mjs";
```

(기존 `import { fileURLToPath } from "node:url";` 줄이 있으므로, 한 줄로 합쳐도 된다: `import { fileURLToPath, pathToFileURL } from "node:url";` — 기존 줄을 이걸로 바꾼다.)

`const SECTIONS = { ... };` 바로 아래에 추가:

```js
const COUNTRIES_DIR = path.join(DIGEST_DIR, "kculture", "countries");

export function listCountries(dir = COUNTRIES_DIR) {
  return COUNTRIES.map(({ code, label }) => {
    const file = path.join(dir, `${code}.md`);
    let updated = null;
    try {
      updated = statSync(file).mtimeMs;
    } catch {
      // 아직 이 나라는 조사 전
    }
    return { code, label, updated };
  });
}
```

`GET /api/list` 핸들러를 다음으로 바꾼다(루프 뒤에 한 줄 추가):

```js
    if (u.pathname === "/api/list") {
      const out = {};
      for (const key of Object.keys(SECTIONS)) {
        out[key] = { label: SECTIONS[key].label, days: listSection(key), log: tailLog(SECTIONS[key].log) };
      }
      out.kculture.countries = listCountries();
      return send(res, 200, out);
    }
```

`GET /api/summary|raw` 블록 바로 뒤에 새 라우트 추가:

```js
    // GET /api/country/:code → 국가별 누적 SNS 리서치 파일 원문
    if (parts[0] === "api" && parts[1] === "country" && parts.length === 3) {
      const code = parts[2];
      if (!COUNTRIES.some((c) => c.code === code)) return send(res, 400, { error: "bad request" });
      const file = path.join(COUNTRIES_DIR, `${code}.md`);
      if (!existsSync(file)) return send(res, 404, { error: "not found" });
      return send(res, 200, { file: `${code}.md`, mtime: statSync(file).mtimeMs, markdown: readText(file) });
    }
```

파일 맨 아래, 기존 `server.on("error", ...)`과 `server.listen(...)` 호출을 `start()` 함수로 감싸고 모듈이 "메인으로 직접 실행될 때만" 돌게 가드를 추가한다. 기존:

```js
server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.log(`이미 실행 중입니다 → ${URL_}`);
    openBrowser();
    setTimeout(() => process.exit(0), 500);
  } else {
    console.error(err);
    process.exit(1);
  }
});

server.listen(PORT, HOST, () => {
  console.log(`줍줍 뉴스 뷰어 실행 중 → ${URL_}`);
  console.log(`보는 폴더: ${DIGEST_DIR}`);
  console.log("이 창을 닫으면 뷰어가 꺼집니다.");
  openBrowser();
});
```

를 이렇게 바꾼다:

```js
function start() {
  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.log(`이미 실행 중입니다 → ${URL_}`);
      openBrowser();
      setTimeout(() => process.exit(0), 500);
    } else {
      console.error(err);
      process.exit(1);
    }
  });

  server.listen(PORT, HOST, () => {
    console.log(`줍줍 뉴스 뷰어 실행 중 → ${URL_}`);
    console.log(`보는 폴더: ${DIGEST_DIR}`);
    console.log("이 창을 닫으면 뷰어가 꺼집니다.");
    openBrowser();
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  start();
}
```

(이렇게 해야 `server.test.mjs`가 `import { listCountries } from "./server.mjs"`로 모듈을 불러올 때 실제로 포트를 열거나 브라우저를 띄우지 않는다.)

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `node --test news-digest/viewer/server.test.mjs`
Expected: PASS

- [ ] **Step 5: 전체 테스트 스위트 실행 — 회귀 확인**

Run: `npm test`
Expected: PASS (기존 테스트들도 모두 그대로 통과)

- [ ] **Step 6: 커밋**

```bash
git add news-digest/viewer/server.mjs news-digest/viewer/server.test.mjs
git commit -m "feat(viewer): K컬처 국가별 리서치 목록/내용 API 추가"
```

---

### Task 5: 뷰어 프런트엔드 — K컬처 탭에 국가별 리서치 그룹 추가

**Files:**
- Modify: `news-digest/viewer/index.html`

**Interfaces:**
- Consumes: Task 4의 `/api/list`(kculture 섹션의 `countries` 필드) · `/api/country/:code`.

이 파일은 바닐라 JS 프런트엔드라 자동 테스트가 없다. 대신 실제 뷰어를 띄워 브라우저에서
확인하는 것이 이 태스크의 "테스트"다.

- [ ] **Step 1: `state` 초기값에 `countryCode` 추가**

```js
const state = { data: null, section: "daily", date: null, view: "summary", countryCode: null,
  raw: { items: [], source: "all", keyword: "", q: "", shown: 60 } };
```

- [ ] **Step 2: 탭 전환 시 `countryCode` 초기화**

`renderTabs()` 안의 클릭 핸들러를 다음으로 바꾼다:

```js
  $("#tabs").querySelectorAll(".tab").forEach((b) => b.onclick = () => {
    state.section = b.dataset.k; state.date = null; state.countryCode = null; pickDefaultDate(); renderTabs(); renderDays(); renderMain();
  });
```

- [ ] **Step 3: `renderDays()`에 "국가별 리서치" 그룹 추가**

전체 `renderDays()` 함수를 다음으로 교체한다:

```js
function renderDays() {
  const sec = state.data[state.section];
  const days = sec.days;
  let html = `<h2>날짜</h2>` + (days.length ? days.map((d) =>
    `<button class="day ${!state.countryCode && d.date === state.date ? "on" : ""}" data-d="${d.date}">
       <span class="d">${d.date}</span>
       ${d.summary ? '<span class="badge s">요약</span>' : ""}${d.raw ? '<span class="badge">원본</span>' : ""}
     </button>`).join("") : '<div class="empty">아직 결과 없음</div>');
  if (sec.countries) {
    html += `<h2>국가별 리서치</h2>` + sec.countries.map((c) =>
      `<button class="day ${state.countryCode === c.code ? "on" : ""}" data-c="${c.code}">
         <span class="d">${esc(c.label)}</span>
         ${c.updated ? `<span class="badge s">${new Date(c.updated).toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" })}</span>` : '<span class="badge">조사 전</span>'}
       </button>`).join("");
  }
  $("#days").innerHTML = html;
  $("#days").querySelectorAll(".day[data-d]").forEach((b) => b.onclick = () => {
    state.date = b.dataset.d; state.countryCode = null; const d = currentDay();
    if (state.view === "summary" && !d.summary) state.view = "raw";
    if (state.view === "raw" && !d.raw) state.view = "summary";
    renderDays(); renderMain();
  });
  $("#days").querySelectorAll(".day[data-c]").forEach((b) => b.onclick = () => {
    state.countryCode = b.dataset.c; state.date = null;
    renderDays(); renderMain();
  });
}
```

- [ ] **Step 4: `renderMain()`에 국가 보기 분기 추가**

`renderMain()` 함수 맨 앞(`const main = $("#main"); const d = currentDay();` 줄 이전)에
국가 보기 분기를 추가한다:

```js
async function renderMain() {
  const main = $("#main");
  if (state.countryCode) {
    const sec = state.data[state.section];
    const c = (sec.countries || []).find((x) => x.code === state.countryCode);
    main.innerHTML = `<div class="bar"><span class="meta">${c && c.updated ? "최종 갱신 " + new Date(c.updated).toLocaleString("ko-KR") : "아직 조사 전"}</span></div><div id="content"><div class="empty">불러오는 중…</div></div>`;
    const box = $("#content");
    const r = await (await fetch(`/api/country/${state.countryCode}`)).json();
    box.innerHTML = r.error
      ? '<div class="empty">아직 이 나라는 조사된 내용이 없어요.</div>'
      : `<div class="doc"><div class="card md">${renderMd(r.markdown)}</div></div>`;
    return;
  }
  const d = currentDay();
  // ...이하 기존 코드 그대로...
```

(이 줄 뒤로는 `renderMain()`의 나머지 기존 내용을 그대로 둔다 — 날짜 기반 요약/원본
렌더링 로직은 변경 없음.)

- [ ] **Step 5: 뷰어를 띄워 브라우저에서 확인**

```bash
node news-digest/viewer/server.mjs --no-open
```

브라우저에서 `http://localhost:3030` 열고 다음을 확인한다:
1. "K컬처" 탭을 누르면 사이드바에 "날짜" 그룹 밑으로 "국가별 리서치" 그룹이 보이고
   8개국 버튼이 전부 "조사 전" 배지로 보인다(아직 `countries/*.md` 파일이 없으므로).
2. 국가 버튼 하나를 클릭하면 본문에 "아직 이 나라는 조사된 내용이 없어요." 안내가 뜬다
   (에러 화면이 아님).
3. 날짜 그룹의 다른 날짜를 클릭하면 국가 버튼의 `on` 하이라이트가 풀리고 평소처럼 그 날짜
   요약이 보인다(상태가 서로 안 엉킴).
4. "일반 뉴스" 탭으로 옮기면 "국가별 리서치" 그룹 자체가 안 보인다(그 탭 데이터엔
   `countries` 필드가 없으므로).
5. (선택) `news-digest/kculture/countries/vi.md`에 아래 내용을 임시로 만들어두고 새로고침해서
   국가 보기가 마크다운을 정상적으로 렌더링하는지 확인한 뒤 테스트 파일을 지운다:
   ```markdown
   # 베트남 — SNS 리서치

   ## 2026-10-20 수집
   ### 실용정보 (비자·서류·장학금·유학생 등)
   - **테스트 항목** — 확인용. [출처](https://example.com)

   ### 연애·팬덤 (K-pop/K-drama 반응, 국제커플)
   - (이번 라운드엔 새로 찾은 항목 없음)
   ```

- [ ] **Step 6: 커밋**

```bash
git add news-digest/viewer/index.html
git commit -m "feat(viewer): K컬처 탭 사이드바에 국가별 리서치 그룹 추가"
```
