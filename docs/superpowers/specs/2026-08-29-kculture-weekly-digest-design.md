# K-컬처 & 라이프 주간 다이제스트 — 설계 문서

- 날짜: 2026-08-29
- 상태: 설계 승인됨 (구현 계획 대기)
- 관련: 기존 `news-digest/` 네이버 일일 파이프라인 (변경 없음), agent-reach 도구 설치본

## 배경 / 목적

줍줍(Gup Gup)은 한국 거주 외국인(특히 동남아·중앙아 출신) 대상 커뮤니티 웹앱.
기존에 `news-digest/`에 네이버 뉴스/블로그/카페를 매일 검색해 비자·행정·정책 중심
일일 요약을 만드는 파이프라인이 있다 (`fetch.mjs` → `daily/raw-<date>.json` →
에이전트가 `daily/<date>.md` 작성).

이와 별개로, 앱 취지에 맞는 **문화·라이프 성격의 주간 다이제스트**가 필요하다.
소재가 뉴스·정책과 톤이 다르고(K-pop, K-drama, 국제연애, 쇼츠), 소스도 네이버가
아니라 agent-reach가 연결한 도구들(Exa 웹검색, RSS, YouTube, Reddit, TikTok)이므로
**별도 파이프라인 · 별도 출력물**로 구성한다. 기존 네이버 파이프라인은 그대로 유지하며,
이 문서는 그 옆에 나란히 도는 새 서브시스템을 정의한다.

## 범위 (고정 4개 섹션)

1. K-pop 소식
2. K-drama 소식
3. 한국인과의 연애 후기
4. 동남아 쇼츠 — 베트남·태국·인도네시아·필리핀, 각국 YouTube Shorts 조회수 상위 2개,
   한국 관련 한정, 최근 7일 업로드

이 4개 외에는 추가하지 않는다 (K-food/뷰티/여행/한국살이 전반 등은 범위 밖).

## 실행 모델: 하이브리드

- **스크립트 (`fetch-kculture.mjs`)** — 브라우저 불필요 소스: Exa 웹검색, RSS,
  YouTube Shorts. 주 1회 실행(수동 또는 작업 스케줄러). `raw-kculture-<date>.json` 생성.
- **에이전트 세션** — 사용자가 "K컬처 요약해줘" 류로 트리거하면, 브라우저 세션이 필요한
  소스(Reddit, TikTok)를 그 자리에서 수집해 같은 raw 파일에 append하고, 전체를 편집·요약해
  `kculture/<date>.md`를 작성.

근거: Exa(mcporter CLI)·RSS·yt-dlp는 헤드리스 실행 가능 → 스크립트. Reddit·TikTok은
로그인된 Chrome + opencli 데몬이 필요해 스케줄 자동화가 불가 → 에이전트가 세션에서
처리하는 것이 타협이 아닌 정공법. 쇼츠 랭킹(조회수 정렬·상위 2개)은 결정론적이어야 하므로
스크립트에 둔다.

## 통합 방식 (승인된 접근 A)

단일 raw 파일. 스크립트가 Exa/RSS/쇼츠를 쓰고, 에이전트가 Reddit/TikTok을 같은
스키마로 append한 뒤 1회 요약한다. raw 아티팩트 하나, 요약 1패스, 감사 추적이 한 파일에
남는다. (대안 B: raw 2개 분리 / 대안 C: 에이전트 수집분 비영속 — 둘 다 실익 대비
복잡도가 커서 기각.)

## 폴더 구조

```
news-digest/
  _lib.mjs                      신규: 공용 헬퍼 (KST 날짜, purge, stripTags)
  fetch.mjs                     수정: _lib.mjs import (동작 불변)
  fetch-kculture.mjs            신규: 주간 수집기 (Exa + RSS + YouTube Shorts)
  run-fetch-kculture.ps1        신규(선택): 작업 스케줄러용 래퍼
  kculture/
    README.md                   신규: 주간 요약 작성 규칙 + 에이전트 절차
    TEMPLATE.md                 신규: 형식 견본
    sources.json                신규: Exa 쿼리 + RSS 피드 + 국가별 쇼츠 검색어 + Reddit 쿼리
    raw-kculture-<date>.json     생성물 (로컬 전용, git 제외)
    <date>.md                    생성물 (로컬 전용, git 제외)
```

