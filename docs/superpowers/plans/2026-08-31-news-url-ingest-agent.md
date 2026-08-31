# News URL Ingest Agent (v1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an operator paste a news-article URL in chat and, after reviewing a Claude-drafted excerpt + Korean summary + stock image, publish it to the news category via a local service-role script.

**Architecture:** No new app endpoint. A committed Node script (`news-digest/publish-news.mjs`) takes a JSON draft and writes one `posts` row + uploads the image to a public `news` Storage bucket using the service-role key. The app side only threads a new `image_credit` column through the `Post` type and renders the image on the news detail page. The chat procedure lives in `CLAUDE.md`.

**Tech Stack:** Node 20 (`--env-file`, `node --test`), `@supabase/supabase-js` v2, Next.js 16 (App Router), TypeScript, Supabase Postgres + Storage. No TS test runner in repo.

**Spec:** `docs/superpowers/specs/2026-08-31-news-url-ingest-agent-design.md`

## Global Constraints

Every task's requirements implicitly include this section.

- **Fixed news row shape:** `category: "news"`, `sub_category: null`, `country: "etc"`, `points_awarded: 0`. `author_id` = `process.env.NEWS_AUTHOR_ID` in the script (the operator admin's `profiles.id`). Never call `adjust_points` / `get_my_points`.
- **`originalBody` length cap: 700 characters** (trimmed). Enforced in BOTH `src/lib/news/newsInput.ts` (the `/admin/news` form path) and `news-digest/publish-news.mjs` (the ingest path). The `newsInput.ts` check returns the existing `"originalBody"` error code — no new `NewsInputError` member.
- **Copyright rules (operator-facing, enforced by CLAUDE.md procedure):** original excerpt is 2–4 sentences, source language, ≤700 chars, never the full article. Korean summary is 4–8 sentences rewritten in own words, never a paste of the source or another outlet. `source_url` + `source_name` always present. Images: Pexels (free licence), no photo whose main subject is a person / identifiable individual / brand logo, `image_credit` shown. No AI-generated images or video.
- **Storage:** public bucket `news`. Uploads use the service-role key (bypasses RLS). Follow `supabase/migrations/0002_avatar_storage.sql` — a public bucket needs no `storage.objects` policy.
- **Migrations are applied by hand** in the Supabase SQL Editor (no CLI linked). A committed `.sql` file is not "applied".
- **No new UI strings.** `image_credit` is stored text rendered as-is (a proper-noun-ish credit line), not a translated label — `src/lib/i18n/dictionaries.ts` is NOT touched.
- **Verification per task:** `npx tsc --noEmit` (exit 0) and `npm run lint` (no NEW problem — the repo already exits 1 on 6 pre-existing problems in untouched files) are mandatory for tasks that change `.ts`/`.tsx`. `npm test` (`node --test "news-digest/**/*.test.mjs"`) must stay green. Browser checks run against the local dev server (`gupgup-dev`, http://localhost:3000). Do not add a TS test runner.
- **Script invocation:** `node --env-file=.env.local news-digest/publish-news.mjs <draft.json> [--dry-run] [--force]`.
- **Translation boundary (unchanged):** the news detail translate toggle sends only `[post.title, post.body]`. The image, credit, and original excerpt are never translated.

---

### Task 1: Migration `0013` — news image bucket + `image_credit` column

**Files:**
- Create: `supabase/migrations/0013_news_image.sql`

**Interfaces:**
- Consumes: nothing.
- Produces: a public Storage bucket `news`; a nullable `posts.image_credit text` column. Tasks 2–4 read/write these.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0013_news_image.sql` with exactly:

```sql
-- Public bucket for news-article images (stock photos).
-- Uploads go through news-digest/publish-news.mjs with the service-role key,
-- which bypasses RLS; a public bucket serves reads with no storage.objects
-- policy (same as 0002_avatar_storage.sql).

insert into storage.buckets (id, name, public)
values ('news', 'news', true)
on conflict (id) do nothing;

alter table posts add column image_credit text;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/0013_news_image.sql
git commit -m "feat(news): news image Storage bucket + image_credit column (migration 0013)"
```

- [ ] **Step 3: HUMAN STEP — apply the migration**

The executor cannot run Supabase SQL. Hand back to the human:

> Supabase → **SQL Editor** → **New query** → paste the contents of `supabase/migrations/0013_news_image.sql` → **Run**. Then verify:
> ```sql
> select image_credit from posts limit 1;
> ```
> Expected: succeeds (0 rows or 1 null row), no "column does not exist".
> Then Supabase → **Storage** → confirm a bucket named **news** exists and is marked **Public**.

Do not start Task 2 until the human confirms both checks passed.

---

### Task 2: Thread `image_credit` + the `originalBody` cap through the data layer

**Files:**
- Modify: `src/lib/news/newsInput.ts`
- Modify: `src/lib/types.ts` (the `Post` interface, near `imageCredit` insertion point — after `sourceUrl?`)
- Modify: `src/lib/supabase/posts.ts` (`PostRow`, `POST_SELECT`, `mapPost`)
- Modify: `src/app/api/admin/news/route.ts`

**Interfaces:**
- Consumes: the `posts.image_credit` column (Task 1).
- Produces:
  - `NewsArticleInput` gains `imageCredit?: string`. `validateNewsArticleInput` now also returns `"originalBody"` when the trimmed `originalBody` exceeds 700 chars.
  - `Post` gains `imageCredit?: string`.
  - `POST_SELECT` includes `image_credit`; `mapPost` maps it to `imageCredit`.
  - `POST /api/admin/news` accepts an optional `imageCredit` string and stores it.

- [ ] **Step 1: Extend `newsInput.ts`**

In `src/lib/news/newsInput.ts`, change the `NewsArticleInput` interface to add one field (after `body`):

```ts
export interface NewsArticleInput {
  title: string;
  sourceName: string;
  sourceUrl: string;
  originalBody: string;
  originalLang: string;
  body: string; // Korean summary
  imageCredit?: string; // stock photo attribution, e.g. "Photo: Jane Doe (Pexels)"
}
```

In the same file, in `validateNewsArticleInput`, add the length check immediately after the existing `originalBody` blank check:

```ts
  if (!input.originalBody?.trim()) return "originalBody";
  if (input.originalBody.trim().length > 700) return "originalBody";
```

- [ ] **Step 2: Extend `Post` type**

In `src/lib/types.ts`, inside `interface Post`, add `imageCredit` right after `sourceUrl?: string;`:

```ts
  sourceName?: string;
  sourceUrl?: string;
  imageCredit?: string;
```

- [ ] **Step 3: Thread through `posts.ts`**

In `src/lib/supabase/posts.ts`:

`PostRow` — add after `source_url: string | null;`:

```ts
  source_url: string | null;
  image_credit: string | null;
```

`POST_SELECT` — add `image_credit` after `source_url`:

```ts
const POST_SELECT =
  "id, category, sub_category, country, title, body, author_id, thumbnail_url, original_body, original_lang, source_name, source_url, image_credit, view_count, created_at, points_awarded, author:profiles(id, nickname, country, avatar_url, is_withdrawn), comments(count)";
```

`mapPost` — add after `sourceUrl: row.source_url ?? undefined,`:

```ts
    sourceUrl: row.source_url ?? undefined,
    imageCredit: row.image_credit ?? undefined,
```

- [ ] **Step 4: Pass `imageCredit` in the admin route**

In `src/app/api/admin/news/route.ts`, in the `supabase.from("posts").insert({ ... })` object, add one line after `source_url: input.sourceUrl!.trim(),`:

```ts
      source_url: input.sourceUrl!.trim(),
      image_credit: input.imageCredit?.trim() || null,
```

`input` is already typed `Partial<NewsArticleInput>`, which now has `imageCredit?` — no other change needed.

- [ ] **Step 5: Typecheck and lint**

Run: `npx tsc --noEmit`
Expected: exit 0.

Run: `npm run lint`
Expected: no NEW problem naming `newsInput.ts`, `types.ts`, `posts.ts`, or `api/admin/news/route.ts`.

- [ ] **Step 6: Browser check — boards still load, route accepts imageCredit**

Dev server `gupgup-dev` running. Reload http://localhost:3000/board/community and http://localhost:3000/board/news — both render their normal lists (proves the widened `POST_SELECT` works against the migrated DB).

On a tab logged in as the admin account, in the console / Browser pane `javascript_tool`:

```js
const base = { title: "t", sourceName: "s", sourceUrl: "https://example.com", originalBody: "o", originalLang: "th", body: "b" };
const call = (b) =>
  fetch("/api/admin/news", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) })
    .then((r) => r.json().then((j) => ({ status: r.status, body: j })));

