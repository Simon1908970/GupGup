# 뉴스 카테고리 — 관리자 전용 기사(원문 발췌 + 한국어 요약) 설계 문서

- 날짜: 2026-08-31
- 상태: 설계 승인됨 (스펙 검토 대기 → 구현 계획)
- 관련 코드: `src/app/board/[category]/`, `src/app/admin/`, `src/lib/supabase/posts.ts`,
  `src/lib/i18n/dictionaries.ts`, `supabase/migrations/`

## 배경 / 목적

줍줍(Gup Gup)은 한국 거주 외국인(특히 동남아·중앙아 출신) 대상 커뮤니티 웹앱.
"뉴스" 카테고리는 CLAUDE.md 상 **운영자 콘텐츠**(작성자 아바타 없음)이지만, 현재
뉴스 글을 등록할 UI가 전혀 없다(`config.slug !== "news"` 가드로 글쓰기 버튼이 숨겨짐).

첫 활용 사례: "파주에서 일하는 태국인 형제가 한국 로또 1155회차 1등(약 40억 원) 당첨"
사건. 이 사건을 다룬 **태국 매체 기사의 핵심 발췌 + 출처 링크**를 위에 싣고, 그 아래에
**한국어 요약**을 붙인 뉴스 게시글을 만든다.

당초 사용자는 YTN 유튜브 영상 임베드를 검토했으나, (1) 영상 설명란의 "무단 전재·재배포
금지" 문구, (2) 상업 서비스로서의 잔여 리스크, (3) "AI로 유사 영상 재제작"은 상표·부정
경쟁·정확성·AI 표시의무 측면에서 오히려 리스크가 큼 — 을 이유로 **영상을 쓰지 않고**
태국 매체 기사 발췌 + 한국어 요약 방식으로 확정했다.

## 범위

**포함**
1. `posts`에 뉴스 기사용 nullable 컬럼 4개 추가 (마이그레이션)
2. 관리자 전용 뉴스 작성 페이지 + API 라우트 (일반 유저는 여전히 뉴스 작성 불가)
3. 뉴스 상세 화면: 원문 발췌 블록 + 출처 링크 + 구분선 + 한국어 요약, 작성자 자리에
   고정 라벨 "줍줍 뉴스"
4. "번역하기" 버튼: 기존 위치·컴포넌트 그대로, **원문·출처명을 제외**하고 제목·한국어
   요약만 번역
5. 댓글: 이미 동작하므로 코드 변경 없이 수동 검증만
6. 신규 UI 문자열 4개를 10개 로케일 전부에 추가
7. 첫 게시글(태국 로또 기사) 콘텐츠 준비 — 관리자 폼으로 직접 입력할 수 있도록
   Khaosod 발췌 + 한국어 요약 + 출처를 정리해 제공

**제외 (YAGNI)**
- 뉴스 글 수정 기능 (지금은 삭제 후 재등록; 삭제는 기존 `/admin/posts`에서 가능)
- 유튜브/영상 임베드
- 뉴스 국가 태그·국가 필터 (`country`는 `'etc'`로 저장, 화면 노출 안 함)
- 실제 "줍줍 운영팀" 서비스 계정 (고정 라벨로 대체)
- 리치텍스트·이미지 본문
- 프론트엔드 자동 테스트 인프라 도입 (별건)

## 승인된 접근: `posts`에 nullable 컬럼 추가 (접근 A)

`posts` 테이블에 뉴스 전용 옵션 컬럼 4개를 추가하고, `category = 'news'`일 때만 채운다.

근거:
- 기존 목록(`/board/[category]`)·상세(`/board/[category]/[postId]`)·댓글·조회수·
  메인 박스(`fetchLatestPosts`)·관리자 삭제 배관을 **전부 재사용**한다.
- `sub_category` / `thumbnail_url`처럼 이미 존재하는 "카테고리별 옵션 컬럼" 패턴과 동일.
- `posts`는 전체 테이블 SELECT grant를 사용한다(0008에서 컬럼 단위로 좁힌 것은
  `profiles`뿐). 따라서 새 컬럼은 자동으로 읽기 가능 — 별도 grant 마이그레이션 불필요.