## `_lib.mjs` (공용 헬퍼)

`fetch.mjs`에서 아래를 추출해 양쪽이 공유한다:

- `kstDate()` → `Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" })` 기반 `YYYY-MM-DD`
- `stripTags(s)` → HTML 태그/엔티티 제거 (현재 `fetch.mjs` 구현 그대로)
- `purgeOldFiles(dir, pattern, retentionDays)` → 현재 `purgeOldRawFiles`를 정규식·보존일
  인자로 일반화

`fetch.mjs` 변경: 위 로컬 정의를 `import { ... } from "./_lib.mjs"`로 교체. 그 외 로직
불변. 검증: 추출 후 `fetch.mjs` 1회 실행해 `daily/raw-<date>.json`의 키 구조가 동일한지
확인.

## `sources.json` 스키마

```json
{
  "exa": [
    { "section": "kpop",   "query": "...", "freshnessDays": 7 },
    { "section": "kdrama", "query": "...", "freshnessDays": 7 },
    { "section": "dating", "query": "dating a Korean guy experience",  "freshnessDays": 90 },
    { "section": "dating", "query": "dating a Korean girl experience", "freshnessDays": 90 },
    { "section": "dating", "query": "foreigner Korean boyfriend girlfriend", "freshnessDays": 90 },
    { "section": "dating", "query": "international couple in Korea",    "freshnessDays": 90 },
    { "section": "dating", "query": "한국남자 국제연애 후기", "freshnessDays": 90 },
    { "section": "dating", "query": "한국여자 국제연애 후기", "freshnessDays": 90 },
    { "section": "dating", "query": "외국인 한국 연애 후기",  "freshnessDays": 90 },
    { "section": "dating", "query": "국제커플 한국 연애",     "freshnessDays": 90 }
  ],
  "rss": [
    { "name": "soompi",  "url": "https://www.soompi.com/feed",        "section": "kpop" },
    { "name": "allkpop", "url": "https://www.allkpop.com/rss/news",   "section": "kpop" }
  ],
  "shorts": [
    { "country": "vietnam",     "lang": "vi",  "terms": ["Hàn Quốc", "..."] },
    { "country": "thailand",    "lang": "th",  "terms": ["เกาหลี", "..."] },
    { "country": "indonesia",   "lang": "id",  "terms": ["Korea Selatan", "..."] },
    { "country": "philippines", "lang": "fil", "terms": ["Korea", "..."] }
  ],
  "reddit": [
    { "query": "dating a korean guy",  "subreddits": ["korea", "Living_in_Korea", "hanguk"] },
    { "query": "dating a korean girl", "subreddits": ["korea", "Living_in_Korea", "hanguk"] }
  ]
}
```

`연애`·`한국남자`·`한국여자`는 단독 사용 금지 — 반드시 맥락어와 조합. 실제 검색어·피드
URL은 구현 시 채우고 검증한다 ("미해결" 참조).

## `fetch-kculture.mjs` 동작

`.env.local` 불필요 (Exa 키리스, yt-dlp 키 없음).

### Exa
각 `exa` 항목마다 `mcporter call exa web_search_exa query="<query>" numResults=10`
실행(child_process) → `{ source: "exa", keyword: <section>, title, description, link, date }`
로 매핑. 필터: `date`가 `freshnessDays` 이내, 제목+본문에 한국 관련어
(정규식 `korea|korean|한국|케이팝|k-?pop|k-?drama|hallyu|한류`) 포함 → **"한국 한정" 강제**.

### RSS
`rss-parser` 패키지 추가. 각 피드 fetch·파싱 →
`{ source: "rss:<name>", keyword: <section>, title, description, link, date }`.
필터: `pubDate` 7일 이내. (피드가 전부 한국 관련이라 관련어 필터는 약하게.)

### YouTube Shorts
각 `shorts` 항목(나라)에 대해:

1. 각 `term`으로 `yt-dlp --dump-json "ytsearch20:<term>"` →
   후보 `{ id, title, channel, view_count, upload_date, duration, webpage_url }`
