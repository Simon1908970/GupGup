# K-컬처 & 라이프 주간 다이제스트 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기존 네이버 일일 파이프라인 옆에서 주 1회 도는 별도 다이제스트를 만든다 — K-pop 소식 / K-drama 소식 / 한국인과의 연애 후기 / 동남아 언어 Korea Shorts(각국 조회수 top 2)를, agent-reach 도구(Exa·RSS·YouTube·Reddit·TikTok)로 수집·요약한다.

**Architecture:** 하이브리드. 브라우저가 필요 없는 소스(Exa 웹검색, RSS, YouTube Shorts)는 `news-digest/fetch-kculture.mjs` 스크립트가 모아 `news-digest/kculture/raw-kculture-<date>.json`을 쓴다. 브라우저 세션이 필요한 소스(Reddit, TikTok)는 사용자가 "K컬처 요약해줘"로 트리거한 에이전트 세션이 그 자리에서 수집해 같은 raw 파일에 append하고 전체를 `news-digest/kculture/<date>.md`로 요약한다. 공통 헬퍼는 `news-digest/_lib.mjs`로 뽑아 기존 `fetch.mjs`와 공유한다.

**Tech Stack:** Node.js 24, ESM `.mjs` (번들러 없음, `node`로 직접 실행), `node:test` 내장 테스트 러너, `rss-parser` (신규 의존성), 외부 CLI `mcporter`(Exa)·`yt-dlp`(이미 전역 설치됨).

**Spec:** `docs/superpowers/specs/2026-08-29-kculture-weekly-digest-design.md`

## Global Constraints

모든 태스크의 요구사항에 아래가 암묵적으로 포함된다. 값은 스펙에서 그대로 옮긴 것.

- 스크립트는 ESM `.mjs`, `node <path>`로 직접 실행. 번들러·트랜스파일 없음.
- `fetch-kculture.mjs`는 `.env.local`을 요구하지 않는다 (Exa 키리스, yt-dlp 키 없음).
- 공통 항목 스키마: `{ source, keyword, title, description, link, date }` (+ 소스별 추가 필드 허용).
- `KOREA_REGEX = /korea|korean|한국|케이팝|k-?pop|k-?drama|hallyu|한류|kdrama/i` — `g` 플래그 금지(`.test()` 상태성 회피).
- 생성물(`raw-kculture-*.json`, 날짜형 `<date>.md`)은 **로컬 전용**. `.gitignore` 처리, 절대 커밋하지 않음. `README.md`·`TEMPLATE.md`·`sources.json`·코드는 커밋.
- 보존 기간 60일 (raw json + 날짜형 md).
- 쇼츠: 4개국 `vietnam / thailand / indonesia / philippines`, YouTube만, `view_count` 상위 2개, `duration ≤ 60`, 업로드 ≤ 7일(부족 시 14일 폴백), 한국 관련어 포함.
- 편집 규칙: 연애 후기 섹션은 개인 식별정보 제거·주제 단위 집계, 원문 전문 복사 금지, 루머·광고 제외.
- 다이제스트 언어: 제목 = 원어 + 괄호 한국어 번역, 요약 문장 = 한국어.
- 4개 섹션 고정 순서: K-pop 소식 / K-drama 소식 / 한국인과의 연애 후기 / 동남아 쇼츠.
- v1에 seen-topics 없음.
- 테스트 러너: `node --test` (외부 프레임워크 없음).

---

## File Structure

| 파일 | 역할 | 태스크 |
|---|---|---|
| `news-digest/_lib.mjs` | 공통 헬퍼: `kstDate()`, `stripTags()`, `purgeOldFiles()` | 1 |
| `news-digest/_lib.test.mjs` | `_lib.mjs` 단위 테스트 | 1 |
| `news-digest/fetch.mjs` | (수정) 로컬 헬퍼 → `_lib.mjs` import | 1 |
| `package.json` | (수정) `test` 스크립트 추가; 이후 `rss-parser` 의존성 | 1, 4 |
| `news-digest/kculture/pickTopShorts.mjs` | 쇼츠 필터·랭킹 순수 함수 | 2 |
| `news-digest/kculture/pickTopShorts.test.mjs` | 위 단위 테스트 | 2 |
| `news-digest/kculture/sources.json` | Exa 쿼리·RSS 피드·국가별 쇼츠 검색어·Reddit 쿼리 (사람이 편집) | 3 |
| `news-digest/fetch-kculture.mjs` | 주간 수집기: Exa + RSS + Shorts → raw json | 3–6 |
| `news-digest/fetch-kculture.test.mjs` | 위 파싱·수집 로직 단위 테스트 | 3–6 |
| `.gitignore` | (수정) 생성물 2줄 제외 | 6 |
| `news-digest/kculture/README.md` | 에이전트 주간 요약 절차 + 편집 규칙 | 7 |
| `news-digest/kculture/TEMPLATE.md` | 출력 형식 견본 | 7 |
| `news-digest/run-fetch-kculture.ps1` | (선택) 작업 스케줄러용 래퍼 | 7 |
| `CLAUDE.md` | (수정) "K컬처 요약해줘" 트리거 포인터 섹션 | 7 |

`fetch-kculture.mjs`는 한 파일이지만 내부가 명확히 분리된 함수들(`collectExa` / `collectRss` / `collectShorts` / `mergeAndDedupe` / `main`)이며, 각 수집기는 실행 의존성(subprocess·parser)을 인자로 주입받아 단위 테스트가 subprocess 없이 돈다.

---

## Task 1: 공통 헬퍼 `_lib.mjs` 추출 + `fetch.mjs` 리팩터

**Files:**
- Create: `news-digest/_lib.mjs`
- Create: `news-digest/_lib.test.mjs`
- Modify: `news-digest/fetch.mjs` (헬퍼 정의 제거, import 추가; 현재 `stripTags` ≈ L46–54, `purgeOldRawFiles` ≈ L65–81, KST 날짜 ≈ L138)
- Modify: `package.json` (`scripts.test` 추가)

**Interfaces:**
- Produces:
  - `kstDate(d = new Date()) → string` — `"YYYY-MM-DD"`, `Asia/Seoul` 기준
  - `stripTags(s: string) → string` — HTML 태그 제거 + `&quot; &amp; &lt; &gt;` 디코드 + `trim()`
  - `purgeOldFiles(dir: string, pattern: RegExp, retentionDays: number) → string[]` — `dir` 안에서 `pattern` 매칭 & `mtime`이 `retentionDays`보다 오래된 파일 삭제, 삭제한 파일명 배열 반환. `dir` 없으면 `[]`.

- [ ] **Step 1: 실패하는 테스트 작성**