기각한 대안:
- **접근 B — 별도 `news_articles` 테이블**: 댓글 FK·조회수·메인 `fetchLatestPosts`·
  목록·관리자 배관을 전부 다시 깔아야 함. 코드 중복, 기존 패턴 위반.
- **접근 C — `body` 한 덩어리에 구분자로 원문+요약+출처**: 파싱 취약, "요약만 번역"
  하려면 어차피 분리 필요, 출처 URL이 실제 링크가 되지 않음.

## 1. 데이터 모델 & 마이그레이션

### 마이그레이션 `supabase/migrations/0011_news_article_fields.sql`

```sql
-- 뉴스 카테고리 전용 필드. category='news'일 때만 채워지며 나머지 카테고리는 null.
alter table posts add column original_body text;
alter table posts add column original_lang text;
alter table posts add column source_name  text;
alter table posts add column source_url   text;
```

컬럼 grant·RLS 변경 없음 (`posts`는 전체 테이블 grant, 읽기 정책은 이미 `using (true)`).

### 필드 의미

| 컬럼 | 뜻 | 번역 대상 |
|---|---|---|
| `title` | 한국어 헤드라인 | O (기존 그대로) |
| `body` | 한국어 요약 | O |
| `original_body` | 태국 매체 핵심 발췌 (원문 언어 그대로) | **X — 항상 원문 유지** |
| `original_lang` | 원문 언어 코드 예: `th` (라벨 + `lang=` 속성용, 옵션) | X |
| `source_name` | 출처 매체명 예: `Khaosod (ข่าวสด)` | X |
| `source_url` | 원문 기사 URL | X |

### 타입 / 매퍼 변경

- `src/lib/types.ts` — `Post`에 추가:
  ```ts
  originalBody?: string;
  originalLang?: string;
  sourceName?: string;
  sourceUrl?: string;
  ```
- `src/lib/supabase/posts.ts`:
  - `PostRow` 인터페이스에 `original_body`/`original_lang`/`source_name`/`source_url`
    (모두 `string | null`) 추가
  - `POST_SELECT` 문자열에 4개 컬럼 추가
  - `mapPost`에서 `?? undefined` 매핑 추가

## 2. 관리자 전용 게시 플로우

### 새 페이지 `src/app/admin/news/page.tsx`

- 클라이언트 컴포넌트, 기존 `src/app/admin/posts/page.tsx` 스타일 준수
- **작성 폼** 입력:
  - 헤드라인 (한국어) — 필수
  - 출처 매체명 — 필수
  - 출처 URL — 필수, `http(s)://`로 시작
  - 원문 발췌 (태국어 등) — 필수, `<textarea>`
  - 한국어 요약 — 필수, `<textarea>`
  - (원문 언어 코드는 폼에 노출하되 옵션, 기본값 `th`)
- 제출 → `POST /api/admin/news` → 성공 시 폼 초기화 + 목록 새로고침
- **기존 뉴스 목록**: `category='news'` 최신순, 각 항목에 `보기`(새 탭) + `삭제` 버튼
  - 삭제는 기존 `DELETE /api/admin/posts/[id]` 재사용 (points_awarded=0이라 포인트 정산
    없음, `ConfirmModal`로 확인)

### 새 라우트 `src/app/api/admin/news/route.ts`

- `POST` 핸들러
- `assertAdmin()` 게이트 (실패 시 403)
- 본문 검증: `title`, `sourceName`, `sourceUrl`, `originalBody`, `body`(요약) 필수;
  `sourceUrl`은 `new URL()` 파싱 성공 + 프로토콜이 `http:`/`https:`. 실패 시 400
- `createAdminClient()`로 `posts` insert:
  ```
  category: 'news',
  country: 'etc',
  sub_category: null,
  author_id: admin.userId,
  points_awarded: 0,
  title, body,
  original_body, original_lang: originalLang || 'th',
  source_name, source_url
  ```