2. `pickTopShorts(candidates, { maxAgeDays: 7, limit: 2, koreaRegex })`:
   - `duration <= 60`
   - `upload_date`가 maxAgeDays 이내
   - 제목/설명에 한국 관련어
   - id 중복 제거
   - `view_count` 내림차순 → 상위 `limit`개
3. 결과 < 2 → `pickTopShorts(..., { maxAgeDays: 14, limit: 2 })` 재시도
4. 여전히 < 2 → 있는 만큼 + `note: "조건 충족 영상 부족"`

항목: `{ source: "shorts", country, lang, title, channel, views, link, date, duration }`

`pickTopShorts`는 **순수 함수로 분리·export**하여 픽스처 단위 테스트한다.

### 병합·저장
전체 항목 concat → `link` 중복 제거 →
`news-digest/kculture/raw-kculture-<kstDate()>.json` (pretty JSON) →
`purgeOldFiles(kcultureDir, /^raw-kculture-\d{4}-\d{2}-\d{2}\.json$/, 60)`.

### 플래그
- `--dry-run` — 파일 미작성, 나라당 1 term, `numResults=3`
- `--section=<kpop|kdrama|dating|shorts>` — 해당 부분만 실행

### 에러 격리
각 소스 단위(Exa 쿼리 / RSS 피드 / 나라)를 try/catch로 감싼다 → `console.warn` 후 계속.
1개라도 성공하면 부분 파일을 쓰고 exit 0. 전부 실패해야 exit 1.

### 의존성
신규 npm: `rss-parser`. (mcporter, yt-dlp는 이미 전역 설치됨.)

## 에이전트 주간 요약 절차 (`kculture/README.md`에 수록)

트리거: 사용자가 세션에서 "K컬처 요약해줘" / "케이컬처 다이제스트" 류로 요청.
CLAUDE.md에 짧은 포인터 섹션 추가(기존 "뉴스 다이제스트 요약 요청"과 동형) → 이 README
절차를 따르도록 지시.

1. 날짜 태그 = 실행일 KST `YYYY-MM-DD` (`_lib.mjs`의 `kstDate()`, 일일 파이프라인과 동일 규칙).
   `raw-kculture-<date>.json`이 없거나 7일 넘게 오래됐으면 `node news-digest/fetch-kculture.mjs`
   먼저 실행.
2. **Reddit (연애 후기):** `sources.json`의 `reddit` 항목으로 `opencli reddit search`.
   opencli 데몬 다운/AUTH_REQUIRED면 `redditStatus = "미수집 (로그인/연결 실패)"` 기록
   후 계속. 히트 → `{ source: "reddit:<sub>", keyword: "dating", title, description, link, date }`.
3. **TikTok (보조, best-effort):** `opencli tiktok search` — K-pop/K-drama/"dating in korea"
   검색어. 실패하면 조용히 스킵. → `{ source: "tiktok", keyword, title, description, link, views }`.
4. 2·3 결과를 `raw-kculture-<date>.json`에 append (같은 스키마).
5. **원문 읽기:** 후보 기사(쇼츠·틱톡 제외)마다 `curl -s "https://r.jina.ai/<link>"`로
   본문을 확보한 뒤 요약. 최대 약 15건.
6. **`kculture/<date>.md` 작성** (TEMPLATE 형식) — 4개 섹션 고정 순서:
   - 각 항목: `**<원어 제목>** (<한국어 번역>)` + 한국어 요약 1~2문장 + `원문: <link>`
   - 쇼츠: 국가별 소제목, 최대 2개, 각 `조회수 N만 · <채널>` + 링크
   - `redditStatus`가 미수집이면 연애 후기 섹션에 명시
7. **편집 필터:**
   - 루머·미확인·낚시성 제외. K-pop 열애설/해체설 등은 공식 확인된 것만.
   - 연애 후기: 개인 식별정보(닉네임·구체 신상·사진) 제거. 개별 사연 나열 금지 →
     주제·팁·경향 단위로 묶어 요약하고 대표 출처 링크만. (CLAUDE.md "만남" 카테고리
     주의사항 준수.)
   - 광고·협찬·명백한 개인 홍보 제외. 원문 전문 복사 금지 (제목 + 1~2문장 + 링크).
8. **로컬 전용:** git add/commit/push 하지 않는다.
9. 대화창에 섹션별 하이라이트만 간단히 보고. 60일 경과로 삭제한 `<date>.md`가 있으면 언급.

