# 게시글 유튜브/틱톡 링크 자동 임베드 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 게시글 상세화면(뉴스가 아닌 일반 카테고리)에서 본문에 포함된 유튜브·틱톡 링크를 안전하게 재생 가능한 iframe 임베드로 보여준다.

**Architecture:** URL 인식·검증·임베드 주소 조립은 프레임워크 의존성 없는 순수 로직(`src/lib/embeds.mjs`)으로 분리해 Node 내장 테스트 러너로 TDD한다. React 쪽은 그 로직을 소비하는 얇은 프레젠테이션 컴포넌트 2개(`EmbedFrame`, `PostBody`)로 구성하고, 서버는 어떤 외부 URL도 호출하지 않는다(화이트리스트 정규식 매칭 → 우리가 직접 고정 템플릿으로 embed URL 조립). CSP `frame-src` 헤더를 2차 방어선으로 추가한다.

**Tech Stack:** Next.js(App Router) + React 19 + TypeScript(strict), Tailwind CSS v4, Node 내장 테스트 러너(`node --test`).

**Spec:** [docs/superpowers/specs/2026-10-26-post-link-embed-design.md](../specs/2026-10-26-post-link-embed-design.md)

## Global Constraints

- https 스킴만 허용, 호스트는 정확히 매칭(`(www.)?youtube.com`, `youtu.be`, `(www.)?tiktok.com`) — 서브도메인 위장(`youtube.com.evil.com`), userinfo 트릭(`evil@youtube.com`) 등은 전부 거부.
- 서버는 사용자 입력에 기반해 어떤 외부 URL도 호출하지 않는다(oEmbed 실시간 호출 금지). embed URL은 정규식으로 뽑아낸 ID로 우리가 직접 고정 템플릿 조립.
- `dangerouslySetInnerHTML` 사용 금지 — iframe은 항상 React JSX로 직접 작성.
- 글 하나당 임베드 최대 3개(`MAX_POST_EMBEDS = 3`), 초과분은 텍스트로만 유지.
- 자동재생 기본 꺼짐(`autoplay=0`).
- 적용 범위는 `[postId]/page.tsx`의 **일반(뉴스 아닌) 카테고리 본문 블록 하나만**. 뉴스 원문/요약 블록, 댓글 본문은 건드리지 않는다.
- 임베드 감지는 항상 **원문 `post.body`** 기준. 번역 토글(`translated.body`)이 켜져 있어도 임베드 박스는 사라지지 않는다.
- TikTok 단축링크(`vm.tiktok.com`), X/트위터, 페이스북/인스타그램은 이번 범위 밖 — 매치 안 되면 평문 텍스트로 안전하게 유지(크래시 금지).
- 새 UI 텍스트(iframe `title`)는 프로젝트 관례대로 `SUPPORTED_LOCALES` 11개 언어 전부 번역해 `dictionaries.ts`에 추가한다(1차는 AI 초안, 원어민 검수는 이번 구현을 막는 조건 아님).
- CSP 헤더: `Content-Security-Policy: frame-src 'self' https://www.youtube-nocookie.com https://www.tiktok.com;` 를 전 라우트에 추가.

## Review Focus

- URL 앞뒤에 문장/문장부호가 붙어 복붙된 경우(예: `"...보세요: https://youtu.be/dQw4w9WgXcQ!"`) — 정확 매치 실패 시 평문 텍스트로만 남아야 한다(Task 1).
- 도메인 위장·userinfo 트릭(`https://youtube.com.evil.com/watch?v=...`, `https://evil@youtube.com/watch?v=...`) — 절대 매치되면 안 된다(보안 핵심, Task 1).
- 실사용자가 흔히 공유하는 TikTok 단축링크(`https://vm.tiktok.com/XXXXXXX/`) — 범위 밖이라 매치 안 되지만, 에러 없이 평문으로 안전하게 유지돼야 한다(Task 1).
- 글 하나에 지원 링크가 4개 이상 포함된 경우 — 처음 3개(중복 URL 제외)만 임베드되고 나머지는 텍스트로 남아야 한다(Task 1).
- 비-https(`http://www.youtube.com/watch?v=...`) 링크 — 매치되면 안 된다(Task 1).

---

### Task 1: URL 인식·검증 순수 로직 (`embeds.mjs`)

