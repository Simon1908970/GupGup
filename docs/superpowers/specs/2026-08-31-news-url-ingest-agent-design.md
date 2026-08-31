# 뉴스 URL 인제스트 에이전트 (v1) — 설계 문서

- 날짜: 2026-08-31
- 상태: 설계 승인됨 (스펙 검토 대기 → 구현 계획)
- 관련: 기존 뉴스 카테고리 기능(`2026-08-31-news-category-admin-articles-design.md`),
  `POST /api/admin/news`, `src/lib/news/newsInput.ts`, `news-digest/` 파이프라인,
  agent-reach CLI

## 배경 / 목적

줍줍(Gup Gup)의 "뉴스" 카테고리는 운영자 콘텐츠다. 지금은 관리자가 `/admin/news` 폼에
6개 필드(헤드라인 / 출처명 / 출처 URL / 원문 언어 / 원문 발췌 / 한국어 요약)를 직접
입력한다.

이 문서는 그 입력을 반자동화한다. **운영자가 채팅(Claude 세션)에 뉴스 기사 URL 하나를
주면, Claude가 기사를 가져와 발췌·한국어 요약·이미지 후보를 만들어 초안으로 보여주고,
운영자가 검토·승인하면 게시**한다.

핵심 제약: 정식 뉴스이므로 **사람이 게시 전 초안을 검토**한다(완전 무인 자동화 아님).
저작권상 원문 전문을 옮기지 않고 짧은 발췌 + 자기 표현 요약 + 출처 링크만 싣는다.

## 범위 (v1)

**포함**
1. 채팅 워크플로우: URL → 본문 추출 → 초안(발췌 + 한국어 요약 + 출처 + 이미지 후보) →
   검토 → 게시
2. 게시 스크립트 `news-digest/publish-news.mjs` (서비스 롤, 커밋)
3. 이미지: 무료 스톡(Pexels) 검색 → 후보 제시 → 선택 1장 → Supabase Storage 저장 →
   `posts.thumbnail_url`
4. 마이그레이션 `0013`: `news` Storage 버킷(공개 읽기) + `posts.image_credit` 컬럼
5. `newsInput.ts` 검증에 `originalBody` 최대 길이 상한 추가
6. 뉴스 상세 화면: 이미지 + 크레딧을 `원문` 라벨 위에 렌더
7. CLAUDE.md에 "뉴스 URL 가져오기" 절차 + 저작권 규칙 명문화

**제외 (v1 범위 밖)**
- URL 목록 배치 처리 / 스케줄 자동 실행
- 앱 내 관리자 화면 "URL 가져오기" 버튼
- AI 생성 이미지·영상, 모션 그래픽
- 다중 이미지 / 갤러리
- 원문 자동 전체 번역

## 승인된 접근: 로컬 서비스-롤 게시 스크립트 (접근 A)

- `news-digest` 파이프라인과 동일한 패턴: 로컬 Node 스크립트가 `.env.local` 자격증명으로
  Supabase에 직접 쓴다.
- 사람 검토는 **채팅에서 초안을 보는 것**으로 확보된다. 승인 후 Claude가 스크립트를 실행한다.
- 앱(공개 라우트)에는 새 인증 수단·엔드포인트를 추가하지 않는다.

기각한 대안:
- **접근 B — `/api/admin/news`에 베어러 토큰 인증 추가**: 공개 라우트에 새 인증 =
  공격면 증가. 라우트가 이미 서비스 롤 insert를 하므로 스크립트로 바로 쓰는 편이 단순.
- **접근 C — 관리자 폼에 이미지 업로드 칸 + 6필드 수동 입력**: 매번 수작업.
  "URL만 주면"의 이점이 사라짐.

## 1. 동작 흐름 (채팅)

운영자가 채팅에 뉴스 기사 URL을 붙여넣으면 Claude가:

1. **본문 추출** — `curl -s "https://r.jina.ai/<URL>"` (agent-reach 무설정 경로).
   실패 시 대체: agent-reach `web` 경로 / 직접 fetch.
   - 페이월, 로그인 필요, JS 렌더링만, 비(非)기사 페이지(홈·카테고리·태그 목록) →
     "이 URL은 가져올 수 없습니다" 보고 후 중단.