Create `news-digest/_lib.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, utimesSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { kstDate, stripTags, purgeOldFiles } from "./_lib.mjs";

test("kstDate: YYYY-MM-DD 형식", () => {
  assert.match(kstDate(new Date("2026-08-29T00:00:00Z")), /^\d{4}-\d{2}-\d{2}$/);
});

test("kstDate: Asia/Seoul(UTC+9) — UTC 20:00은 다음날 KST", () => {
  assert.equal(kstDate(new Date("2026-08-29T20:00:00Z")), "2026-08-30");
});

test("stripTags: 태그 제거 + 엔티티 디코드", () => {
  assert.equal(stripTags("<b>A</b> &amp; <i>B</i>"), "A & B");
  assert.equal(stripTags("  &lt;tag&gt; &quot;q&quot;  "), '<tag> "q"');
});

test("purgeOldFiles: 오래되고 패턴 매칭하는 파일만 삭제, 삭제 목록 반환", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "purge-"));
  const old = path.join(dir, "raw-2020-01-01.json");
  const fresh = path.join(dir, "raw-2099-01-01.json");
  const other = path.join(dir, "keep.txt");
  writeFileSync(old, "{}");
  writeFileSync(fresh, "{}");
  writeFileSync(other, "x");
  const oldSecs = Date.now() / 1000 - 70 * 24 * 60 * 60;
  utimesSync(old, oldSecs, oldSecs);

  const purged = purgeOldFiles(dir, /^raw-\d{4}-\d{2}-\d{2}\.json$/, 60);

  assert.deepEqual(purged, ["raw-2020-01-01.json"]);
  assert.ok(!existsSync(old), "old 삭제됨");
  assert.ok(existsSync(fresh), "fresh 유지");
  assert.ok(existsSync(other), "비매칭 파일 유지");
});

test("purgeOldFiles: 없는 디렉터리는 [] 반환", () => {
  assert.deepEqual(
    purgeOldFiles(path.join(tmpdir(), "nope-" + Date.now()), /./, 1),
    [],
  );
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `node --test news-digest/_lib.test.mjs`
Expected: FAIL — `Cannot find module './_lib.mjs'` (또는 export 미정의).

- [ ] **Step 3: `_lib.mjs` 구현**

Create `news-digest/_lib.mjs`:

```js
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
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `node --test news-digest/_lib.test.mjs`
Expected: PASS (5 tests).

- [ ] **Step 5: `fetch.mjs` 리팩터**

In `news-digest/fetch.mjs`:

1. 파일 상단 import 구역에 추가:

```js
import { kstDate, stripTags, purgeOldFiles } from "./_lib.mjs";
```

2. 로컬 `function stripTags(s) { ... }` 정의 **삭제** (그대로 `_lib.mjs` 버전 사용).

3. 로컬 `function purgeOldRawFiles(outDir) { ... }` 정의 **삭제**. 호출부

```js
purgeOldRawFiles(outDir);
```

를 아래로 교체:

```js
for (const name of purgeOldFiles(outDir, /^raw-\d{4}-\d{2}-\d{2}\.json$/, RAW_RETENTION_DAYS)) {
  console.log(`Purged (> ${RAW_RETENTION_DAYS} days old): ${name}`);
}
```

4. 날짜 계산

```js
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
```

를 아래로 교체:

```js
const today = kstDate();
```

5. `parseDate(item)` 함수는 네이버 전용이므로 **그대로 둔다**.

- [ ] **Step 6: `fetch.mjs` 무결성 확인**

Run: `node --check news-digest/fetch.mjs`
Expected: 출력 없음, exit 0 (문법 OK).

Run: `node -e "import('./news-digest/_lib.mjs').then(m => { const k = Object.keys(m).sort().join(','); if (k !== 'kstDate,purgeOldFiles,stripTags') throw new Error('exports: ' + k); console.log('exports OK'); })"`
Expected: `exports OK`.

> 참고: `fetch.mjs` 전체 실행은 `.env.local`의 네이버 API 키가 필요하므로 이 태스크의 자동 검증에서 제외한다. 키가 있는 환경에서 사용자가 `node --env-file=.env.local news-digest/fetch.mjs`를 1회 돌려 `daily/raw-<date>.json`이 종전과 같은 키 구조로 나오는지 육안 확인(회귀)한다.

- [ ] **Step 7: `package.json`에 test 스크립트 추가**

`scripts`에 추가 (`lint` 다음 줄):

```json
    "test": "node --test news-digest/"
```

Run: `npm test`
Expected: `_lib.test.mjs`의 5개 테스트 PASS (다른 테스트 파일은 아직 없음).

- [ ] **Step 8: 커밋**

```bash
git add news-digest/_lib.mjs news-digest/_lib.test.mjs news-digest/fetch.mjs package.json
git commit -m "Extract shared news-digest helpers into _lib.mjs"
```

---

## Task 2: 쇼츠 랭킹 순수 함수 `pickTopShorts.mjs`

**Files:**
- Create: `news-digest/kculture/pickTopShorts.mjs`
- Create: `news-digest/kculture/pickTopShorts.test.mjs`

**Interfaces:**
- Produces:
  - `pickTopShorts(candidates, { maxAgeDays, limit, koreaRegex, now = new Date() }) → Array<{id, title, channel, views, link, date, duration}>`
    - 입력 후보 요소 형태: `{ id, title, description, channel, view_count, upload_date, duration, url }` (`upload_date`는 yt-dlp의 `"YYYYMMDD"` 문자열)
    - 필터: `duration`이 숫자이고 `≤ 60`; `upload_date`가 `now` 기준 `maxAgeDays` 이내; `koreaRegex.test(title + " " + description)` 참
    - `id`로 중복 제거 → `view_count` 내림차순 정렬 → 앞 `limit`개
    - 반환 요소: `date`는 `"YYYY-MM-DD"`, `channel` 없으면 `""`, `link`는 `url` 우선

- [ ] **Step 1: 실패하는 테스트 작성**

Create `news-digest/kculture/pickTopShorts.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { pickTopShorts } from "./pickTopShorts.mjs";

const KOREA = /korea|한국/i;
const NOW = new Date("2026-08-29T00:00:00Z");

function cand(over = {}) {
  return {
    id: over.id ?? Math.random().toString(36).slice(2),
    title: over.title ?? "Korea vlog",
    description: over.description ?? "",
    channel: over.channel ?? "chan",
    view_count: over.view_count ?? 1000,
    upload_date: over.upload_date ?? "20260828",
    duration: over.duration ?? 30,
    url: over.url ?? "https://youtu.be/x",
  };
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
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `node --test news-digest/kculture/pickTopShorts.test.mjs`
Expected: FAIL — `Cannot find module './pickTopShorts.mjs'`.

- [ ] **Step 3: `pickTopShorts.mjs` 구현**

Create `news-digest/kculture/pickTopShorts.mjs`:

```js
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
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `node --test news-digest/kculture/pickTopShorts.test.mjs`
Expected: PASS (8 tests).