await call({ ...base, imageCredit: "Photo: A (Pexels)" });      // Expected: { status: 200, body: { ok: true, id } }
await call({ ...base, originalBody: "x".repeat(701) });          // Expected: { status: 400, body: { error: "invalid: originalBody" } }
```

Delete the row created by the 200 call: `await fetch('/api/admin/posts/'+THAT_ID, {method:'DELETE'})` — confirm `/board/news` shows the empty state again.

- [ ] **Step 7: Commit**

```bash
git add src/lib/news/newsInput.ts src/lib/types.ts src/lib/supabase/posts.ts src/app/api/admin/news/route.ts
git commit -m "feat(news): carry image_credit and enforce a 700-char excerpt cap"
```

---

### Task 3: Render the image + credit on the news detail page

**Files:**
- Modify: `src/app/board/[category]/[postId]/page.tsx` (the news branch — the block that starts `{config.slug === "news" && post.originalBody ? (`)

**Interfaces:**
- Consumes: `Post.thumbnailUrl` (existing), `Post.imageCredit` (Task 2).
- Produces: nothing other tasks consume.

- [ ] **Step 1: Add the figure block above the `원문` label**

In `src/app/board/[category]/[postId]/page.tsx`, inside the news branch, the current start is:

```tsx
      {config.slug === "news" && post.originalBody ? (
        <div className="text-sm leading-relaxed text-gray-700">
          <p className="mb-1 text-xs font-semibold text-[var(--color-text-muted)]">
            {t("news.originalLabel")}
          </p>
```

Insert the figure between the opening `<div ...>` and the `원문` `<p>`:

```tsx
      {config.slug === "news" && post.originalBody ? (
        <div className="text-sm leading-relaxed text-gray-700">
          {post.thumbnailUrl && (
            <figure className="mb-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={post.thumbnailUrl}
                alt=""
                className="w-full rounded-lg object-cover"
              />
              {post.imageCredit && (
                <figcaption className="mt-1 text-[11px] text-[var(--color-text-muted)]">
                  {post.imageCredit}
                </figcaption>
              )}
            </figure>
          )}
          <p className="mb-1 text-xs font-semibold text-[var(--color-text-muted)]">
            {t("news.originalLabel")}
          </p>
```

Change nothing else in the branch. The `else` (non-news) branch is untouched.

- [ ] **Step 2: Typecheck and lint**

Run: `npx tsc --noEmit` → exit 0.
Run: `npm run lint` → no NEW problem naming `[postId]/page.tsx`. (The `no-img-element` disable comment is the same pattern already used in `src/components/board/PostListItem.tsx`.)

- [ ] **Step 3: Browser check**

Give the existing test news post an image, via the console on the admin tab (replace `<NEWS_ID>` with a real news post id from `/board/news`; if none exists, create one via `/admin/news` first):

```js
// use the admin posts move/patch? simplest: set via a fresh service-role-less update is blocked by RLS.
// Instead: recreate the post through /admin/news is the clean path. For a quick check, add thumbnail via SQL in Supabase:
//   update posts set thumbnail_url = 'https://images.pexels.com/photos/210600/pexels-photo-210600.jpeg',
//                     image_credit = 'Photo: Pixabay (Pexels)'
//   where id = '<NEWS_ID>';
```

Then open `http://localhost:3000/board/news/<NEWS_ID>`:
- Image appears **above** the "원문" label, full width, rounded.
- Credit line "Photo: Pixabay (Pexels)" directly under the image, small and muted.
- Then "원문" → excerpt → "출처: …" → divider → "한국어 요약".
- Click **번역 보기**: title + summary translate; the image, credit, and Thai original are unchanged.
- Open a news post with `thumbnail_url` null (or the community post): no image block, layout exactly as before.

- [ ] **Step 4: Commit**

```bash
git add "src/app/board/[category]/[postId]/page.tsx"
git commit -m "feat(news): show the article image and credit above the original excerpt"
```

---

### Task 4: `publish-news.mjs` + tests

**Files:**
- Create: `news-digest/publish-news.mjs`
- Create: `news-digest/publish-news.test.mjs`

**Interfaces:**
- Consumes: env `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEWS_AUTHOR_ID`; the `news` bucket + `posts` table + `image_credit` column (Task 1/2).
- Produces (named exports the test imports):
  - `parseArgs(argv: string[]) => { file: string | undefined, dryRun: boolean, force: boolean }`
  - `validateDraft(d: unknown) => string | null` (null = valid; otherwise a short reason)
  - `buildInsertPayload(d: object, authorId: string, thumbnailUrl: string | null) => object` (the `posts` insert row)

- [ ] **Step 1: Write the failing test**

Create `news-digest/publish-news.test.mjs` with exactly:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseArgs, validateDraft, buildInsertPayload } from "./publish-news.mjs";

const VALID = {
  title: "헤드라인",
  sourceName: "Khaosod",
  sourceUrl: "https://www.khaosod.co.th/x",
  originalLang: "th",
  originalBody: "짧은 발췌 문장.",
  body: "한국어 요약 문장.",
};

test("parseArgs: file plus flags in any order", () => {
  assert.deepEqual(parseArgs(["node", "s", "d.json"]), {
    file: "d.json",
    dryRun: false,
    force: false,
  });
  assert.deepEqual(parseArgs(["node", "s", "--dry-run", "d.json", "--force"]), {
    file: "d.json",
    dryRun: true,
    force: true,
  });
  assert.deepEqual(parseArgs(["node", "s", "--dry-run"]), {
    file: undefined,
    dryRun: true,
    force: false,
  });
});

test("validateDraft: a complete draft is valid", () => {
  assert.equal(validateDraft(VALID), null);
});

test("validateDraft: missing or blank required field", () => {
  assert.equal(validateDraft({ ...VALID, body: "" }), "missing: body");
  assert.equal(validateDraft({ ...VALID, title: "   " }), "missing: title");
  assert.equal(validateDraft(null), "draft must be an object");
});

test("validateDraft: sourceUrl must be http(s)", () => {
  assert.equal(validateDraft({ ...VALID, sourceUrl: "ftp://x" }), "invalid: sourceUrl");
  assert.equal(validateDraft({ ...VALID, sourceUrl: "not a url" }), "invalid: sourceUrl");
});

test("validateDraft: originalBody capped at 700 chars", () => {
  assert.equal(validateDraft({ ...VALID, originalBody: "a".repeat(700) }), null);
  assert.equal(
    validateDraft({ ...VALID, originalBody: "a".repeat(701) }),
    "invalid: originalBody too long",
  );
});

test("validateDraft: imageUrl requires imageCredit", () => {
  assert.equal(
    validateDraft({ ...VALID, imageUrl: "https://img/x.jpg" }),
    "missing: imageCredit (required with imageUrl)",
  );
  assert.equal(
    validateDraft({ ...VALID, imageUrl: "https://img/x.jpg", imageCredit: "Photo: A (Pexels)" }),
    null,
  );
});

test("buildInsertPayload: fixed news fields, no points, author from arg", () => {
  const p = buildInsertPayload(VALID, "author-uuid", null);
  assert.equal(p.category, "news");
  assert.equal(p.sub_category, null);
  assert.equal(p.country, "etc");
  assert.equal(p.points_awarded, 0);
  assert.equal(p.author_id, "author-uuid");
  assert.equal(p.original_lang, "th");
  assert.equal(p.thumbnail_url, null);
  assert.equal(p.image_credit, null);
  assert.ok(!("rpc" in p));
});

test("buildInsertPayload: image_credit set only when imageUrl present", () => {
  const withImg = { ...VALID, imageUrl: "https://img/x.jpg", imageCredit: "Photo: A (Pexels)" };
  assert.equal(
    buildInsertPayload(withImg, "a", "https://pub/x.jpg").image_credit,
    "Photo: A (Pexels)",
  );
  assert.equal(buildInsertPayload(VALID, "a", "https://pub/x.jpg").image_credit, null);
});

test("buildInsertPayload: originalLang defaults to th when absent", () => {
  const { originalLang, ...noLang } = VALID;
  void originalLang;
  assert.equal(buildInsertPayload(noLang, "a", null).original_lang, "th");
});
```

- [ ] **Step 2: Run the test — verify it fails**

Run: `node --test news-digest/publish-news.test.mjs`
Expected: FAIL — `Cannot find module './publish-news.mjs'` (or "does not provide an export").

- [ ] **Step 3: Write `publish-news.mjs`**

Create `news-digest/publish-news.mjs` with exactly:

```js
// Publishes one news post to Supabase from a JSON draft.
// Usage:
//   node --env-file=.env.local news-digest/publish-news.mjs <draft.json> [--dry-run] [--force]
//
// draft.json:
//   { title, sourceName, sourceUrl, originalLang?, originalBody, body, imageUrl?, imageCredit? }
//   - originalBody: source-language excerpt, 2-4 sentences, <= 700 chars
//   - body: Korean summary, rewritten in own words
//   - imageUrl + imageCredit: optional; if imageUrl is set, imageCredit is required

import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";

const MAX_ORIGINAL_BODY = 700;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const REQUIRED = ["title", "sourceName", "sourceUrl", "originalBody", "body"];

export function parseArgs(argv) {
  const rest = argv.slice(2);
  return {
    file: rest.find((a) => !a.startsWith("--")),
    dryRun: rest.includes("--dry-run"),
    force: rest.includes("--force"),
  };
}

export function validateDraft(d) {
  if (!d || typeof d !== "object") return "draft must be an object";
  for (const k of REQUIRED) {
    if (typeof d[k] !== "string" || !d[k].trim()) return `missing: ${k}`;
  }
  let url;
  try {
    url = new URL(d.sourceUrl.trim());
  } catch {
    return "invalid: sourceUrl";
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return "invalid: sourceUrl";
  if (d.originalBody.trim().length > MAX_ORIGINAL_BODY) return "invalid: originalBody too long";
  if (d.imageUrl != null && (typeof d.imageUrl !== "string" || !d.imageUrl.trim())) {
    return "invalid: imageUrl";
  }
  if (d.imageUrl && !String(d.imageCredit ?? "").trim()) {
    return "missing: imageCredit (required with imageUrl)";
  }
  return null;
}

export function buildInsertPayload(d, authorId, thumbnailUrl) {
  return {
    category: "news",
    sub_category: null,
    country: "etc",
    author_id: authorId,
    points_awarded: 0,
    title: d.title.trim(),
    body: d.body.trim(),
    original_body: d.originalBody.trim(),
    original_lang: (d.originalLang || "th").trim(),
    source_name: d.sourceName.trim(),
    source_url: d.sourceUrl.trim(),
    thumbnail_url: thumbnailUrl ?? null,
    image_credit: d.imageUrl ? String(d.imageCredit).trim() : null,
  };
}

function extFor(contentType) {
  if (contentType.includes("png")) return "png";
  if (contentType.includes("webp")) return "webp";
  if (contentType.includes("gif")) return "gif";
  return "jpg";
}

async function uploadImage(supabase, imageUrl) {
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`image fetch failed: ${res.status}`);
  const contentType = res.headers.get("content-type") || "";
  if (!contentType.startsWith("image/")) throw new Error(`not an image: ${contentType}`);
  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.byteLength > MAX_IMAGE_BYTES) throw new Error("image too large (>5MB)");
  const name = `${randomUUID()}.${extFor(contentType)}`;
  const { error } = await supabase.storage
    .from("news")
    .upload(name, bytes, { contentType });
  if (error) throw error;
  return supabase.storage.from("news").getPublicUrl(name).data.publicUrl;
}

async function main() {
  const { file, dryRun, force } = parseArgs(process.argv);
  if (!file) {
    console.error(
      "usage: node --env-file=.env.local news-digest/publish-news.mjs <draft.json> [--dry-run] [--force]",
    );
    process.exit(1);
  }

  let draft;
  try {
    draft = JSON.parse(readFileSync(file, "utf8"));
  } catch (err) {
    console.error(`cannot read draft: ${err.message}`);
    process.exit(1);
  }

  const reason = validateDraft(draft);
  if (reason) {
    console.error(`invalid draft: ${reason}`);
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const authorId = process.env.NEWS_AUTHOR_ID;
  if (!url || !key || !authorId) {
    console.error(
      "missing env: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / NEWS_AUTHOR_ID",
    );
    process.exit(1);
  }

  if (dryRun) {
    console.log(
      JSON.stringify(
        buildInsertPayload(draft, authorId, draft.imageUrl ? "<uploaded-on-publish>" : null),
        null,
        2,
      ),
    );
    return;
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const { data: dupe } = await supabase
    .from("posts")
    .select("id")
    .eq("category", "news")
    .eq("source_url", draft.sourceUrl.trim())
    .maybeSingle();
  if (dupe && !force) {
    console.error(
      `already published: /board/news/${dupe.id}  (use --force to publish again)`,
    );
    process.exit(1);
  }

  let thumbnailUrl = null;
  if (draft.imageUrl) {
    thumbnailUrl = await uploadImage(supabase, draft.imageUrl);
  }

  const { data, error } = await supabase
    .from("posts")
    .insert(buildInsertPayload(draft, authorId, thumbnailUrl))
    .select("id")
    .single();
  if (error) {
    console.error(`insert failed: ${error.message}`);
    process.exit(1);
  }

  console.log(JSON.stringify({ id: data.id, url: `/board/news/${data.id}` }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
```

- [ ] **Step 4: Run the test — verify it passes**

Run: `node --test news-digest/publish-news.test.mjs`
Expected: PASS (all tests).

Run: `npm test`
Expected: the whole `news-digest/**/*.test.mjs` suite still passes (previously 23 tests + the new ones).

- [ ] **Step 5: Lint**

Run: `npm run lint`
Expected: no NEW problem naming `news-digest/publish-news.mjs` or the test. (ESLint config covers `.mjs` in `news-digest/` — match the style of `news-digest/fetch.mjs`.)

- [ ] **Step 6: Dry-run smoke (no network)**

Create `/tmp/draft.json`:

```json
{
  "title": "테스트 헤드라인",
  "sourceName": "Example",
  "sourceUrl": "https://example.com/article",
  "originalLang": "en",
  "originalBody": "A short two-sentence excerpt. Second sentence here.",
  "body": "한국어 요약. 두 번째 문장."
}
```

Run: `NEXT_PUBLIC_SUPABASE_URL=x SUPABASE_SERVICE_ROLE_KEY=x NEWS_AUTHOR_ID=x node news-digest/publish-news.mjs /tmp/draft.json --dry-run`
Expected: prints a JSON object with `"category": "news"`, `"country": "etc"`, `"points_awarded": 0`, `"author_id": "x"`, `"thumbnail_url": null`, `"image_credit": null`. No network call, exit 0.

- [ ] **Step 7: Commit**

```bash
git add news-digest/publish-news.mjs news-digest/publish-news.test.mjs
git commit -m "feat(news): publish-news.mjs — service-role news post publisher"
```

---

### Task 5: CLAUDE.md procedure + `.env.local.example`

**Files:**
- Modify: `CLAUDE.md` (append a new section after "## K-컬처 & 라이프 주간 다이제스트 요청")
- Modify: `.env.local.example`

**Interfaces:**
- Consumes: the whole feature (script + app render).
- Produces: nothing code depends on.

- [ ] **Step 1: Add the `.env.local.example` entries**

In `.env.local.example`, after the `TRANSLATE_API_KEY=` line, add:

```
# Optional: news URL ingest agent (news-digest/publish-news.mjs)
NEWS_AUTHOR_ID=
PEXELS_API_KEY=
```

- [ ] **Step 2: Add the CLAUDE.md section**

Append to `CLAUDE.md`, after the K-컬처 section:

```markdown
## 뉴스 URL 가져오기 요청 (운영 지침 — Claude용)

사용자가 뉴스 기사 URL을 주면서 "이 기사 뉴스에 올려줘" 류로 요청하면 아래 절차를 수행할 것.
(배경: `news-digest/publish-news.mjs` 가 서비스 롤로 `posts`에 뉴스 글 1개를 쓰고 이미지를
`news` Storage 버킷에 올린다. `.env.local` 에 `NEWS_AUTHOR_ID`(운영 admin의 profiles.id),
`PEXELS_API_KEY` 필요. 마이그레이션 `0013` 적용 필요.)

1. 본문 추출: `curl -s "https://r.jina.ai/<URL>"`. 실패하면 다른 경로 시도. 페이월/로그인
   필요/JS 전용/비(非)기사(홈·섹션·태그 목록)면 "이 URL은 가져올 수 없습니다" 보고 후 중단.
2. 초안 작성:
   - **헤드라인**: 한국어, 사실 위주 한 줄
   - **원문 발췌(`originalBody`)**: 기사 도입부 **2~4문장**만, 원문 언어 그대로, **700자 이내**.
     전문·대량 인용 금지.
   - **한국어 요약(`body`)**: **4~8문장**, 자기 표현으로 재작성. 원문·타 매체 문장을 그대로
     옮기지 말고 사실관계만 정리. 불확실·미확인·광고성 내용 제외.
   - **출처**: 매체명(`sourceName`, 도메인/사이트명에서 추정) + 원문 URL(`sourceUrl`)
   - **원문 언어(`originalLang`)**: 추정 (`th`, `en`, `ja` …). 기본 `th`.
   - **이미지 후보**: `curl -s -H "Authorization: $PEXELS_API_KEY" "https://api.pexels.com/v1/search?query=<주제 키워드>&per_page=8&orientation=landscape"`
     로 검색. **사람·특정 인물·브랜드 로고가 주 피사체인 것은 후보에서 제외.** 3~5장의
     `src.large` URL + 사진작가명(`photographer`)을 채팅에 제시.
3. 초안 + 이미지 후보를 채팅에 표시하고 **승인 대기**. 임의 게시 금지. 사용자가 문구 수정
   지시 / 이미지 번호 선택 / "이미지 없이" 를 고를 수 있음.
4. 승인되면 draft JSON을 스크래치패드에 쓴다:
   `{ title, sourceName, sourceUrl, originalLang, originalBody, body, imageUrl?, imageCredit? }`
   - 이미지 선택 시 `imageUrl` = 그 Pexels `src.large`, `imageCredit` = `"Photo: <photographer> (Pexels)"`
   그리고 실행: `node --env-file=.env.local news-digest/publish-news.mjs <draft.json>`
   (먼저 `--dry-run` 으로 payload 확인 권장)
5. 출력된 게시글 id와 `/board/news/<id>` URL을 사용자에게 보고.

저작권 규칙(고정):
- 원문 전문/대량 인용 금지 — 발췌(2~4문장, 700자)만.
- 한국어 요약은 사실관계 재작성. 원문·타 매체 문장 복붙 금지.
- 출처(매체명 + URL) 필수.
- 이미지는 Pexels(무료 라이선스). 사람 이미지 금지. `image_credit` 표시.
- AI 생성 이미지·영상 사용 안 함.
```

- [ ] **Step 3: Verify**

Run: `git diff --stat` — expect only `CLAUDE.md` and `.env.local.example` changed.
Read the two diffs once: the CLAUDE.md section is well-formed markdown; `.env.local.example` lines are `KEY=` with no value (secrets are not committed).
Run: `npm run lint` and `npx tsc --noEmit` — expect no change from before (docs only). Run: `npm test` — still green.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md .env.local.example
git commit -m "docs(news): URL ingest procedure + NEWS_AUTHOR_ID / PEXELS_API_KEY"
```

---

### Task 6: First real ingest + end-to-end verification (no code)

Run in the main session (agent-reach + Browser tools). No commits.

**Files:** none.

- [ ] **Step 1: HUMAN — env + migration**

- Confirm migration `0013` is applied (Task 1 Step 3).
- Register a free Pexels API key at https://www.pexels.com/api/ → add to `.env.local` as `PEXELS_API_KEY=...`.
- Get the operator admin's `profiles.id`: Supabase → SQL Editor → `select id, nickname from profiles where is_admin = true;` → add to `.env.local` as `NEWS_AUTHOR_ID=<uuid>`.

- [ ] **Step 2: Run the chat workflow on a real URL**

Pick a real news article URL (operator supplies one, or use a Khaosod / Yonhap / etc. article). Follow the CLAUDE.md procedure: fetch via `r.jina.ai`, draft headline + 2–4 sentence excerpt + 4–8 sentence Korean summary + source, search Pexels for 3–5 non-person candidates, present all of it, wait for approval.

- [ ] **Step 3: Publish**

On approval, write the draft JSON to the scratchpad, run `node --env-file=.env.local news-digest/publish-news.mjs <draft.json> --dry-run` (sanity), then without `--dry-run`. Capture the printed `{ id, url }`.

- [ ] **Step 4: Joint verification**

On the running site (or the deployed one):
- `/board/news` list: the new post, with its thumbnail on the right.
- `/board/news/<id>`: image + credit at the top → "원문" → excerpt → "출처: <name>" (links out) → divider → "한국어 요약".
- **번역 보기**: title + Korean summary translate to the current locale; the image, credit, and source-language excerpt do not change.
- Re-run the same publish command → it refuses with "already published" (dedup); `--force` overrides.
- A news post with no image (the earlier test article) still renders correctly — no empty figure.

- [ ] **Step 5: Report**

Summarize what shipped; note that further articles are just: paste a URL in chat → review the draft → approve.

---

## Self-Review

**1. Spec coverage**

| Spec section | Task |
|---|---|
| §1 chat flow (fetch, draft, review, publish) | Task 5 (CLAUDE.md procedure) + Task 6 (exercised) |
| §2 `publish-news.mjs` (validate, dedup, image upload, insert, `--dry-run`/`--force`) | Task 4 |
| §2 script tests | Task 4 Step 1 |
| §2 env vars (`NEWS_AUTHOR_ID`, `PEXELS_API_KEY`) | Task 5 (`.env.local.example`) + Task 6 Step 1 (real values) |
| §3 migration `0013` (news bucket + `image_credit`) | Task 1 |
| §3 `newsInput.ts` 700-char cap + `imageCredit?` | Task 2 Step 1 |
| §3 `types.ts` / `posts.ts` `image_credit` | Task 2 Steps 2–3 |
| §3 `/api/admin/news` passes `imageCredit` | Task 2 Step 4 |
| §3 news detail image + credit above `원문` | Task 3 |
| §3 list/home unchanged | untouched — verified in Task 3 Step 3 and Task 6 Step 4 |
| §4 CLAUDE.md procedure + copyright rules | Task 5 Step 2 |
| §5 URL scope (reject non-article/paywall) | Task 5 procedure step 1 |
| §6 copyright guardrails | Global Constraints + Task 5 |
| §7 verification approach | each task's check steps + Task 6 |

No gaps.

**2. Placeholder scan**

No "TBD"/"TODO"/"handle edge cases"/"similar to Task N". Every code step is a full file or an exact before/after. Task 3 Step 3 leaves the SQL `update` for the human to run (it needs the Supabase SQL editor — the executor cannot set `thumbnail_url` through RLS from the browser); the command itself is spelled out. Task 6 is content/ops by nature (a real URL, a real Pexels search), not a code placeholder — the procedure, constraints, and commands are concrete.

**3. Type / name consistency**

- `parseArgs` / `validateDraft` / `buildInsertPayload` — signatures defined in Task 4's Interfaces block, used with those exact names + shapes in Task 4's test and script. `validateDraft` returns `string | null`; error strings in the test (`"missing: body"`, `"invalid: sourceUrl"`, `"invalid: originalBody too long"`, `"missing: imageCredit (required with imageUrl)"`, `"draft must be an object"`) match the script's returns exactly.
- `buildInsertPayload` output keys (`category, sub_category, country, author_id, points_awarded, title, body, original_body, original_lang, source_name, source_url, thumbnail_url, image_credit`) match the `posts` columns and the `/api/admin/news` insert object from the earlier news feature.
- `NewsArticleInput.imageCredit?` (Task 2 Step 1) is consumed in Task 2 Step 4 (`input.imageCredit?.trim()`). `Post.imageCredit?` (Task 2 Step 2) is consumed in Task 3 Step 1 (`post.imageCredit`). `POST_SELECT` / `PostRow` / `mapPost` all gain the same `image_credit` snake_case name (Task 2 Step 3).
- The 700 cap: same number in `newsInput.ts` (Task 2 Step 1), `publish-news.mjs` `MAX_ORIGINAL_BODY` (Task 4 Step 3), the script test (Task 4 Step 1), and Global Constraints.

Consistent throughout.