2. **초안 작성**
   - **헤드라인** — 한국어, 사실 위주 한 줄
   - **원문 발췌** — 기사 도입부 **2~4문장**만, 원문 언어 그대로. 전문·대량 인용 금지.
   - **한국어 요약** — **4~8문장**, 자기 표현으로 재작성. 원문 문장을 그대로 옮기지 않고
     사실관계만 정리. 불확실·미확인 내용 제외.
   - **출처** — 매체명(도메인/사이트명에서 추정, 예: `Khaosod (ข่าวสด)`) + 원문 URL
   - **원문 언어 코드** — 도메인·본문에서 추정 (`th`, `en`, `ja` …)
   - **이미지 후보** — Pexels에서 기사 주제 키워드(장소·사물·개념)로 3~5장 검색.
     사람·특정 인물·브랜드 로고가 주 피사체인 것은 Claude가 후보에서 배제. 각 후보의
     썸네일 URL + 사진작가명을 채팅에 제시.
3. **초안 + 이미지 후보를 채팅에 표시** → 운영자가 문구 수정 지시 / 이미지 번호 선택 /
   "이미지 없이" 선택 가능
4. **승인 시** — Claude가 초안을 `/tmp` 또는 스크래치패드에 JSON으로 쓰고
   `node --env-file=.env.local news-digest/publish-news.mjs <draft.json>` 실행.
   결과(게시글 id, 상세 URL)를 보고.

## 2. 게시 스크립트 `news-digest/publish-news.mjs` (커밋)

### 입력 JSON

```jsonc
{
  "title": "…",              // 한국어 헤드라인 (필수)
  "sourceName": "…",         // 매체명 (필수)
  "sourceUrl": "https://…",  // 원문 URL (필수, http/https)
  "originalLang": "th",      // 원문 언어 코드 (선택, 기본 "th")
  "originalBody": "…",       // 원문 발췌 (필수, 상한 700자)
  "body": "…",               // 한국어 요약 (필수)
  "imageUrl": "https://…",   // 선택. 없으면 이미지 없이 게시
  "imageCredit": "Photo: Jane Doe (Pexels)"  // imageUrl 있으면 필수
}
```

### 동작

1. 입력 검증 — 스크립트 자체 검증(플레인 JS. `src/`의 TS 검증기를 `.mjs`에서 import할 수
   없으므로 규칙을 그대로 옮겨 구현): `title`/`sourceName`/`sourceUrl`/`originalBody`/`body`
   필수, `sourceUrl` http(s), `originalBody` 700자 이내, `imageUrl` 있으면 `imageCredit` 필수.
   (같은 700자 규칙이 `newsInput.ts`에도 들어가 `/admin/news` 폼 경로를 커버 — §3.)
2. **중복 방지** — `posts`에서 같은 `source_url` 행이 있으면 경고 후 중단. `--force`로 강행.
3. `imageUrl` 있으면: 다운로드(최대 5MB, `image/*` MIME만) → `news` Storage 버킷에
   `<uuid>.<ext>`로 업로드 → 공개 URL 획득.
4. `posts` insert (서비스 롤):
   ```
   category: 'news',
   sub_category: null,
   country: 'etc',
   author_id: <env NEWS_AUTHOR_ID>,
   points_awarded: 0,
   title, body,
   original_body, original_lang: originalLang || 'th',
   source_name, source_url,
   thumbnail_url: <공개 URL 또는 null>,
   image_credit: <imageCredit 또는 null>
   ```
5. 성공 시 `{ id, url: "/board/news/<id>" }` 출력.

### 옵션

- `--dry-run` — 이미지 업로드·insert 없이 최종 payload를 stdout에 출력.
- `--force` — 중복 `source_url` 무시.

### 환경변수 (`.env.local`)

| 이름 | 용도 | 상태 |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | 서비스 롤 insert / Storage 업로드 | 기존 |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL | 기존 |
| `NEWS_AUTHOR_ID` | 뉴스 글 `author_id`로 쓸 운영 admin의 `profiles.id` (UUID) | **신규** |
| `PEXELS_API_KEY` | Pexels 이미지 검색 (스펙 확정 후 발급) | **신규** |