**Files:**
- Create: `src/lib/embeds.mjs`
- Create: `src/lib/embeds.ts` (TypeScript 타입을 입힌 re-export, `src/lib/kakaoGeocode.ts`와 동일 패턴)
- Test: `src/lib/embeds.test.mjs`

**Interfaces:**
- Produces (소비는 Task 2):
  - `MAX_POST_EMBEDS: number` (값 `3`)
  - `detectEmbed(url: string): { provider: "youtube" | "tiktok"; embedUrl: string } | null`
  - `extractEmbeds(body: string): Array<{ provider: "youtube" | "tiktok"; embedUrl: string }>` (최대 `MAX_POST_EMBEDS`개, embedUrl 기준 중복 제거, 입력에 등장한 순서 유지)
  - TS 쪽 타입: `export type EmbedProvider = "youtube" | "tiktok";` / `export interface DetectedEmbed { provider: EmbedProvider; embedUrl: string }`

- [ ] **Step 1: Write the failing tests** in `src/lib/embeds.test.mjs`

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_POST_EMBEDS, detectEmbed, extractEmbeds } from "./embeds.mjs";

test("detectEmbed: youtube watch URL", () => {
  assert.deepEqual(detectEmbed("https://www.youtube.com/watch?v=dQw4w9WgXcQ"), {
    provider: "youtube",
    embedUrl: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=0&rel=0",
  });
});

test("detectEmbed: youtu.be short URL", () => {
  assert.deepEqual(detectEmbed("https://youtu.be/dQw4w9WgXcQ"), {
    provider: "youtube",
    embedUrl: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=0&rel=0",
  });
});

test("detectEmbed: youtube shorts URL", () => {
  assert.deepEqual(detectEmbed("https://www.youtube.com/shorts/dQw4w9WgXcQ"), {
    provider: "youtube",
    embedUrl: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=0&rel=0",
  });
});

test("detectEmbed: tiktok video URL", () => {
  assert.deepEqual(detectEmbed("https://www.tiktok.com/@koreanonlinecoursemgl/video/7591824021851852052"), {
    provider: "tiktok",
    embedUrl: "https://www.tiktok.com/player/v1/7591824021851852052?autoplay=0&music_info=0&description=0",
  });
});

test("detectEmbed: unsupported platform returns null", () => {
  assert.equal(detectEmbed("https://www.facebook.com/koreanonlinecoursemgl/posts/pfbid02SR"), null);
});

test("detectEmbed: rejects domain spoofing", () => {
  assert.equal(detectEmbed("https://youtube.com.evil.com/watch?v=dQw4w9WgXcQ"), null);
});

test("detectEmbed: rejects userinfo trick", () => {
  assert.equal(detectEmbed("https://evil@youtube.com/watch?v=dQw4w9WgXcQ"), null);
});

test("detectEmbed: rejects TikTok short link", () => {
  assert.equal(detectEmbed("https://vm.tiktok.com/ZSe8reciAwq/"), null);
});

test("detectEmbed: rejects non-https", () => {
  assert.equal(detectEmbed("http://www.youtube.com/watch?v=dQw4w9WgXcQ"), null);
});

test("detectEmbed: rejects malformed video id length", () => {
  assert.equal(detectEmbed("https://www.youtube.com/watch?v=short"), null);
});

test("extractEmbeds: no links returns empty array", () => {
  assert.deepEqual(extractEmbeds("그냥 평범한 글입니다."), []);
});