- `createPost`(포인트 지급/차감) 로직은 타지 않음 — 서비스 롤 직접 insert
- 응답: `{ ok: true, id }`

### 관리자 내비게이션

`src/app/admin/layout.tsx`의 `NAV` 배열에서 "게시글 관리" 바로 위에 추가:
```ts
{ href: "/admin/news", label: "뉴스 관리" },
```

### 공개 게시판 가드

`src/app/board/[category]/page.tsx`의 `config.slug !== "news"` 글쓰기 버튼 가드는
**변경 없음** — 일반 유저는 여전히 뉴스에 글을 쓸 수 없다.

## 3. 뉴스 상세 화면 + 번역

파일: `src/app/board/[category]/[postId]/page.tsx`

`categorySlug === 'news'`이고 `post.originalBody`가 있을 때 렌더링을 분기한다.

### 작성자 줄

- `post.author.nickname` 대신 고정 라벨 `t("news.byline")` = "줍줍 뉴스"
- `TranslateToggle`은 **현재 위치 그대로** (작성자 줄 오른쪽, `justify-between`)

### 본문 영역 (원문 먼저, 요약 아래)

1. **원문 라벨** `t("news.originalLabel")`
2. `post.originalBody` — `whitespace-pre-wrap`, `lang={post.originalLang}`.
   **번역 토글과 무관하게 항상 원문 그대로.**
3. **출처 줄** — `출처: ` 접두 라벨(`t("news.sourceLabel")`) 다음에 `post.sourceName`을
   하이퍼링크 텍스트로: `<a href={post.sourceUrl} target="_blank"
   rel="noopener noreferrer nofollow">{post.sourceName}</a>`
4. 구분선 (`border-t border-[var(--color-border-gray-light)]`)
5. **한국어 요약 라벨** `t("news.summaryLabel")`
6. `post.body` — 번역 토글 ON이면 번역본, OFF면 원본. (기존 `body` 렌더 로직 재사용)

### 번역 동작

- `handleToggleTranslate`에서 뉴스는 `texts: [post.title, post.body]`만 전송
  (제목 + 한국어 요약). `original_body`·`source_name`은 애초에 전송하지 않음.
- 현재 코드도 `[post.title, post.body]`를 보내므로 실질 변경은 "원문 블록을 번역 경로에
  태우지 않는다"는 렌더 분기뿐.
- 번역 실패 시 기존처럼 원문 표시 유지.

### 비(非)뉴스 카테고리

변경 없음.

## 4. 목록 / 메인 / 댓글 / 기타

### `/board/news` 목록

- `src/components/board/PostListItem.tsx` — `post.category === 'news'`이면 닉네임
  자리(`post.author.nickname`)에 `t("news.byline")` 표시
- 제목 번역은 기존 `useTitleTranslation` 그대로 동작 (변경 없음)
- 국가 필터 칩·서브카테고리 탭은 뉴스에 없음 (`hasCountryTag: false`, `subCategories`
  없음) — 변경 없음

### 메인 `CategoryBox` (뉴스 대형 박스)

변경 없음 — 제목 + 날짜만 노출하고 작성자를 렌더하지 않는다.

### 댓글

- `CommentSection`과 댓글 입력 폼은 상세 페이지에서 카테고리와 무관하게 렌더된다.
- 댓글 insert 정책은 "로그인 + `auth.uid() = author_id`"로 누구나 가능.
- **코드 변경 없음.** 수동 검증만 수행 (아래 검증 절차).

### i18n

`src/lib/i18n/dictionaries.ts` — 다음 4개 키를 **10개 로케일 전부**
(ko, en, vi, th, id, tl, lo, my, mn, ru)에 추가:

| 키 | ko | en (참고) |
|---|---|---|
| `news.byline` | 줍줍 뉴스 | Gup Gup News |
| `news.originalLabel` | 원문 | Original |
| `news.summaryLabel` | 한국어 요약 | Korean Summary |
| `news.sourceLabel` | 출처 | Source |