`PEXELS_API_KEY`는 스크립트가 아니라 **Claude가 채팅에서 후보 검색할 때** 쓴다
(`curl -s -H "Authorization: <key>" "https://api.pexels.com/v1/search?query=…&per_page=8"`).
스크립트는 최종 `imageUrl`만 받는다.

### 테스트

`news-digest/publish-news.test.mjs` (기존 `node --test` 패턴):
- 필수 필드 누락 → 오류
- `originalBody` 700자 초과 → 오류
- `imageUrl`만 있고 `imageCredit` 없음 → 오류
- `--dry-run` payload 스냅샷 (category/country/points_awarded/author_id 고정값 확인,
  `.rpc` 호출 없음)
- `sourceUrl` 비-http 스킴 → 오류

## 3. 앱 변경 (커밋)

### 마이그레이션 `supabase/migrations/0013_news_image.sql`

```sql
-- 뉴스 기사 이미지용 공개 읽기 Storage 버킷 + 사진 크레딧 컬럼.
-- 정확한 버킷/정책 문법은 supabase/migrations/0002_avatar_storage.sql 패턴을 따를 것.
insert into storage.buckets (id, name, public)
values ('news', 'news', true)
on conflict (id) do nothing;

create policy "news images are publicly readable"
  on storage.objects for select
  using (bucket_id = 'news');

alter table posts add column image_credit text;
```

- 서비스 롤은 RLS를 우회하므로 insert 정책은 불필요 (공개 read 정책만 필요).
- 버킷은 Supabase 대시보드 Storage에서 만들어도 됨 — 마이그레이션은 재현성용.
- `posts`는 전체 테이블 grant라 `image_credit` 컬럼 grant 불필요(0011과 동일).

### `src/lib/news/newsInput.ts`

- `validateNewsArticleInput`에 `originalBody` 길이 검증 추가:
  `if (input.originalBody && input.originalBody.trim().length > 700) return "originalBody";`
- `NewsArticleInput`에 `imageCredit?: string` (선택) 추가. `NewsInputError`는 변경 없음
  (길이 초과도 `"originalBody"`로 보고).

### `src/lib/types.ts` / `src/lib/supabase/posts.ts`

- `Post`에 `imageCredit?: string`
- `PostRow`에 `image_credit: string | null`
- `POST_SELECT`에 `image_credit`
- `mapPost`에 `imageCredit: row.image_credit ?? undefined`

### `src/app/api/admin/news/route.ts`

- 요청 본문에서 `imageCredit`(선택) 읽어 insert에 통과. (수동 등록에서도 크레딧 입력 가능)
- `imageCredit` 컬럼만 추가, 나머지 로직 불변.

### `src/app/board/[category]/[postId]/page.tsx` (뉴스 분기)

`config.slug === "news"`이고 `post.thumbnailUrl`이 있으면 **`원문` 라벨 위**에:

```tsx
<figure className="mb-4">
  {/* eslint-disable-next-line @next/next/no-img-element */}
  <img src={post.thumbnailUrl} alt="" className="w-full rounded-lg object-cover" />
  {post.imageCredit && (
    <figcaption className="mt-1 text-[11px] text-[var(--color-text-muted)]">
      {post.imageCredit}
    </figcaption>
  )}
</figure>
```

- 번역 토글과 무관 (이미지·크레딧은 항상 그대로).
- `thumbnailUrl` 없으면 이미지 블록 없이 기존 그대로.

### 목록 / 메인

`PostListItem`은 이미 `post.thumbnailUrl`을 14×14 썸네일로 렌더한다 → **변경 없음**.
`CategoryBox`(메인 뉴스 박스)는 제목+날짜만 → 변경 없음.

## 4. CLAUDE.md 추가 — "뉴스 URL 가져오기 요청 (운영 지침)"

새 섹션. 트리거 예: "이 기사 뉴스에 올려줘", URL만 붙여넣기.