- [ ] **Step 5: 커밋**

```bash
git add news-digest/kculture/pickTopShorts.mjs news-digest/kculture/pickTopShorts.test.mjs
git commit -m "Add pickTopShorts: filter + rank for K-culture shorts section"
```

---

## Task 3: `sources.json` + `fetch-kculture.mjs` 골격 + Exa 수집기

**Files:**
- Create: `news-digest/kculture/sources.json`
- Create: `news-digest/fetch-kculture.mjs`
- Create: `news-digest/fetch-kculture.test.mjs`

**Interfaces:**
- Consumes: `kstDate`, `stripTags`, `purgeOldFiles` (Task 1); `pickTopShorts` (Task 2, Task 5에서 사용)
- Produces:
  - `KOREA_REGEX: RegExp`
  - `parseExaOutput(text: string) → Array<{title, link, date, description}>`
  - `withinDays(dateStr: string|null, n: number, now = new Date()) → boolean`
  - `collectExa(exaSources, { runMcporter }) → Promise<Array<item>>`
    - `exaSources` 요소: `{ section: string, query: string, freshnessDays: number }`
    - `runMcporter(query: string) → Promise<string>` (mcporter stdout)
    - item: `{ source:"exa", keyword:section, title, description, link, date }`

- [ ] **Step 1: mcporter 출력 형식 확인 (조사)**

Run:
```bash
mcporter call exa web_search_exa "query=korea travel" numResults=2 --json
mcporter call exa web_search_exa "query=korea travel" numResults=2 -f json
mcporter call exa web_search_exa "query=korea travel" numResults=2
```
- 위 셋 중 **구조화된 JSON을 반환하는 형태가 있으면** 그것을 채택하고, `parseExaOutput`을 `JSON.parse` 기반으로 구현한다 (아래 Step 3의 "JSON 경로").
- 셋 다 사람이 읽는 텍스트만 반환하면 "텍스트 경로"로 구현한다.
- 결과(어느 경로인지 + 예시 출력 5줄)를 커밋 메시지 본문 또는 `fetch-kculture.mjs` 상단 주석에 남긴다.

- [ ] **Step 2: 실패하는 테스트 작성**

Create `news-digest/fetch-kculture.test.mjs`:

```js
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
```

- [ ] **Step 3: 테스트 실패 확인**

Run: `node --test news-digest/fetch-kculture.test.mjs`
Expected: FAIL — `Cannot find module './fetch-kculture.mjs'`.

- [ ] **Step 4: `sources.json` 작성**

Create `news-digest/kculture/sources.json`:

```json
{
  "exa": [
    { "section": "kpop",   "query": "K-pop news this week comeback",      "freshnessDays": 7 },
    { "section": "kpop",   "query": "K-pop group announcement",           "freshnessDays": 7 },
    { "section": "kdrama", "query": "new Korean drama premiere this week", "freshnessDays": 7 },
    { "section": "kdrama", "query": "K-drama casting news",               "freshnessDays": 7 },
    { "section": "dating", "query": "dating a Korean guy experience",     "freshnessDays": 90 },
    { "section": "dating", "query": "dating a Korean girl experience",    "freshnessDays": 90 },
    { "section": "dating", "query": "foreigner Korean boyfriend girlfriend story", "freshnessDays": 90 },
    { "section": "dating", "query": "international couple living in Korea", "freshnessDays": 90 },
    { "section": "dating", "query": "한국남자 국제연애 후기",             "freshnessDays": 90 },
    { "section": "dating", "query": "한국여자 국제연애 후기",             "freshnessDays": 90 },
    { "section": "dating", "query": "외국인 한국 연애 후기",              "freshnessDays": 90 },
    { "section": "dating", "query": "국제커플 한국 연애 이야기",          "freshnessDays": 90 }
  ],
  "rss": [
    { "name": "soompi",  "url": "https://www.soompi.com/feed",      "section": "kpop" },
    { "name": "allkpop", "url": "https://www.allkpop.com/rss/news", "section": "kpop" }
  ],
  "shorts": [
    { "country": "vietnam",     "lang": "vi",  "terms": ["Hàn Quốc vlog", "du lịch Hàn Quốc"] },
    { "country": "thailand",    "lang": "th",  "terms": ["เที่ยวเกาหลี", "เกาหลี รีวิว"] },
    { "country": "indonesia",   "lang": "id",  "terms": ["Korea Selatan vlog", "jalan jalan ke Korea"] },
    { "country": "philippines", "lang": "fil", "terms": ["Korea vlog Pinoy", "life in Korea Filipino"] }
  ],
  "reddit": [
    { "query": "dating a korean guy experience",  "subreddits": ["korea", "Living_in_Korea", "hanguk"] },
    { "query": "dating a korean girl experience", "subreddits": ["korea", "Living_in_Korea", "hanguk"] },
    { "query": "international couple korea",       "subreddits": ["korea", "Living_in_Korea"] }
  ]
}
```

- [ ] **Step 5: `fetch-kculture.mjs` 골격 + Exa 수집기 구현**

Create `news-digest/fetch-kculture.mjs`:

```js
// Weekly "K-컬처 & 라이프" collector — Exa + RSS + YouTube Shorts → raw-kculture-<date>.json.
// Does NOT need .env.local. Run: node news-digest/fetch-kculture.mjs [--dry-run] [--section=<name>]
// Reddit + TikTok are added later by the weekly agent session (see kculture/README.md).
//
// mcporter output contract (from Task 3 Step 1 investigation): <FILL IN: json | text, + sample>

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { exec, execFile } from "node:child_process";

import { kstDate, stripTags, purgeOldFiles } from "./_lib.mjs";
import { pickTopShorts } from "./kculture/pickTopShorts.mjs";

const execP = promisify(exec);
const execFileP = promisify(execFile);

export const KOREA_REGEX = /korea|korean|한국|케이팝|k-?pop|k-?drama|hallyu|한류|kdrama/i;

const HERE = path.dirname(fileURLToPath(import.meta.url));
const KCULTURE_DIR = path.join(HERE, "kculture");

// ── date helpers ─────────────────────────────────────────────
export function withinDays(dateStr, n, now = new Date()) {
  if (!dateStr) return false;
  const ymd = /^(\d{4})(\d{2})(\d{2})$/.exec(String(dateStr));
  const ms = ymd
    ? Date.UTC(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]))
    : Date.parse(dateStr);
  if (Number.isNaN(ms)) return false;
  return ms >= now.getTime() - n * 24 * 60 * 60 * 1000;
}

// ── Exa ──────────────────────────────────────────────────────
// TEXT PATH (use if Task 3 Step 1 found no JSON output):
export function parseExaOutput(text) {
  const blocks = String(text).split(/\n(?=Title:\s)/);
  const items = [];
  for (const b of blocks) {
    const title = (/^Title:\s*(.+)$/m.exec(b) || [])[1];
    const link = (/^URL(?:\s*Source)?:\s*(\S+)\s*$/m.exec(b) || [])[1];
    if (!title || !link) continue;
    const date = (/^Published(?:\s*Time)?:\s*(\S+)\s*$/m.exec(b) || [])[1] || null;
    const hlRaw = (/^Highlights?:\s*\n?([\s\S]*)$/m.exec(b) || [])[1] || "";
    const description = hlRaw
      .replace(/\s*\.\.\.\s*/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 400);
    items.push({ title: title.trim(), link, date, description });
  }
  return items;
}

/* JSON PATH (use instead if Task 3 Step 1 found `--json`/`-f json` works):
export function parseExaOutput(text) {
  const data = JSON.parse(text);
  const results = data.results || data.data || [];
  return results.map((r) => ({
    title: (r.title || "").trim(),
    link: r.url || r.link || "",
    date: r.publishedDate || r.published || null,
    description: String(r.text || r.snippet || (r.highlights || []).join(" "))
      .replace(/\s+/g, " ").trim().slice(0, 400),
  })).filter((r) => r.title && r.link);
}
*/

async function defaultRunMcporter(query) {
  // query comes from sources.json (trusted, human-maintained). Shell used so the
  // Windows npm shim (mcporter.cmd) resolves.
  const q = String(query).replace(/"/g, '\\"');
  const { stdout } = await execP(
    `mcporter call exa web_search_exa "query=${q}" numResults=10`,
    { timeout: 60000, maxBuffer: 10 * 1024 * 1024 },
  );
  return stdout;
}

export async function collectExa(exaSources, { runMcporter = defaultRunMcporter, now = new Date() } = {}) {
  const items = [];
  for (const src of exaSources) {
    let raw;
    try {
      raw = await runMcporter(src.query);
    } catch (e) {
      console.warn(`  ! exa "${src.query}": ${e.message}`);
      continue;
    }
    for (const r of parseExaOutput(raw)) {
      if (!withinDays(r.date, src.freshnessDays, now)) continue;
      if (!KOREA_REGEX.test(`${r.title} ${r.description}`)) continue;
      items.push({
        source: "exa",
        keyword: src.section,
        title: r.title,
        description: r.description,
        link: r.link,
        date: r.date,
      });
    }
  }
  return items;
}

// ── main (expanded in Tasks 4–6) ─────────────────────────────
async function main(argv) {
  const flags = new Set(argv.slice(2));
  const dryRun = flags.has("--dry-run");
  const sectionArg = [...flags].find((f) => f.startsWith("--section="));
  const only = sectionArg ? sectionArg.split("=")[1] : null;

  const sources = JSON.parse(readFileSync(path.join(KCULTURE_DIR, "sources.json"), "utf-8"));
  const results = [];
  let anyOk = false;

  if (!only || only === "exa" || ["kpop", "kdrama", "dating"].includes(only)) {
    const exaSrc = dryRun ? sources.exa.slice(0, 1) : sources.exa;
    try {
      results.push(await collectExa(exaSrc, {}));
      anyOk = true;
    } catch (e) {
      console.warn(`exa section failed: ${e.message}`);
    }
  }

  const merged = results.flat();
  console.log(`collected ${merged.length} items`);

  if (dryRun) {
    console.log(JSON.stringify(merged.slice(0, 5), null, 2));
    console.log("dry run — no file written");
    return;
  }

  const outPath = path.join(KCULTURE_DIR, `raw-kculture-${kstDate()}.json`);
  writeFileSync(outPath, JSON.stringify(merged, null, 2), "utf-8");
  for (const name of purgeOldFiles(KCULTURE_DIR, /^raw-kculture-\d{4}-\d{2}-\d{2}\.json$/, 60)) {
    console.log(`purged old: ${name}`);
  }
  console.log(`saved: ${outPath}`);
  if (!anyOk) process.exit(1);
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  main(process.argv);
}
```

> Step 1 조사 결과에 맞춰 `parseExaOutput`의 TEXT/JSON 경로 중 하나만 남기고 다른 하나는 주석으로 보존. 상단 주석의 `<FILL IN: ...>`도 실제 결과로 채운다.

- [ ] **Step 6: 테스트 통과 확인**

Run: `node --test news-digest/fetch-kculture.test.mjs`
Expected: PASS. (JSON 경로를 택했다면 `parseExaOutput` 테스트의 `sample` 픽스처를 실제 JSON 문자열로 교체하고 기대값은 유지.)

- [ ] **Step 7: 실전 스모크 (Exa만)**

Run: `node news-digest/fetch-kculture.mjs --section=kpop --dry-run`
Expected: `collected N items` (N ≥ 0) 출력 + 상위 5개 JSON 미리보기 + `dry run — no file written`. 오류 스택 없이 종료. (mcporter + Exa가 이 머신에 설정돼 있어야 함 — 스펙상 이미 완료.)

- [ ] **Step 8: 커밋**

```bash
git add news-digest/kculture/sources.json news-digest/fetch-kculture.mjs news-digest/fetch-kculture.test.mjs
git commit -m "Add fetch-kculture skeleton + Exa collector + sources.json"
```

---

## Task 4: RSS 수집기

**Files:**
- Modify: `news-digest/fetch-kculture.mjs` (`collectRss` 추가, `main`에 배선)
- Modify: `news-digest/fetch-kculture.test.mjs` (RSS 테스트 추가)
- Modify: `package.json` (`rss-parser` 의존성)

**Interfaces:**
- Produces:
  - `collectRss(rssSources, { parser }) → Promise<Array<item>>`
    - `rssSources` 요소: `{ name: string, url: string, section: string }`
    - `parser`: `{ parseURL(url) → Promise<{ items: Array<{title, link, pubDate?, isoDate?, contentSnippet?, content?}>}> }` (rss-parser 인스턴스 또는 테스트 페이크)
    - 필터: `withinDays(isoDate || pubDate, 7)`
    - item: `{ source:"rss:<name>", keyword:section, title, description, link, date }` — `description`은 `stripTags(contentSnippet || content).slice(0, 400)`

- [ ] **Step 1: `rss-parser` 설치**

Run: `npm install rss-parser`
Expected: `package.json`의 `dependencies`에 `"rss-parser"` 추가됨, 설치 성공.