나머지 8개 언어 번역은 구현 시 채운다. `DictionaryKey`는 `keyof typeof ko`이므로
`ko`에 키를 넣으면 나머지 로케일에도 반드시 채워야 타입이 통과한다.

## 5. 첫 게시글 콘텐츠 (관리자 폼 입력용)

구현 완료 후, 관리자가 `/admin/news` 폼에 붙여넣을 수 있도록 아래를 정리해 제공한다.

- **출처 매체명**: `Khaosod (ข่าวสด)` — 필요 시 PPTV HD36을 2차 출처로 언급
- **출처 URL**: `https://www.khaosod.co.th/special-stories/news_9599969`
- **원문 발췌**: Khaosod 기사 도입부 1문단 수준(2~4문장)만 태국어 원문으로. 전문 복제 금지.
- **한국어 요약**: 로또 1155회차(1/18 추첨) 1등 7명, 각 40억 6,637만 원(세후 약 27억
  5,700만 원). 파주 금촌역 인근 판매점 자동 구매. 같은 공장에서 일하는 태국인 2명이
  당첨금을 절반씩 수령, 태국 돈 약 9,600만 바트(각 약 4,500만 바트). 당첨자는 우돈타니
  출신으로 계약 만료(5~6개월 후)까지 근무 예정이라고 태국 매체가 보도. 외국인 당첨 시
  거주자/비거주자에 따라 세율이 달라짐. — 모두 자기 표현으로 재작성, YTN/기사 문장
  그대로 복사 금지.
- 원문 언어 코드: `th`

## 6. 검증 방법

이 레포에는 프론트엔드 테스트 프레임워크가 없다 (`npm test`는 `news-digest/**/*.test.mjs`
전용; devDeps에 jest/vitest/@testing-library 없음). 이 기능의 검증은:

1. **타입 체크** — `npx tsc --noEmit` (또는 `next build`)
2. **린트** — `npm run lint`
3. **수동 확인** (실행 중인 dev 서버 + 브라우저 패널):
   - 테스트 계정의 `profiles.is_admin`을 임시로 `true`로 설정
   - `/admin/news`에서 첫 게시글 작성 → `{ ok: true, id }` 확인
   - `/board/news/<id>` 열기 → 원문 발췌 블록 / 출처 외부 링크 / 구분선 / 한국어 요약 /
     작성자 자리 "줍줍 뉴스" 확인
   - "번역하기" 토글 → 제목·요약만 번역되고 **원문 블록은 그대로**인지 확인
   - 다른 로케일로 전환 → 라벨(원문/출처/한국어 요약/줍줍 뉴스)이 해당 언어로 나오는지
   - 로그인 상태에서 댓글 1개 작성 → 목록에 반영 확인
   - `/board/news` 목록 + 메인 뉴스 박스에 새 글이 보이는지, 목록 작성자 자리가
     "줍줍 뉴스"인지 확인
   - 비(非)뉴스 카테고리 상세/목록이 회귀 없이 동작하는지 확인

자동 테스트를 원할 경우 테스트 인프라 도입은 별도 작업으로 분리한다.

## 영향 파일 요약

| 파일 | 변경 |
|---|---|
| `supabase/migrations/0011_news_article_fields.sql` | 신규 — 컬럼 4개 |
| `src/lib/types.ts` | `Post`에 옵션 필드 4개 |
| `src/lib/supabase/posts.ts` | `PostRow` / `POST_SELECT` / `mapPost` |
| `src/app/admin/news/page.tsx` | 신규 — 작성 폼 + 목록 |
| `src/app/api/admin/news/route.ts` | 신규 — POST, assertAdmin, 서비스 롤 insert |
| `src/app/admin/layout.tsx` | `NAV`에 "뉴스 관리" 항목 |
| `src/app/board/[category]/[postId]/page.tsx` | 뉴스 렌더 분기 (원문/출처/요약/byline) |
| `src/components/board/PostListItem.tsx` | 뉴스면 작성자 자리에 byline 라벨 |
| `src/lib/i18n/dictionaries.ts` | `news.*` 키 4개 × 10 로케일 |