절차:
1. `r.jina.ai`로 본문 추출. 실패 시 대체 경로. 비기사/페이월이면 중단·보고.
2. 초안 작성 규칙:
   - 원문 발췌: **2~4문장**, 원문 언어 그대로, 700자 이내
   - 한국어 요약: **4~8문장**, 자기 표현 재작성, 원문 문장 그대로 옮기지 않음,
     불확실·미확인·광고성 내용 제외
   - 출처(매체명 + URL) 필수
   - 이미지: Pexels 검색, **사람·특정 인물·브랜드 로고가 주 피사체인 것 제외**,
     후보 3~5장 제시, 선택 후 크레딧 문자열 생성(`Photo: <작가> (Pexels)`)
3. 초안 + 후보를 채팅에 표시, 승인 대기 (임의 게시 금지)
4. 승인 시 draft JSON 작성 → `node --env-file=.env.local news-digest/publish-news.mjs <file>`
5. 게시글 id·URL 보고

저작권 규칙(고정):
- 원문 전문/대량 인용 금지, 발췌만
- 요약은 사실관계 재작성, 원문·타 매체 문장 복붙 금지
- 출처 링크 필수
- 이미지는 Pexels(무료 라이선스), 사람 이미지 금지, 크레딧 표시
- AI 생성 이미지·영상 사용 안 함

## 5. 대상 URL 범위

- 아무 뉴스 **기사** URL (국내/해외 무관).
- 거부: 사이트 홈/섹션/태그 목록 페이지, 페이월, 로그인 필요 페이지, 동영상 전용 페이지,
  본문이 사실상 없는 페이지.

## 6. 저작권 가드레일 (재확인)

| 요소 | 규칙 | 강제 위치 |
|---|---|---|
| `original_body` | 원문 발췌 2~4문장, 700자 이내 | `validateNewsArticleInput` + 스크립트 + CLAUDE.md |
| `body` | 한국어 요약, 자기 표현 재작성, 원문 대체 수준 금지 | CLAUDE.md 절차 |
| `source_url` / `source_name` | 필수, 화면 표시 | 기존 검증 + 렌더 |
| 이미지 | Pexels 무료 라이선스, 사람·인물·로고 배제, 크레딧 표시 | CLAUDE.md 절차 + `image_credit` |
| AI 생성물 | 이미지·영상 생성 안 함 | CLAUDE.md 절차 |

## 7. 검증

- **`publish-news.mjs`**: `news-digest/publish-news.test.mjs` (node --test). §2 테스트 목록.
- **앱 변경**: `npx tsc --noEmit` + `npm run lint` + `npx next build` +
  브라우저에서 이미지 있는 뉴스 상세를 열어 이미지+크레딧이 `원문` 위에 렌더되는지,
  번역 토글 시 이미지가 그대로인지, 이미지 없는 뉴스는 회귀 없는지 확인.
- **마이그레이션 `0013`**: Supabase SQL Editor 수동 적용 (0011/0012와 동일).
  적용 후 `news` 버킷이 Storage에 보이고 공개 URL로 이미지가 열리는지 확인.

## 영향 파일 요약

| 파일 | 변경 |
|---|---|
| `supabase/migrations/0013_news_image.sql` | 신규 — `news` 버킷 + 정책 + `posts.image_credit` |
| `news-digest/publish-news.mjs` | 신규 — 게시 스크립트 |
| `news-digest/publish-news.test.mjs` | 신규 — 스크립트 테스트 |
| `src/lib/news/newsInput.ts` | `originalBody` 길이 상한, `NewsArticleInput.imageCredit?` |
| `src/lib/types.ts` | `Post.imageCredit?` |
| `src/lib/supabase/posts.ts` | `PostRow` / `POST_SELECT` / `mapPost`에 `image_credit` |
| `src/app/api/admin/news/route.ts` | `imageCredit` 필드 통과 |
| `src/app/board/[category]/[postId]/page.tsx` | 뉴스 분기에 이미지+크레딧 블록 |
| `CLAUDE.md` | "뉴스 URL 가져오기" 절차 + 저작권 규칙 |
| `.env.local.example` | `NEWS_AUTHOR_ID`, `PEXELS_API_KEY` 항목 |