- [ ] **Step 2: 실패하는 테스트 작성**

`news-digest/fetch-kculture.test.mjs`의 import 줄에 `collectRss` 추가:

```js
import { KOREA_REGEX, parseExaOutput, withinDays, collectExa, collectRss } from "./fetch-kculture.mjs";
```

파일 끝에 추가:

```js
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
```

- [ ] **Step 3: 테스트 실패 확인**

Run: `node --test news-digest/fetch-kculture.test.mjs`
Expected: FAIL — `collectRss is not a function` / import 에러.

- [ ] **Step 4: `collectRss` 구현**

`news-digest/fetch-kculture.mjs`:

import 구역에 추가:

```js
import Parser from "rss-parser";
```

`collectExa` 아래에 추가:

```js
// ── RSS ──────────────────────────────────────────────────────
export async function collectRss(rssSources, { parser = new Parser(), now = new Date() } = {}) {
  const items = [];
  for (const feed of rssSources) {
    let parsed;
    try {
      parsed = await parser.parseURL(feed.url);
    } catch (e) {
      console.warn(`  ! rss ${feed.name}: ${e.message}`);
      continue;
    }
    for (const entry of parsed.items || []) {
      const date = entry.isoDate || entry.pubDate || null;
      if (!withinDays(date, 7, now)) continue;
      items.push({
        source: `rss:${feed.name}`,
        keyword: feed.section,
        title: (entry.title || "").trim(),
        description: stripTags(entry.contentSnippet || entry.content || "").slice(0, 400),
        link: entry.link || "",
        date,
      });
    }
  }
  return items;
}
```

`main()`의 Exa 블록 다음에 배선:

```js
  if (!only || only === "rss") {
    try {
      results.push(await collectRss(sources.rss, {}));
      anyOk = true;
    } catch (e) {
      console.warn(`rss section failed: ${e.message}`);
    }
  }
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `node --test news-digest/fetch-kculture.test.mjs`
Expected: PASS (Exa + RSS 테스트 전부).

- [ ] **Step 6: 피드 URL 실검증**

Run:
```bash
node -e "import('rss-parser').then(async ({default:P}) => { const p = new P(); for (const u of ['https://www.soompi.com/feed','https://www.allkpop.com/rss/news']) { try { const f = await p.parseURL(u); console.log(u, 'OK', (f.items||[]).length, 'items'); } catch (e) { console.log(u, 'FAIL', e.message); } } })"
```
Expected: 각 URL이 `OK <n> items`. `FAIL`이면 해당 매체의 올바른 RSS 경로를 찾아 `sources.json`의 `rss[].url`을 고치고 이 스텝을 다시 실행. (예: allkpop이 `/rss` 또는 `/rss/index` 등일 수 있음.)

- [ ] **Step 7: 커밋**

```bash
git add news-digest/fetch-kculture.mjs news-digest/fetch-kculture.test.mjs news-digest/kculture/sources.json package.json package-lock.json
git commit -m "Add RSS collector to fetch-kculture"
```

---

## Task 5: YouTube Shorts 수집기

**Files:**
- Modify: `news-digest/fetch-kculture.mjs` (`parseYtDlpJsonLines`, `gatherCountry`, `collectShorts` 추가, `main` 배선)
- Modify: `news-digest/fetch-kculture.test.mjs` (Shorts 테스트 추가)

**Interfaces:**
- Consumes: `pickTopShorts` (Task 2)
- Produces:
  - `parseYtDlpJsonLines(stdout: string) → Array<{id,title,description,channel,view_count,upload_date,duration,url}>` — NDJSON 각 줄 `JSON.parse`, 실패 줄 무시
  - `collectShorts(shortsSources, { runYtDlp }) → Promise<Array<item>>`
    - `shortsSources` 요소: `{ country: string, lang: string, terms: string[] }`
    - `runYtDlp(term: string) → Promise<string>` (yt-dlp NDJSON stdout)
    - 나라별: 7일 기준 `pickTopShorts` → 2개 미만이면 14일 재시도 → 그래도 0개면 `note` 항목 1개
    - item: `{ source:"shorts", keyword:"shorts", country, lang, title, description:"", link, date, channel, views, duration, note? }`

- [ ] **Step 1: 실패하는 테스트 작성**

import 줄에 추가:

```js
import { KOREA_REGEX, parseExaOutput, withinDays, collectExa, collectRss, parseYtDlpJsonLines, collectShorts } from "./fetch-kculture.mjs";
```

파일 끝에 추가:

```js
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

test("collectShorts: 7일 내 0개면 14일로 폴백", async () => {
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

test("collectShorts: 14일 내도 0개면 note-only 항목", async () => {
  const now = new Date("2026-08-29T00:00:00Z");
  const runYtDlp = async () =>
    JSON.stringify({ id: "ancient", title: "Korea", view_count: 5, upload_date: "20260101", duration: 30, webpage_url: "https://youtu.be/ancient" });

  const items = await collectShorts(
    [{ country: "indonesia", lang: "id", terms: ["t"] }],
    { runYtDlp, now },
  );

  assert.equal(items.length, 1);
  assert.equal(items[0].link, "");
  assert.equal(items[0].country, "indonesia");
  assert.equal(items[0].note, "최근 14일 내 조건 충족 영상 없음");
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
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `node --test news-digest/fetch-kculture.test.mjs`
Expected: FAIL — `parseYtDlpJsonLines is not a function`.

- [ ] **Step 3: Shorts 수집기 구현**

`news-digest/fetch-kculture.mjs`, `collectRss` 아래에 추가:

```js
// ── YouTube Shorts ───────────────────────────────────────────
export function parseYtDlpJsonLines(stdout) {
  const rows = [];
  for (const line of String(stdout).split("\n")) {
    const t = line.trim();
    if (!t || t[0] !== "{") continue;
    try {
      const j = JSON.parse(t);
      rows.push({
        id: j.id,
        title: j.title || "",
        description: j.description || "",
        channel: j.channel || j.uploader || "",
        view_count: j.view_count ?? 0,
        upload_date: j.upload_date || "",
        duration: typeof j.duration === "number" ? j.duration : null,
        url: j.webpage_url || j.url || (j.id ? `https://www.youtube.com/watch?v=${j.id}` : ""),
      });
    } catch {
      // progress / non-JSON line
    }
  }
  return rows;
}

async function defaultRunYtDlp(term) {
  const { stdout } = await execFileP(
    "yt-dlp",
    ["--dump-json", "--no-warnings", "--ignore-errors", `ytsearch12:${term}`],
    { timeout: 180000, maxBuffer: 50 * 1024 * 1024 },
  );
  return stdout;
}