seen-topics: v1 없음 (YAGNI). K-pop/드라마 섹션이 매주 반복되면 그때 `kculture-seen.json` 도입 검토.

## `TEMPLATE.md` 골격

```markdown
# K-컬처 & 라이프 주간 다이제스트 — YYYY-MM-DD

## K-pop 소식
- **<원어 제목>** (<한국어 번역>)
  <한국어 요약 1~2문장>
  원문: <link>

## K-drama 소식
- ...

## 한국인과의 연애 후기
<주제 단위 묶음 요약 + 대표 링크 몇 개>
<Reddit 미수집 시: "이번 주 Reddit 미수집" 표시>

## 동남아 쇼츠 (한국 관련, 최근 7일, 조회수 상위)
### 베트남
- **<제목>** (<번역>) — 조회수 12만 · <채널>
  <한 줄 설명>
  <link>
### 태국
- ...
### 인도네시아
- ...
### 필리핀
- ...
```

## 테스트

- **`pickTopShorts(candidates, { maxAgeDays, limit, koreaRegex })` 단위 테스트**
  (`node:test`, 픽스처 배열): duration ≤ 60 필터, `maxAgeDays` 창, `view_count` 내림차순,
  `limit` 캡, `koreaRegex` 관련어 필터. (14일 폴백 재시도 자체는 호출부 로직이므로 별도 확인.)
- **`fetch-kculture.mjs --dry-run` 스모크:** mcporter/yt-dlp/rss-parser 배선 확인.
- **첫 실전 실행:** `raw-kculture-<date>.json` 육안 검토 — Exa/RSS 항목 존재, 나라별
  쇼츠 2개(또는 note), 조용히 빈 소스 없음.
- **첫 요약 패스:** 세션에서 트리거 → `.md` 육안 검토 (4섹션, 원어+한국어 병기,
  연애후기 집계형·신상정보 없음, 쇼츠 조회수 표기). 어긋나면 README 규칙 조정.
- **회귀:** `_lib.mjs` 추출 후 `fetch.mjs` 1회 실행, `daily/raw-<date>.json` 구조 불변 확인.

## 운영

- **주기:** 수동 트리거가 기본. 선택으로 `run-fetch-kculture.ps1` + Windows 작업 스케줄러
  주간 항목(예: 월요일)을 만들어 raw를 미리 구워둘 수 있다 (기존 `run-fetch.ps1` 방식).
- **보존:** `raw-kculture-*.json`(스크립트가 purge) + `kculture/*.md`(요약 세션이
  오래된 것 삭제) 둘 다 60일. 주간이라 각 약 8~9개 유지.
- **커밋 정책:** 생성물(raw json, 주간 `.md`) **둘 다 로컬 전용, git 제외**. `.gitignore`에
  `/news-digest/kculture/raw-kculture-*.json` 와 `/news-digest/kculture/*.md` 추가.
  이 스펙 문서와 코드(`_lib.mjs`, `fetch-kculture.mjs`, `kculture/README.md`,
  `TEMPLATE.md`, `sources.json`)는 커밋한다.

## 범위 밖 (YAGNI)

- seen-topics / 반복 억제 (v1 제외)
- 4개 섹션 외 주제 (K-food, 뷰티, 여행, 한국살이 전반 등)
- 중앙아시아/기타 국가 쇼츠
- TikTok을 신뢰 소스로 취급 (best-effort만)
- 자동 번역 API (제목 한국어 병기는 에이전트가 직접)
- 앱 "뉴스" 게시판 자동 연동 (사람이 검토 후 별도 결정)

## 미해결 / 구현 시 확정

1. `mcporter call exa`의 구조화(JSON) 출력 옵션 유무 — 없으면 현재 텍스트 블록
   (`Title: / URL Source: / Published Time: / Highlights:`) 파싱.
2. RSS 피드 실제 URL 검증 (Soompi, allkpop, 필요 시 K-drama 전용 하나).
3. 국가별 쇼츠 검색어 실제 목록 (베트남어/태국어/인도네시아어/필리핀어 한국 관련 seed).
4. 프로젝트 테스트 러너 확인 (`node:test` 직접 실행 vs 기존 설정 유무).