test("extractEmbeds: finds a link embedded mid-sentence", () => {
  const body = "이거 한번 보세요 https://youtu.be/dQw4w9WgXcQ 재밌어요";
  assert.deepEqual(extractEmbeds(body), [
    { provider: "youtube", embedUrl: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=0&rel=0" },
  ]);
});

test("extractEmbeds: URL with trailing punctuation is not detected", () => {
  const body = "보세요: https://youtu.be/dQw4w9WgXcQ!";
  assert.deepEqual(extractEmbeds(body), []);
});

test("extractEmbeds: caps at MAX_POST_EMBEDS and keeps input order", () => {
  assert.equal(MAX_POST_EMBEDS, 3);
  const body = [
    "https://youtu.be/aaaaaaaaaaa",
    "https://youtu.be/bbbbbbbbbbb",
    "https://youtu.be/ccccccccccc",
    "https://youtu.be/ddddddddddd",
  ].join("\n");
  const result = extractEmbeds(body);
  assert.equal(result.length, 3);
  assert.deepEqual(result.map((e) => e.embedUrl), [
    "https://www.youtube-nocookie.com/embed/aaaaaaaaaaa?autoplay=0&rel=0",
    "https://www.youtube-nocookie.com/embed/bbbbbbbbbbb?autoplay=0&rel=0",
    "https://www.youtube-nocookie.com/embed/ccccccccccc?autoplay=0&rel=0",
  ]);
});

test("extractEmbeds: dedupes the same URL repeated", () => {
  const body = "https://youtu.be/dQw4w9WgXcQ\n\n다시 봐도 좋아요 https://youtu.be/dQw4w9WgXcQ";
  assert.equal(extractEmbeds(body).length, 1);
});

test("extractEmbeds: ignores unsupported links mixed with supported ones", () => {
  const body = "https://www.facebook.com/x/posts/1 그리고 https://youtu.be/dQw4w9WgXcQ";
  const result = extractEmbeds(body);
  assert.equal(result.length, 1);
  assert.equal(result[0].provider, "youtube");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test src/lib/embeds.test.mjs`
Expected: FAIL — `Cannot find module './embeds.mjs'`

- [ ] **Step 3: Implement `src/lib/embeds.mjs`**

Export `MAX_POST_EMBEDS = 3`, `detectEmbed(url)`, `extractEmbeds(body)`.

`detectEmbed`: 네 개의 앵커(`^...$`) 정규식(youtube watch / youtu.be / youtube shorts / tiktok video)을 순서대로 시도해 첫 매치의 캡처 그룹(영상 ID)으로 provider별 고정 템플릿 문자열을 조립해 반환, 전부 미매치면 `null`.
- youtube watch: `/^https:\/\/(?:www\.)?youtube\.com\/watch\?v=([\w-]{11})(?:&.*)?$/`
- youtu.be: `/^https:\/\/youtu\.be\/([\w-]{11})(?:\?.*)?$/`
- youtube shorts: `/^https:\/\/(?:www\.)?youtube\.com\/shorts\/([\w-]{11})(?:\?.*)?$/`
- tiktok: `/^https:\/\/(?:www\.)?tiktok\.com\/@[\w.-]{1,24}\/video\/(\d{5,25})(?:\?.*)?$/`
- youtube embedUrl 템플릿: `` `https://www.youtube-nocookie.com/embed/${id}?autoplay=0&rel=0` ``
- tiktok embedUrl 템플릿: `` `https://www.tiktok.com/player/v1/${id}?autoplay=0&music_info=0&description=0` ``

`extractEmbeds`: `body.split(/\s+/)`로 토큰을 나누고, 각 토큰에 `detectEmbed`를 적용, `embedUrl` 기준 `Set`으로 중복 제거하면서 발견 순서대로 모으되 `MAX_POST_EMBEDS`개에서 멈춘다.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test src/lib/embeds.test.mjs`
Expected: PASS (모든 테스트 통과)

- [ ] **Step 5: Create `src/lib/embeds.ts`**

```ts
import {
  MAX_POST_EMBEDS as MAX_POST_EMBEDS_JS,
  detectEmbed as detectEmbedJs,
  extractEmbeds as extractEmbedsJs,
} from "./embeds.mjs";

export type EmbedProvider = "youtube" | "tiktok";

export interface DetectedEmbed {
  provider: EmbedProvider;
  embedUrl: string;
}

export const MAX_POST_EMBEDS: number = MAX_POST_EMBEDS_JS;
export const detectEmbed: (url: string) => DetectedEmbed | null = detectEmbedJs;
export const extractEmbeds: (body: string) => DetectedEmbed[] = extractEmbedsJs;
```

- [ ] **Step 6: Run the full project test suite to confirm no regressions**

Run: `npm test`
Expected: PASS (기존 테스트 전부 + 새 `embeds.test.mjs` 포함)

- [ ] **Step 7: Commit**

```bash
git add src/lib/embeds.mjs src/lib/embeds.ts src/lib/embeds.test.mjs
git commit -m "feat(embed): add youtube/tiktok url detection"
```

---

### Task 2: 임베드 렌더링 컴포넌트 + 게시글 상세화면 연결

**Files:**
- Create: `src/components/board/EmbedFrame.tsx`
- Create: `src/components/board/PostBody.tsx`
- Modify: `src/app/board/[category]/[postId]/page.tsx:226-230` (뉴스 아닌 일반 카테고리 본문 블록만 교체, 뉴스 블록 202/222는 그대로 둠)
- Modify: `src/lib/i18n/dictionaries.ts` (11개 로케일 블록 전부에 새 키 2개 추가)

**Interfaces:**
- Consumes: `DetectedEmbed`, `detectEmbed`, `extractEmbeds`, `MAX_POST_EMBEDS` from `@/lib/embeds` (Task 1)
- Consumes: `useLanguage()` → `{ t }` (`t(key: DictionaryKey): string`, 기존 `LanguageProvider` 그대로 사용)
- Produces: `EmbedFrame({ provider, embedUrl }: DetectedEmbed): JSX.Element`, `PostBody({ displayText, rawBody }: { displayText: string; rawBody: string }): JSX.Element` — Task 3는 이 둘을 직접 건드리지 않음(끝 UI 검증만 수행)

- [ ] **Step 1: `dictionaries.ts`에 새 i18n 키 2개 추가**

11개 로케일 블록(`ko`, `en`, `vi`, `th`, `id`, `tl`, `lo`, `my`, `mn`, `ru`, `km`) 각각에, 그 블록의 `"news.sourceLabel": "..."` 줄 바로 다음에 아래 두 줄을 추가한다(키 이름은 전 로케일 동일, 값만 번역):

```
"embed.youtubeTitle": "<번역>",
"embed.tiktokTitle": "<번역>",
```

1차 번역안(AI 초안, 원어민 검수는 구현을 막는 조건 아님):

| locale | embed.youtubeTitle | embed.tiktokTitle |
|---|---|---|
| ko | YouTube 영상 | TikTok 영상 |
| en | YouTube video | TikTok video |
| vi | Video YouTube | Video TikTok |
| th | วิดีโอ YouTube | วิดีโอ TikTok |
| id | Video YouTube | Video TikTok |
| tl | Video ng YouTube | Video ng TikTok |
| lo | ວິດີໂອ YouTube | ວິດີໂອ TikTok |
| my | YouTube ဗီဒီယို | TikTok ဗီဒီယို |
| mn | YouTube бичлэг | TikTok бичлэг |
| ru | Видео YouTube | Видео TikTok |
| km | វីដេអូ YouTube | វីដេអូ TikTok |

- [ ] **Step 2: Create `src/components/board/EmbedFrame.tsx`**

```tsx
"use client";

import type { DetectedEmbed } from "@/lib/embeds";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

const ASPECT_CLASS: Record<DetectedEmbed["provider"], string> = {
  youtube: "aspect-[16/9] w-full",
  tiktok: "aspect-[9/16] w-full max-w-[325px]",
};

export function EmbedFrame({ provider, embedUrl }: DetectedEmbed) {
  const { t } = useLanguage();
  const title = provider === "youtube" ? t("embed.youtubeTitle") : t("embed.tiktokTitle");

  return (
    <div
      className={`overflow-hidden rounded-lg border border-[var(--color-border-gray-light)] ${ASPECT_CLASS[provider]}`}
    >
      <iframe
        src={embedUrl}
        title={title}
        className="h-full w-full"
        sandbox="allow-scripts allow-same-origin allow-popups allow-presentation"
        allow="encrypted-media; picture-in-picture; fullscreen"
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </div>
  );
}
```

(`sandbox`에 `allow-same-origin`을 같이 주는 이유: `embedUrl`은 항상 이 파일 안에서 고정 호스트 템플릿으로만 조립되므로 — 사용자 입력이 `src`에 직접 들어가는 경로가 없으므로 — 프레임 출처가 우리 사이트와 같아질 수 없어 "프레임이 자기 sandbox를 해제하고 부모를 공격" 시나리오가 성립하지 않는다. 대신 유튜브/틱톡 플레이어가 자체 쿠키로 정상 동작하려면 필요하다.)

- [ ] **Step 3: Create `src/components/board/PostBody.tsx`**

```tsx
import { extractEmbeds } from "@/lib/embeds";
import { EmbedFrame } from "./EmbedFrame";

export function PostBody({ displayText, rawBody }: { displayText: string; rawBody: string }) {
  const embeds = extractEmbeds(rawBody);

  return (
    <>
      <div className="min-h-32 whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
        {displayText}
      </div>
      {embeds.length > 0 && (
        <div className="mt-3 flex flex-col gap-3">
          {embeds.map((embed) => (
            <EmbedFrame key={embed.embedUrl} provider={embed.provider} embedUrl={embed.embedUrl} />
          ))}
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 4: `[postId]/page.tsx`에 연결**

파일 상단 import에 `import { PostBody } from "@/components/board/PostBody";` 추가.

`226-230`번 줄의 기존 블록

```tsx
      ) : (
        <div className="min-h-32 whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
          {showTranslated && translated ? translated.body : post.body}
        </div>
      )}
```

을 아래로 교체(뉴스 분기인 `182-225`번 줄은 변경하지 않음):

```tsx
      ) : (
        <PostBody
          displayText={showTranslated && translated ? translated.body : post.body}
          rawBody={post.body}
        />
      )}
```

- [ ] **Step 5: 타입체크 & 린트로 검증**

Run: `npx tsc --noEmit`
Expected: 에러 없음(특히 `dictionaries.ts`의 모든 로케일 객체가 `Record<DictionaryKey, string>`을 만족 — 11개 블록 중 하나라도 새 키가 빠지면 여기서 타입 에러로 드러남)

Run: `npm run lint`
Expected: 에러 없음

- [ ] **Step 6: Commit**

```bash
git add src/components/board/EmbedFrame.tsx src/components/board/PostBody.tsx \
  "src/app/board/[category]/[postId]/page.tsx" src/lib/i18n/dictionaries.ts
git commit -m "feat(embed): render youtube/tiktok embeds in post detail"
```

---

### Task 3: CSP `frame-src` 헤더 + 엔드투엔드 수동 검증

**Files:**
- Modify: `next.config.ts`

**Interfaces:**
- Consumes: Task 1/2에서 완성된 전체 기능(블랙박스로 취급, 코드 변경 없음)

- [ ] **Step 1: `next.config.ts`에 CSP 헤더 추가**

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.0.4"],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "frame-src 'self' https://www.youtube-nocookie.com https://www.tiktok.com;",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
```

- [ ] **Step 2: 개발 서버 기동**

Run: `npm run dev` (이미 떠 있으면 재사용)

- [ ] **Step 3: 헤더가 실제로 나가는지 확인**

Run: `curl -sI http://localhost:3000/ | grep -i content-security-policy`
Expected: `content-security-policy: frame-src 'self' https://www.youtube-nocookie.com https://www.tiktok.com;` 포함

- [ ] **Step 4: 브라우저로 기능 수동 검증 (이 레포에 컴포넌트 테스트 하네스가 없어 기존 관례대로 브라우저 확인으로 대체)**

뉴스가 아닌 카테고리(예: community/free)에 아래 내용을 포함한 글을 작성(또는 기존 글 수정)해서 확인:
- 본문에 유튜브 워치 링크(`https://www.youtube.com/watch?v=...`) 한 줄, 틱톡 워치 링크(`https://www.tiktok.com/@.../video/...`) 한 줄, 지원 안 되는 링크(예: 페이스북) 한 줄을 각각 다른 문장과 섞어 넣는다.
- 상세화면에서: 유튜브·틱톡 두 개는 재생 가능한 박스로 뜨고, 페이스북 링크는 지금처럼 텍스트 그대로만 보이는지 확인.
- (번역 버튼이 있는 글이면) "번역 보기"를 켰다 꺼도 임베드 박스가 사라지지 않는지 확인.
- 지원 링크를 4개 이상 넣은 글을 하나 더 만들어, 처음 3개만 임베드되고 나머지는 텍스트로 남는지 확인.
- 뉴스 카테고리 글 상세화면은 이번 변경 전과 동일하게(임베드 없이) 보이는지 확인.

- [ ] **Step 5: Commit**

```bash
git add next.config.ts
git commit -m "feat(embed): add CSP frame-src header for embed hosts"
```