async function gatherCountry(country, maxAgeDays, runYtDlp, now) {
  const all = [];
  for (const term of country.terms) {
    let out;
    try {
      out = await runYtDlp(term);
    } catch (e) {
      console.warn(`  ! shorts ${country.country} "${term}": ${e.message}`);
      continue;
    }
    all.push(...parseYtDlpJsonLines(out));
  }
  return pickTopShorts(all, { maxAgeDays, limit: 2, koreaRegex: KOREA_REGEX, now });
}

export async function collectShorts(shortsSources, { runYtDlp = defaultRunYtDlp, now = new Date() } = {}) {
  const items = [];
  for (const country of shortsSources) {
    let picks = await gatherCountry(country, 7, runYtDlp, now);
    if (picks.length < 2) picks = await gatherCountry(country, 14, runYtDlp, now);

    if (picks.length === 0) {
      items.push({
        source: "shorts", keyword: "shorts",
        country: country.country, lang: country.lang,
        title: "", description: "", link: "", date: null,
        channel: "", views: 0, duration: null,
        note: "최근 14일 내 조건 충족 영상 없음",
      });
      continue;
    }

    const short = picks.length < 2 ? "조건 충족 영상 부족" : undefined;
    for (const p of picks) {
      items.push({
        source: "shorts", keyword: "shorts",
        country: country.country, lang: country.lang,
        title: p.title, description: "", link: p.link, date: p.date,
        channel: p.channel, views: p.views, duration: p.duration,
        ...(short ? { note: short } : {}),
      });
    }
  }
  return items;
}
```

`main()`의 RSS 블록 다음에 배선:

```js
  if (!only || only === "shorts") {
    const shortsSrc = dryRun
      ? sources.shorts.map((s) => ({ ...s, terms: s.terms.slice(0, 1) }))
      : sources.shorts;
    try {
      results.push(await collectShorts(shortsSrc, {}));
      anyOk = true;
    } catch (e) {
      console.warn(`shorts section failed: ${e.message}`);
    }
  }
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `node --test news-digest/fetch-kculture.test.mjs`
Expected: PASS (Exa + RSS + Shorts 전부).

- [ ] **Step 5: 실전 스모크 (Shorts만, 1개국)**

임시로 `sources.json`의 `shorts`를 `vietnam` 하나만 남기고 실행하거나, 아래로 빠르게 확인:

Run: `node news-digest/fetch-kculture.mjs --section=shorts --dry-run`
Expected: `collected N items` — 나라당 최대 2개(또는 note 항목). yt-dlp가 실제로 YouTube 검색을 하므로 30초~2분 소요 가능. 오류 스택 없이 종료.

- [ ] **Step 6: 커밋**

```bash
git add news-digest/fetch-kculture.mjs news-digest/fetch-kculture.test.mjs
git commit -m "Add YouTube Shorts collector to fetch-kculture"
```

---

## Task 6: 병합·저장·purge + CLI 마무리 + `.gitignore`

**Files:**
- Modify: `news-digest/fetch-kculture.mjs` (`mergeAndDedupe` 추가, `main`에서 `results.flat()` → `mergeAndDedupe(results)`)
- Modify: `news-digest/fetch-kculture.test.mjs` (`mergeAndDedupe` 테스트)
- Modify: `.gitignore`

**Interfaces:**
- Produces:
  - `mergeAndDedupe(itemArrays: item[][]) → item[]` — `link` 기준 중복 제거. `link`가 빈 문자열인 항목(쇼츠 note)은 절대 제거하지 않음. 순서 보존.

- [ ] **Step 1: 실패하는 테스트 작성**

import 줄에 `mergeAndDedupe` 추가. `news-digest/fetch-kculture.test.mjs` 파일 끝에:

```js
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
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `node --test news-digest/fetch-kculture.test.mjs`
Expected: FAIL — `mergeAndDedupe is not a function`.

- [ ] **Step 3: 구현 + `main` 배선**

`news-digest/fetch-kculture.mjs`, Shorts 섹션 아래:

```js
// ── merge ────────────────────────────────────────────────────
export function mergeAndDedupe(itemArrays) {
  const seen = new Set();
  const out = [];
  for (const arr of itemArrays) {
    for (const it of arr) {
      if (it.link) {
        if (seen.has(it.link)) continue;
        seen.add(it.link);
      }
      out.push(it);
    }
  }
  return out;
}
```

`main()`에서:

```js
  const merged = results.flat();
```

를

```js
  const merged = mergeAndDedupe(results);
```

로 교체.

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test`
Expected: 전체 테스트 파일 PASS (`_lib`, `pickTopShorts`, `fetch-kculture`).

- [ ] **Step 5: `.gitignore` 갱신**

`.gitignore` 끝의 news-digest 블록 아래에 추가:

```
# K-culture weekly digest — generated artifacts stay local (README/TEMPLATE/sources.json are committed)
/news-digest/kculture/raw-kculture-*.json
/news-digest/kculture/[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9].md
```

> `[0-9]...` 글롭은 날짜형 `2026-08-29.md`만 무시하고 `README.md`·`TEMPLATE.md`는 커밋되게 둔다.

- [ ] **Step 6: 전체 실전 스모크**

Run: `node news-digest/fetch-kculture.mjs --dry-run`
Expected: Exa + RSS + Shorts 전부 시도. `collected N items` + 상위 5개 미리보기 + `dry run — no file written`. 개별 소스 경고(`! ...`)는 있어도 되지만 처리되지 않은 예외 스택은 없어야 함.

Run (파일 생성 확인): `node news-digest/fetch-kculture.mjs && ls news-digest/kculture/ && git status --porcelain news-digest/kculture/`
Expected: `raw-kculture-<오늘>.json` 생성됨. `git status`에 그 raw 파일이 **나타나지 않음**(gitignore 적용됨).

- [ ] **Step 7: 커밋**

```bash
git add news-digest/fetch-kculture.mjs news-digest/fetch-kculture.test.mjs .gitignore
git commit -m "Finish fetch-kculture: merge/dedupe, dry-run smoke, gitignore artifacts"
```

---

## Task 7: 에이전트 절차 문서 + 운영 배선

**Files:**
- Create: `news-digest/kculture/README.md`
- Create: `news-digest/kculture/TEMPLATE.md`
- Create: `news-digest/run-fetch-kculture.ps1`
- Modify: `CLAUDE.md` (새 포인터 섹션)

**Interfaces:** 없음 (문서/스크립트).

- [ ] **Step 1: `news-digest/kculture/README.md` 작성**

```markdown
# K-컬처 & 라이프 주간 다이제스트

주 1회, 앱 취지(한국 거주 동남아·중앙아 외국인)에 맞는 문화·라이프 소식을 한 페이지로
정리한다. 기존 `news-digest/`(네이버 일일 요약)와 **별개** 파이프라인이다.

## 4개 섹션 (고정 순서)
1. K-pop 소식
2. K-drama 소식
3. 한국인과의 연애 후기
4. 동남아 쇼츠 — 베트남·태국·인도네시아·필리핀, 각국 YouTube Shorts 조회수 상위 2개
   (한국 관련, 최근 7일 업로드, 부족하면 14일)

## 실행 모델 (하이브리드)
- `news-digest/fetch-kculture.mjs` 가 Exa 웹검색 + RSS + YouTube Shorts 를 모아
  `kculture/raw-kculture-<날짜>.json` 을 만든다. `.env.local` 불필요.
  `node news-digest/fetch-kculture.mjs`
- 사용자가 "K컬처 요약해줘" 류로 요청하면, 이 세션이 Reddit·TikTok 을 보태고 전체를
  `kculture/<날짜>.md` 로 요약한다.
- 생성물(`raw-kculture-*.json`, `<날짜>.md`)은 **로컬 전용 — git commit 안 함.**

## 요약 요청 시 절차 (Claude용)

1. 날짜 태그 = 실행일 KST `YYYY-MM-DD`. `kculture/raw-kculture-<날짜>.json` 이 없거나
   7일 넘게 오래됐으면 먼저 `node news-digest/fetch-kculture.mjs` 실행.
2. **Reddit (연애 후기):** `kculture/sources.json` 의 `reddit` 항목마다
   `opencli reddit search "<query>" -f yaml` (필요 시 서브레딧 지정). opencli 데몬
   다운 / `AUTH_REQUIRED` 면 `redditStatus = "미수집 (로그인/연결 실패)"` 로 기록하고 계속.
   히트 → `{ source: "reddit:<sub>", keyword: "dating", title, description(본문 발췌), link, date }`.
3. **TikTok (보조, best-effort):** `opencli tiktok search "<query>" -f yaml` — K-pop /
   K-drama / "dating in korea" 류. 실패하면 조용히 스킵.
   히트 → `{ source: "tiktok", keyword, title, description, link, views }`.
4. 2·3 결과를 `kculture/raw-kculture-<날짜>.json` 에 같은 스키마로 append.
5. **원문 읽기:** 후보 기사(쇼츠·틱톡 제외)마다 `curl -s "https://r.jina.ai/<link>"` 로
   본문을 확보한 뒤 요약. 최대 약 15건.
6. **`kculture/<날짜>.md` 작성** (`TEMPLATE.md` 형식):
   - 각 항목: `**<원어 제목>** (<한국어 번역>)` + 한국어 요약 1~2문장 + `원문: <link>`
   - 쇼츠: 국가별 소제목, 최대 2개, 각 `조회수 N만 · <채널>` + 링크. note가 있으면 그대로 표기.
   - `redditStatus` 가 미수집이면 "한국인과의 연애 후기" 섹션 머리에 그 사실을 적는다.
7. **로컬 전용:** git add / commit / push 하지 않는다.
8. 대화창에 섹션별 하이라이트만 짧게 보고. 60일 지나 삭제한 `<날짜>.md` 가 있으면 언급.

## 편집 규칙
- 루머·미확인·낚시성 제외. K-pop 열애설/해체설 등은 공식 확인된 것만.
- **연애 후기: 개인 식별정보(닉네임·구체 신상·사진) 제거.** 개별 사연을 나열하지 말고
  주제·팁·경향 단위로 묶어 요약하고, 대표 출처 링크만 몇 개 남긴다.
  (프로젝트 CLAUDE.md "만남" 카테고리 주의사항과 동일선상.)
- 광고·협찬·명백한 개인 홍보 제외.
- 원문 전문 복사 금지 — 제목 + 1~2문장 + 링크만.

## 60일 정리
요약 세션에서 `kculture/` 안의 날짜형 `<YYYY-MM-DD>.md` 중 오늘 KST 기준 60일보다
오래된 것을 삭제한다. (`raw-kculture-*.json` 은 `fetch-kculture.mjs` 가 자체적으로 정리.)

## seen-topics
v1 없음. K-pop/드라마 섹션이 매주 같은 내용을 반복하면 그때 `kculture-seen.json` 도입 검토.
```

- [ ] **Step 2: `news-digest/kculture/TEMPLATE.md` 작성**

```markdown
# K-컬처 & 라이프 주간 다이제스트 — 2026-08-25

(형식 견본 — 실제 데이터 아님. 원문 전문 복사 없음, 링크로 확인.)

## K-pop 소식
- **NewJeans announces first world tour** (뉴진스, 첫 월드투어 발표)
  소속사가 2027년 상반기 아시아·북미 순회 공연을 공식 발표. 한국 공연은 서울 3회. 티켓 일정은 미정.
  원문: https://example.com/a

## K-drama 소식
- **tvN sets premiere date for new office romance** (tvN 신작 오피스 로맨스 편성 확정)
  10월 첫 방영 확정, 주연 캐스팅도 공개. 넷플릭스 동시 공개 예정.
  원문: https://example.com/b

## 한국인과의 연애 후기
국제연애 경험담에서 이번 주 자주 나온 주제:
- 언어 장벽보다 "가족·명절 문화 차이"를 더 크게 꼽는 글이 많았음.
- 비자(F-6, 결혼이민) 절차 관련 질문·경험 공유가 늘어남.
대표 글: https://example.com/c , https://example.com/d
(이번 주 Reddit 미수집: 해당 시 여기에 표시)

## 동남아 쇼츠 (한국 관련, 최근 7일, 조회수 상위)
### 베트남
- **Một ngày ở Seoul** (서울에서의 하루) — 조회수 42만 · @travelvn
  베트남인 유학생의 서울 일상 브이로그.
  https://youtube.com/shorts/xxxx
### 태국
- (조건 충족 영상 부족 시: "이번 주 조건 충족 영상 부족" 표기)
### 인도네시아
### 필리핀

---
*검색 결과의 제목·핵심만 요약. 원문 전체를 복제하지 않음. 게시 전 사실관계 확인 필요.*
```

- [ ] **Step 3: `news-digest/run-fetch-kculture.ps1` 작성**

`news-digest/run-fetch.ps1` 을 본떠 만들되 `--env-file` 은 뺀다:

```powershell
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot
$logPath = Join-Path $projectRoot "news-digest\kculture\fetch.log"
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
"[$timestamp] Starting kculture fetch" | Out-File -FilePath $logPath -Append -Encoding utf8
& "C:\Program Files\nodejs\node.exe" news-digest\fetch-kculture.mjs 2>&1 | Out-File -FilePath $logPath -Append -Encoding utf8
"[$timestamp] Done, exit code: $LASTEXITCODE" | Out-File -FilePath $logPath -Append -Encoding utf8
```

`.gitignore` 에 로그 파일 한 줄 추가:

```
/news-digest/kculture/fetch.log
```

- [ ] **Step 4: `CLAUDE.md` 포인터 섹션 추가**

`## 뉴스 다이제스트 요약 요청` 섹션 **끝(그 섹션의 7번 항목 다음)** 에 새 섹션을 추가:

```markdown
## K-컬처 & 라이프 주간 다이제스트 요청 (운영 지침 — Claude용)

사용자가 "K컬처 요약해줘", "케이컬처 다이제스트", "주간 K컬처" 같은 요청을 하면
`news-digest/kculture/README.md`의 "요약 요청 시 절차"를 그대로 수행할 것.

배경: agent-reach 도구로 K-pop·K-drama·한국인과의 연애 후기·동남아 쇼츠를 주 1회 모아
한 페이지로 정리하는 별도 파이프라인. `news-digest/fetch-kculture.mjs`가 Exa/RSS/YouTube
Shorts를 수집해 `news-digest/kculture/raw-kculture-<날짜>.json`을 만들고(`.env.local`
불필요), 요약 세션이 Reddit·TikTok을 보태 `news-digest/kculture/<날짜>.md`로 정리한다.
생성물(raw json, 주간 .md)은 **로컬 전용 — git commit/push 하지 않는다.**
```

- [ ] **Step 5: 검증**

Run: `node -e "JSON.parse(require('fs').readFileSync('news-digest/kculture/sources.json','utf8')); console.log('sources.json valid')"`
Expected: `sources.json valid`.

Run: `npm test`
Expected: 전체 PASS (문서 태스크라 테스트 수 변화 없음 — 회귀 확인용).

Run: `git status --porcelain`
Expected: `news-digest/kculture/README.md`, `TEMPLATE.md`, `news-digest/run-fetch-kculture.ps1`, `CLAUDE.md`, `.gitignore` 만 변경/추가로 표시. `raw-kculture-*.json` 이나 날짜형 `.md` 는 안 보임.

- [ ] **Step 6: 커밋**

```bash
git add news-digest/kculture/README.md news-digest/kculture/TEMPLATE.md news-digest/run-fetch-kculture.ps1 CLAUDE.md .gitignore
git commit -m "Add K-culture digest agent procedure, template, and ops wiring"
```

---

## 실행 후 최초 리허설 (플랜 완료 후 사용자와 함께)

1. `node news-digest/fetch-kculture.mjs` 1회 실전 실행 → `news-digest/kculture/raw-kculture-<오늘>.json` 육안 검토:
   - Exa 항목이 K-pop/K-drama/dating 각각에 있는가
   - RSS 항목이 있는가 (없으면 Task 4 Step 6으로 피드 URL 재점검)
   - 나라별 쇼츠 2개(또는 note)가 있는가
2. 세션에서 "K컬처 요약해줘" → `news-digest/kculture/<오늘>.md` 생성 → 형식·편집 규칙 준수 확인:
   - 4개 섹션, 원어 제목 + 한국어 병기, 한국어 요약
   - 연애 후기 섹션에 개인 식별정보 없음, 주제 단위 집계
   - 쇼츠에 조회수·채널 표기
3. 어긋나면 `news-digest/kculture/README.md` 규칙 문구를 조정 (코드 아님).
4. (선택) `run-fetch-kculture.ps1` 을 Windows 작업 스케줄러 주간 항목으로 등록.

---

## Self-Review Notes

**Spec coverage:**

| 스펙 요구 | 구현 태스크 |
|---|---|
| `_lib.mjs` 추출 (kstDate/stripTags/purgeOldFiles) + fetch.mjs 최소수정 | Task 1 |
| `sources.json` 스키마 (exa/rss/shorts/reddit) | Task 3 Step 4 |
| Exa 수집 + freshness + 한국 한정 필터 | Task 3 |
| RSS 수집 (`rss-parser`, 7일 필터) | Task 4 |
| YouTube Shorts: 4개국, ≤60s, 7일(→14일 폴백), view 상위 2, 한국 한정 | Task 2 (`pickTopShorts`) + Task 5 (`collectShorts`) |
| `pickTopShorts` 순수 함수 + 픽스처 테스트 | Task 2 |
| 병합·중복제거(link) + raw json 저장 + 60일 purge | Task 6 |
| `--dry-run`, `--section=` 플래그 | Task 3 (skeleton) → Task 5·6 (확장) |
| 소스별 try/catch 격리, ≥1 성공 시 exit 0 | Task 3·4·5 (수집기별) + Task 6 (main) |
| 에이전트 주간 절차 (Reddit/TikTok/Jina/작성/편집규칙/로컬전용/60일) | Task 7 Step 1 (README) |
| TEMPLATE (4섹션, 원어+한국어 병기) | Task 7 Step 2 |
| CLAUDE.md 트리거 포인터 | Task 7 Step 4 |
| 생성물 gitignore (raw json + 날짜형 md) | Task 6 Step 5 |
| `run-fetch-kculture.ps1` (선택) | Task 7 Step 3 |
| 테스트 러너 = `node --test` | Task 1 Step 7 (`package.json`) |
| seen-topics 없음 (v1) | 해당 없음 (의도적 미구현, README에 명시) |

**Placeholder scan:** `parseExaOutput`의 TEXT/JSON 두 경로는 Task 3 Step 1 조사로 확정 —
플랜에 두 경로의 실제 코드를 모두 제공하고 조사 결과에 따라 하나를 선택하므로 placeholder 아님.
`fetch-kculture.mjs` 상단 주석의 `<FILL IN>` 은 Step 5 지시로 조사 결과를 채우게 되어 있음.
RSS 피드 URL은 Task 4 Step 6에서 실검증·수정. 그 외 모든 스텝에 실제 코드/명령 포함.

**Type consistency:** 항목 스키마 `{ source, keyword, title, description, link, date }` 를
`collectExa`/`collectRss`/`collectShorts` 전부 준수 (쇼츠는 `country/lang/channel/views/duration/note`
추가). `pickTopShorts` 반환 `{ id,title,channel,views,link,date,duration }` 를 `collectShorts` 가
`{ ...shorts item }` 으로 재매핑 (필드명 일치: `views`←`views`, `link`←`link`, `date`←`date`).
`withinDays`·`KOREA_REGEX`·`pickTopShorts` 시그니처가 정의 태스크와 사용 태스크에서 동일.
`runMcporter`/`parser`/`runYtDlp`/`now` 주입 인자명이 각 수집기와 테스트에서 일치.
