# News Category Admin Articles — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let admins publish operator-authored news posts that carry a foreign-media original excerpt (with source link) plus a Korean summary, translatable except for the original.

**Architecture:** Reuse the existing `posts` table and all its board/comment/home plumbing. Add four nullable article columns populated only when `category='news'`. Admins compose through a new gated page (`/admin/news`) that POSTs to a new service-role route. The news detail page gains a render branch: original block (never translated) → source link → divider → Korean summary (translated by the existing toggle). List rows and the detail byline show a fixed "Gup Gup News" label instead of the posting admin's nickname.

**Tech Stack:** Next.js 16 (App Router, client components), Supabase (Postgres + RLS, service-role admin client), TypeScript, Tailwv4. Translation via existing `/api/translate` (Google Translate v2). No frontend test runner in repo.

**Spec:** `docs/superpowers/specs/2026-08-31-news-category-admin-articles-design.md`

## Global Constraints

Every task's requirements implicitly include this section.

- **10 locales, no exceptions.** Every new UI string must be added to all ten locale objects in `src/lib/i18n/dictionaries.ts` in this order: `ko, en, vi, th, id, tl, lo, my, mn, ru`. `DictionaryKey = keyof typeof ko`, so a key added to `ko` but missing from any other locale is a compile error. Do not translate user-authored post/comment content — only chrome.
- **News row shape (fixed):** `category='news'`, `country='etc'`, `sub_category=null`, `points_awarded=0`, `author_id` = the posting admin's user id. Never call `adjust_points` / `get_my_points` for news.
- **Admin gate:** every admin API route calls `assertAdmin()` from `src/lib/supabase/adminAuth.ts` and returns `403 {"error":"forbidden"}` on failure. Admin pages under `src/app/admin/` are already gated by `src/app/admin/layout.tsx`.
- **Migrations are applied by hand** in the Supabase dashboard SQL Editor — no Supabase CLI is linked. A migration file landing in `supabase/migrations/` is not "applied"; a human must run it.
- **No column-grant migration.** `posts` uses the default whole-table SELECT grant (only `profiles` was narrowed, in `0008`). New `posts` columns are readable by `anon`/`authenticated` automatically.
- **Original text is never translated.** `original_body` and `source_name` must never be sent to `/api/translate`. The news translate payload stays exactly `[post.title, post.body]`.
- **External links:** every link to `source_url` uses `target="_blank" rel="noopener noreferrer nofollow"`.
- **Verification per task:** `npx tsc --noEmit` (no errors) and `npm run lint` (no new errors) are mandatory gates. UI/API tasks add a browser check against the already-running dev server (`gupgup-dev`, http://localhost:3000). There is no jest/vitest/testing-library in this repo and the spec puts adding one out of scope — do not add one.
- **Style:** match the surrounding file. Admin pages are hardcoded Korean (see `src/app/admin/posts/page.tsx`); public components use `t()`.

---

### Task 1: Migration `0011` — news article columns

**Files:**
- Create: `supabase/migrations/0011_news_article_fields.sql`

**Interfaces:**
- Consumes: nothing.
- Produces: four nullable `text` columns on `posts` — `original_body`, `original_lang`, `source_name`, `source_url`. Task 2 reads them.

- [ ] **Step 1: Write the migration file**

Create `supabase/migrations/0011_news_article_fields.sql` with exactly:

```sql
-- News-category article fields. Populated only when category='news';
-- null for every other category. posts uses a whole-table SELECT grant
-- (only profiles was narrowed to column-level in 0008), so these new
-- columns are readable by anon/authenticated with no extra grant.
alter table posts add column original_body text;
alter table posts add column original_lang text;
alter table posts add column source_name  text;
alter table posts add column source_url   text;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/0011_news_article_fields.sql
git commit -m "feat(news): add nullable article columns to posts (migration 0011)"
```

- [ ] **Step 3: HUMAN STEP — apply the migration**

The executor cannot run Supabase SQL. Hand back to the human with this instruction:

> Open the Supabase project → **SQL Editor** → **New query** → paste the four `alter table` lines from `supabase/migrations/0011_news_article_fields.sql` → **Run**. Then run this check in the same editor:
> ```sql
> select original_body, original_lang, source_name, source_url from posts limit 1;
> ```
> Expected: the query succeeds (0 rows or 1 all-null row), no "column does not exist" error.

Do not start Task 2 until the human confirms the check passed.

---

### Task 2: `Post` type + `posts.ts` row mapper

**Files:**
- Modify: `src/lib/types.ts` (the `Post` interface, after `thumbnailUrl?: string;` — line ~60)
- Modify: `src/lib/supabase/posts.ts` (the `PostRow` interface line ~15, the `POST_SELECT` const line ~29, the `mapPost` function line ~52)

**Interfaces:**
- Consumes: the four DB columns from Task 1.
- Produces: `Post.originalBody?`, `Post.originalLang?`, `Post.sourceName?`, `Post.sourceUrl?` (all `string | undefined`). Tasks 4, 6, 7 read these off `Post`.

- [ ] **Step 1: Add the optional fields to `Post`**

In `src/lib/types.ts`, inside `interface Post`, change:

```ts
  thumbnailUrl?: string;
  pointsAwarded: number;
```

to:

```ts
  thumbnailUrl?: string;
  originalBody?: string;
  originalLang?: string;
  sourceName?: string;
  sourceUrl?: string;
  pointsAwarded: number;
```

- [ ] **Step 2: Add the columns to `PostRow`**

In `src/lib/supabase/posts.ts`, inside `interface PostRow`, change:

```ts
  thumbnail_url: string | null;
  view_count: number;
```

to:

```ts
  thumbnail_url: string | null;
  original_body: string | null;
  original_lang: string | null;
  source_name: string | null;
  source_url: string | null;
  view_count: number;
```

- [ ] **Step 3: Add the columns to `POST_SELECT`**

In `src/lib/supabase/posts.ts`, change the `POST_SELECT` string:

```ts
const POST_SELECT =
  "id, category, sub_category, country, title, body, author_id, thumbnail_url, view_count, created_at, points_awarded, author:profiles(id, nickname, country, avatar_url, is_withdrawn), comments(count)";
```

to:

```ts
const POST_SELECT =
  "id, category, sub_category, country, title, body, author_id, thumbnail_url, original_body, original_lang, source_name, source_url, view_count, created_at, points_awarded, author:profiles(id, nickname, country, avatar_url, is_withdrawn), comments(count)";
```

- [ ] **Step 4: Map the fields in `mapPost`**

In `src/lib/supabase/posts.ts`, inside `mapPost`, change:

```ts
    thumbnailUrl: row.thumbnail_url ?? undefined,
    pointsAwarded: row.points_awarded ?? 0,
```

to:

```ts
    thumbnailUrl: row.thumbnail_url ?? undefined,
    originalBody: row.original_body ?? undefined,
    originalLang: row.original_lang ?? undefined,
    sourceName: row.source_name ?? undefined,
    sourceUrl: row.source_url ?? undefined,
    pointsAwarded: row.points_awarded ?? 0,
```

- [ ] **Step 5: Typecheck and lint**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run lint`
Expected: no new errors.

- [ ] **Step 6: Browser check — existing boards still load**

The dev server `gupgup-dev` is already running. Reload http://localhost:3000/board/community and http://localhost:3000/board/news.
Expected: both pages render their normal list UI (community shows its posts, news shows "등록된 게시글이 없습니다."). No console error, no 400 from Supabase. This proves the widened `POST_SELECT` works against the migrated DB.

If either page errors with a Supabase message mentioning `original_body`/`source_url`, the human has not applied Task 1's migration — stop and get that done.

- [ ] **Step 7: Commit**

```bash
git add src/lib/types.ts src/lib/supabase/posts.ts
git commit -m "feat(news): carry article fields through Post type and mapper"
```

---

### Task 3: Admin news API route + shared validator

**Files:**
- Create: `src/lib/news/newsInput.ts`
- Create: `src/app/api/admin/news/route.ts`

**Interfaces:**
- Consumes: `assertAdmin()` → `{ userId: string } | null` from `src/lib/supabase/adminAuth.ts`; `createAdminClient()` from `src/lib/supabase/admin.ts`; the migrated `posts` columns.
- Produces:
  - `src/lib/news/newsInput.ts` exports `interface NewsArticleInput { title: string; sourceName: string; sourceUrl: string; originalBody: string; originalLang: string; body: string }`, `type NewsInputError = "title" | "sourceName" | "sourceUrl" | "originalBody" | "body"`, and `function validateNewsArticleInput(input: Partial<NewsArticleInput>): NewsInputError | null`. Task 4 imports both the type and the function.
  - `POST /api/admin/news` → `200 {"ok":true,"id":string}` on success, `400 {"error":"invalid: <field>"}` on bad input, `403 {"error":"forbidden"}` for non-admins, `500 {"error":string}` on DB error.

- [ ] **Step 1: Write the shared validator**

Create `src/lib/news/newsInput.ts` with exactly:

```ts
export interface NewsArticleInput {
  title: string;
  sourceName: string;
  sourceUrl: string;
  originalBody: string;
  originalLang: string;
  body: string; // Korean summary
}

export type NewsInputError =
  | "title"
  | "sourceName"
  | "sourceUrl"
  | "originalBody"
  | "body";

/**
 * Validates admin news-article input. Returns the first offending field,
 * or null when every required field is acceptable. Shared by the admin
 * form (pre-submit hint) and the API route (authoritative check).
 * `originalLang` is optional and not validated here.
 */
export function validateNewsArticleInput(
  input: Partial<NewsArticleInput>,
): NewsInputError | null {
  if (!input.title?.trim()) return "title";
  if (!input.sourceName?.trim()) return "sourceName";
  if (!isHttpUrl(input.sourceUrl)) return "sourceUrl";
  if (!input.originalBody?.trim()) return "originalBody";
  if (!input.body?.trim()) return "body";
  return null;
}

function isHttpUrl(value: string | undefined): boolean {
  if (!value?.trim()) return false;
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return false;
  }
  return url.protocol === "http:" || url.protocol === "https:";
}
```

- [ ] **Step 2: Write the route**

Create `src/app/api/admin/news/route.ts` with exactly:

```ts
import { NextResponse } from "next/server";
import { assertAdmin } from "@/lib/supabase/adminAuth";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateNewsArticleInput, type NewsArticleInput } from "@/lib/news/newsInput";

export async function POST(request: Request) {
  const admin = await assertAdmin();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const input = (await request.json()) as Partial<NewsArticleInput>;
  const invalid = validateNewsArticleInput(input);
  if (invalid) {
    return NextResponse.json({ error: `invalid: ${invalid}` }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("posts")
    .insert({
      category: "news",
      sub_category: null,
      country: "etc",
      author_id: admin.userId,
      points_awarded: 0,
      title: input.title!.trim(),
      body: input.body!.trim(),
      original_body: input.originalBody!.trim(),
      original_lang: input.originalLang?.trim() || "th",
      source_name: input.sourceName!.trim(),
      source_url: input.sourceUrl!.trim(),
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: data.id });
}
```

- [ ] **Step 3: Typecheck and lint**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run lint`
Expected: no new errors.

- [ ] **Step 4: Browser check — validation + forbidden**

With the dev server running, on a tab logged in as the admin account, use the Browser pane `javascript_tool` (or the devtools console) to run:

```js
const base = { title: "t", sourceName: "s", sourceUrl: "https://example.com", originalBody: "o", originalLang: "th", body: "b" };
const call = (b) =>
  fetch("/api/admin/news", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(b),
  }).then((r) => r.json().then((j) => ({ status: r.status, body: j })));

await call({ ...base, body: "" });           // Expected: { status: 400, body: { error: "invalid: body" } }
await call({ ...base, sourceUrl: "ftp://x" });// Expected: { status: 400, body: { error: "invalid: sourceUrl" } }
await call(base);                             // Expected: { status: 200, body: { ok: true, id: "<uuid>" } }
```

Note the `id` returned by the `200` call for Step 5. (To also confirm the `403` path, the human can repeat one `call(base)` from a tab that is logged out or logged in as a non-admin — Expected `{ status: 403 }`.)

- [ ] **Step 5: Clean up the throwaway row**

Delete the row created by the `200` call so it does not pollute the news board:

```js
await fetch(`/api/admin/posts/${THAT_ID}`, { method: "DELETE" }).then((r) => r.status); // Expected: 200
```

Confirm http://localhost:3000/board/news shows "등록된 게시글이 없습니다." again.

- [ ] **Step 6: Commit**

```bash
git add src/lib/news/newsInput.ts src/app/api/admin/news/route.ts
git commit -m "feat(news): admin POST /api/admin/news with shared input validator"
```

---

### Task 4: Admin news page + nav entry

**Files:**
- Create: `src/app/admin/news/page.tsx`
- Modify: `src/app/admin/layout.tsx` (the `NAV` array, lines ~5-11)

**Interfaces:**
- Consumes: `POST /api/admin/news` (Task 3); `DELETE /api/admin/posts/[id]` (existing); `validateNewsArticleInput` (Task 3); `createClient` from `src/lib/supabase/client.ts`; `ConfirmModal` from `src/components/common/ConfirmModal.tsx`; `formatDate` from `src/lib/utils.ts`.
- Produces: a working `/admin/news` screen. No exports other tasks consume.

- [ ] **Step 1: Add the nav entry**

In `src/app/admin/layout.tsx`, change the `NAV` array:

```ts
const NAV = [
  { href: "/admin", label: "대시보드" },
  { href: "/admin/reports", label: "신고 관리" },
  { href: "/admin/inquiries", label: "문의사항" },
  { href: "/admin/users", label: "회원 관리" },
  { href: "/admin/posts", label: "게시글 관리" },
];
```

to (new entry directly above "게시글 관리"):

```ts
const NAV = [
  { href: "/admin", label: "대시보드" },
  { href: "/admin/reports", label: "신고 관리" },
  { href: "/admin/inquiries", label: "문의사항" },
  { href: "/admin/users", label: "회원 관리" },
  { href: "/admin/news", label: "뉴스 관리" },
  { href: "/admin/posts", label: "게시글 관리" },
];
```

- [ ] **Step 2: Write the page**

Create `src/app/admin/news/page.tsx` with exactly:

```tsx
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ConfirmModal } from "@/components/common/ConfirmModal";
import { formatDate } from "@/lib/utils";
import { validateNewsArticleInput } from "@/lib/news/newsInput";

interface NewsRow {
  id: string;
  title: string;
  source_name: string | null;
  created_at: string;
}

const EMPTY = {
  title: "",
  sourceName: "",
  sourceUrl: "",
  originalLang: "th",
  originalBody: "",
  body: "",
};

export default function AdminNewsPage() {
  const [form, setForm] = useState(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<NewsRow[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  function load() {
    const supabase = createClient();
    supabase
      .from("posts")
      .select("id, title, source_name, created_at")
      .eq("category", "news")
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => setRows((data as NewsRow[]) ?? []));
  }

  useEffect(load, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const invalid = validateNewsArticleInput(form);
    if (invalid) {
      setError(`입력을 확인해주세요: ${invalid}`);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/news", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "failed");
      setForm(EMPTY);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "등록에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await fetch(`/api/admin/posts/${deleteTarget}`, { method: "DELETE" });
    setDeleteTarget(null);
    load();
  }

  const field =
    "h-10 rounded-md border border-[var(--color-border-gray)] px-3 text-sm outline-none focus:border-[var(--color-brand-red)]";
  const area =
    "resize-none rounded-md border border-[var(--color-border-gray)] p-3 text-sm outline-none focus:border-[var(--color-brand-red)]";

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-lg font-bold">뉴스 관리</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          className={field}
          placeholder="헤드라인 (한국어)"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
        />
        <div className="flex gap-3">
          <input
            className={`${field} flex-1`}
            placeholder="출처 매체명 (예: Khaosod (ข่าวสด))"
            value={form.sourceName}
            onChange={(e) => setForm({ ...form, sourceName: e.target.value })}
          />
          <input
            className={`${field} w-24`}
            placeholder="원문 언어"
            value={form.originalLang}
            onChange={(e) => setForm({ ...form, originalLang: e.target.value })}
          />
        </div>
        <input
          className={field}
          placeholder="출처 URL (https://...)"
          value={form.sourceUrl}
          onChange={(e) => setForm({ ...form, sourceUrl: e.target.value })}
        />
        <textarea
          className={area}
          rows={5}
          placeholder="원문 발췌 (원문 언어 그대로, 2~4문장)"
          value={form.originalBody}
          onChange={(e) => setForm({ ...form, originalBody: e.target.value })}
        />
        <textarea
          className={area}
          rows={8}
          placeholder="한국어 요약"
          value={form.body}
          onChange={(e) => setForm({ ...form, body: e.target.value })}
        />
        {error && <p className="text-xs text-[var(--color-brand-red)]">{error}</p>}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={submitting}
            className="relative rounded-md bg-[var(--color-brand-red)] px-5 py-2 text-sm font-medium text-white disabled:opacity-50 gg-glossy-btn"
          >
            등록
          </button>
        </div>
      </form>

      <ul className="divide-y divide-[var(--color-border-gray-light)] rounded-lg border border-[var(--color-border-gray)]">
        {rows.length === 0 && (
          <li className="px-4 py-3 text-sm text-[var(--color-text-muted)]">
            등록된 뉴스가 없습니다.
          </li>
        )}
        {rows.map((r) => (
          <li key={r.id} className="flex items-center gap-3 px-4 py-3 text-sm">
            <span className="min-w-0 flex-1 truncate">{r.title}</span>
            <span className="shrink-0 text-xs text-[var(--color-text-muted)]">
              {r.source_name ?? "—"}
            </span>
            <span className="shrink-0 text-xs text-[var(--color-text-muted)]">
              {formatDate(r.created_at)}
            </span>
            <a
              href={`/board/news/${r.id}`}
              target="_blank"
              rel="noreferrer"
              className="shrink-0 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-brand-red)]"
            >
              보기
            </a>
            <button
              onClick={() => setDeleteTarget(r.id)}
              className="shrink-0 text-xs font-medium text-[var(--color-brand-red)]"
            >
              삭제
            </button>
          </li>
        ))}
      </ul>

      {deleteTarget && (
        <ConfirmModal
          message="이 뉴스를 삭제하시겠습니까?"
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Typecheck and lint**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run lint`
Expected: no new errors. (`useEffect(load, [])` mirrors `src/app/admin/posts/page.tsx`'s `useEffect(load, [category])` — the repo's lint config accepts it. If lint flags it here, add `// eslint-disable-next-line react-hooks/exhaustive-deps` above the `useEffect(load, [])` line, matching how `page.tsx` handles similar cases.)

- [ ] **Step 4: Browser check — full round trip**

On the admin-logged-in tab:
1. Go to http://localhost:3000/admin — confirm the left nav now shows **뉴스 관리** between 회원 관리 and 게시글 관리.
2. Click **뉴스 관리** → the compose form + empty list render.
3. Submit with the summary field blank → inline error "입력을 확인해주세요: body", no network call succeeds.
4. Fill every field (`출처 URL` = `https://example.com`, others any non-empty text) → **등록** → form clears and the new row appears in the list below with its title, source name, and date.
5. Click **보기** → opens `/board/news/<id>` in a new tab (renders via the default post layout for now — Task 6 makes it pretty).
6. Click **삭제** → confirm modal → row disappears; `/board/news` shows the empty state again.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/news/page.tsx src/app/admin/layout.tsx
git commit -m "feat(news): admin compose page and 뉴스 관리 nav entry"
```

---

### Task 5: i18n keys for the news detail chrome

**Files:**
- Modify: `src/lib/i18n/dictionaries.ts` (add 4 keys to each of the 10 locale objects; insert each block immediately after that locale's `"post.originalView": ...` line)

**Interfaces:**
- Consumes: nothing.
- Produces: `DictionaryKey`s `news.byline`, `news.originalLabel`, `news.summaryLabel`, `news.sourceLabel`. Tasks 6 and 7 call `t("news.…")`.

- [ ] **Step 1: Add the four keys to every locale**

In `src/lib/i18n/dictionaries.ts`, in each locale object, add these four lines directly after the existing `"post.originalView": "…",` line. Use the exact values below per locale.

`ko` (after line ~89):
```ts
  "news.byline": "줍줍 뉴스",
  "news.originalLabel": "원문",
  "news.summaryLabel": "한국어 요약",
  "news.sourceLabel": "출처",
```

`en`:
```ts
  "news.byline": "Gup Gup News",
  "news.originalLabel": "Original",
  "news.summaryLabel": "Korean Summary",
  "news.sourceLabel": "Source",
```

`vi`:
```ts
  "news.byline": "Tin tức Gup Gup",
  "news.originalLabel": "Bản gốc",
  "news.summaryLabel": "Tóm tắt tiếng Hàn",
  "news.sourceLabel": "Nguồn",
```

`th`:
```ts
  "news.byline": "ข่าว Gup Gup",
  "news.originalLabel": "ต้นฉบับ",
  "news.summaryLabel": "สรุปภาษาเกาหลี",
  "news.sourceLabel": "ที่มา",
```

`id`:
```ts
  "news.byline": "Berita Gup Gup",
  "news.originalLabel": "Teks asli",
  "news.summaryLabel": "Ringkasan bahasa Korea",
  "news.sourceLabel": "Sumber",
```

`tl`:
```ts
  "news.byline": "Balita ng Gup Gup",
  "news.originalLabel": "Orihinal",
  "news.summaryLabel": "Buod sa Korean",
  "news.sourceLabel": "Pinagmulan",
```

`lo`:
```ts
  "news.byline": "ຂ່າວ Gup Gup",
  "news.originalLabel": "ຕົ້ນສະບັບ",
  "news.summaryLabel": "ສະຫຼຸບພາສາເກົາຫຼີ",
  "news.sourceLabel": "ແຫຼ່ງທີ່ມາ",
```

`my`:
```ts
  "news.byline": "Gup Gup သတင်း",
  "news.originalLabel": "မူရင်း",
  "news.summaryLabel": "ကိုရီးယားဘာသာ အကျဉ်းချုပ်",
  "news.sourceLabel": "အရင်းအမြစ်",
```

`mn`:
```ts
  "news.byline": "Gup Gup Мэдээ",
  "news.originalLabel": "Эх бичвэр",
  "news.summaryLabel": "Солонгос хэлээрх хураангуй",
  "news.sourceLabel": "Эх сурвалж",
```

`ru`:
```ts
  "news.byline": "Новости Gup Gup",
  "news.originalLabel": "Оригинал",
  "news.summaryLabel": "Краткое содержание на корейском",
  "news.sourceLabel": "Источник",
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. (If any locale is missing a key, `DICTIONARIES: Record<Locale, Dictionary>` fails to compile — that error names the offending locale.)

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/i18n/dictionaries.ts
git commit -m "feat(news): add news.* i18n keys across all 10 locales"
```

---

### Task 6: News detail render branch

**Files:**
- Modify: `src/app/board/[category]/[postId]/page.tsx` (the author row, lines ~132-148; the body `<div>`, lines ~150-152)

**Interfaces:**
- Consumes: `Post.originalBody / originalLang / sourceName / sourceUrl` (Task 2); `t("news.byline" | "news.originalLabel" | "news.summaryLabel" | "news.sourceLabel")` (Task 5). `config` (`CATEGORIES[categorySlug]`), `showTranslation`, `translated`, `post` are already in scope in this component.
- Produces: nothing other tasks consume.

- [ ] **Step 1: Swap the byline for news in the author row**

In `src/app/board/[category]/[postId]/page.tsx`, change:

```tsx
          {config.hasNicknamePopup ? (
            <NicknamePopup author={post.author} className="text-sm" />
          ) : (
            <span className="text-sm font-medium">{post.author.nickname}</span>
          )}
```

to:

```tsx
          {config.hasNicknamePopup ? (
            <NicknamePopup author={post.author} className="text-sm" />
          ) : (
            <span className="text-sm font-medium">
              {config.slug === "news" ? t("news.byline") : post.author.nickname}
            </span>
          )}
```

- [ ] **Step 2: Branch the body render**

In the same file, change:

```tsx
      <div className="min-h-32 whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
        {showTranslation && translated ? translated.body : post.body}
      </div>
```

to:

```tsx
      {config.slug === "news" && post.originalBody ? (
        <div className="text-sm leading-relaxed text-gray-700">
          <p className="mb-1 text-xs font-semibold text-[var(--color-text-muted)]">
            {t("news.originalLabel")}
          </p>
          <div lang={post.originalLang} className="whitespace-pre-wrap">
            {post.originalBody}
          </div>
          {post.sourceName && post.sourceUrl && (
            <p className="mt-2 text-xs text-[var(--color-text-muted)]">
              {t("news.sourceLabel")}:{" "}
              <a
                href={post.sourceUrl}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="underline hover:text-[var(--color-brand-red)]"
              >
                {post.sourceName}
              </a>
            </p>
          )}
          <div className="my-4 border-t border-[var(--color-border-gray-light)]" />
          <p className="mb-1 text-xs font-semibold text-[var(--color-text-muted)]">
            {t("news.summaryLabel")}
          </p>
          <div className="whitespace-pre-wrap">
            {showTranslation && translated ? translated.body : post.body}
          </div>
        </div>
      ) : (
        <div className="min-h-32 whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
          {showTranslation && translated ? translated.body : post.body}
        </div>
      )}
```

Do **not** touch `handleToggleTranslate` — it already sends `texts: [post.title, post.body]`, which is exactly the news requirement (title + summary, never the original).

- [ ] **Step 3: Typecheck and lint**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run lint`
Expected: no new errors.

- [ ] **Step 4: Browser check — layout, translate, locale**

Precondition: create one news post via `/admin/news` (any real-ish content; `출처 URL` = a real article URL like `https://www.khaosod.co.th/special-stories/news_9599969`). Keep its id.

1. Open `/board/news/<id>`:
   - author row shows **줍줍 뉴스** (not the admin nickname)
   - order top→bottom: "원문" label → original text → "출처: <sourceName>" (sourceName is a link, opens in new tab) → horizontal divider → "한국어 요약" label → summary text
2. Click **번역 보기** (top-right of the author row):
   - the `<h1>` title and the summary switch to the target-locale translation
   - the **원문 block does not change**
3. Header globe → switch to English:
   - labels read "Original" / "Source" / "Korean Summary", byline reads "Gup Gup News"
4. Open a non-news post (e.g. under `/board/community`): body renders exactly as before, single block, real nickname/popup. No regression.

- [ ] **Step 5: Commit**

```bash
git add "src/app/board/[category]/[postId]/page.tsx"
git commit -m "feat(news): detail layout — original block, source link, translated summary"
```

---

### Task 7: News byline in list rows

**Files:**
- Modify: `src/components/board/PostListItem.tsx` (the meta row `<span>{post.author.nickname}</span>`, line ~51)

**Interfaces:**
- Consumes: `t("news.byline")` (Task 5); `post.category` (existing on `Post`). `useLanguage` / `t` are already imported in this file.
- Produces: nothing other tasks consume.

- [ ] **Step 1: Swap the author name for news**

In `src/components/board/PostListItem.tsx`, change:

```tsx
            <span>{post.author.nickname}</span>
```

to:

```tsx
            <span>{post.category === "news" ? t("news.byline") : post.author.nickname}</span>
```

- [ ] **Step 2: Typecheck and lint**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run lint`
Expected: no new errors.

- [ ] **Step 3: Browser check — list + home**

1. http://localhost:3000/board/news — the news row's meta line shows **줍줍 뉴스 · <date> · …** instead of the admin nickname. Title, view/comment counts unaffected.
2. http://localhost:3000/ — the news large box lists the post (title + date only, as before — this box never showed an author).
3. http://localhost:3000/board/community — community rows still show real nicknames. No regression.
4. Switch locale to English → the news row byline reads "Gup Gup News".

- [ ] **Step 4: Commit**

```bash
git add src/components/board/PostListItem.tsx
git commit -m "feat(news): show fixed byline for news rows in board lists"
```

---

### Task 8: First article — content + rollout (no code)

This task produces the first real news post and verifies the whole feature end to end. It is run in the main session (the one with agent-reach + Browser tools), not by a code subagent. No commits.

**Files:** none.

- [ ] **Step 1: Pull the source article**

Use agent-reach to fetch the Khaosod article body:
`curl -s "https://r.jina.ai/https://www.khaosod.co.th/special-stories/news_9599969"` (or `mcporter call exa.web_search_exa` then read). Also glance at PPTV HD36 `https://www.pptvhd36.com/news/สังคม/241147` for the family-interview detail.

- [ ] **Step 2: Build the six form fields**

Assemble, ready to paste:
- **헤드라인 (한국어):** e.g. "파주서 일하는 태국인 형제, 로또 1등 40억 당첨…태국 매체 보도"
- **출처 매체명:** `Khaosod (ข่าวสด)`
- **출처 URL:** `https://www.khaosod.co.th/special-stories/news_9599969`
- **원문 발췌:** the Khaosod lead — 2-4 sentences of Thai, verbatim, no more. Not the whole article.
- **한국어 요약:** 4-6 sentences in your own words (do not copy YTN/Korean-outlet phrasing): lotto round 1155 (Jan 18 draw), 7 first-prize winners at ₩4,066,375,179 each (~₩2.757bn after tax), auto-pick ticket near Geumchon station in Paju, two Thai co-workers splitting one prize (~96M baht total, ~45M each / ~₩1.3–1.9bn), winner is from Udon Thani and plans to finish his ~5–6 months of remaining factory contract, tax differs for resident vs non-resident foreign winners. Cite Khaosod (and PPTV for the family interview).
- **원문 언어:** `th`

Present these to the user in chat.

- [ ] **Step 2b: Confirm migration 0011 is applied**

Ask the user to confirm they ran Task 1's SQL in the Supabase SQL Editor (the `select … from posts limit 1;` check passed). If not, walk them through it now.

- [ ] **Step 3: User submits the post**

User: `/admin` → **뉴스 관리** → paste the six fields → **등록**. Confirm the row appears in the admin list.

- [ ] **Step 4: Joint verification (spec §6)**

Walk the checklist with the user on the running site:
- `/board/news` list: new post, byline "줍줍 뉴스"
- detail: 원문 발췌 → `출처: Khaosod` (link opens Khaosod in a new tab) → divider → 한국어 요약
- **번역 보기**: title + summary translate, Thai original stays put
- locale switch: labels localize
- logged-in comment: posts and appears
- home page news box: shows the post
- a non-news board: unchanged

- [ ] **Step 5: Report**

Summarize what shipped and note that further news posts only need `/admin/news` → paste → 등록 (migration + admin setup are done).

---

## Self-Review

**1. Spec coverage**

| Spec section | Task |
|---|---|
| §1 data model / migration `0011` | Task 1 |
| §1 `Post` type + `POST_SELECT` + `mapPost` | Task 2 |
| §2 admin page `/admin/news` | Task 4 |
| §2 route `POST /api/admin/news` (`assertAdmin`, service-role insert, `points_awarded:0`, no points RPC, `source_url` http(s) check) | Task 3 |
| §2 admin `NAV` entry | Task 4 |
| §2 public write-button guard unchanged | untouched by design (no task needed) |
| §3 byline label on detail | Task 6 |
| §3 original block + `lang` attr, never translated | Task 6 |
| §3 source line (`출처:` + linked `sourceName`, `noopener noreferrer nofollow`) | Task 6 |
| §3 divider + summary label + translated summary | Task 6 |
| §3 translate payload stays `[title, body]` | Task 6 Step 2 (explicit "do not touch handleToggleTranslate") |
| §4 list byline | Task 7 |
| §4 home `CategoryBox` unchanged | untouched by design (verified in Task 7 Step 3) |
| §4 comments already work, verify only | Task 8 Step 4 |
| §4 i18n keys × 10 locales | Task 5 |
| §5 first-article content prep | Task 8 |
| §6 verification approach (tsc + lint + browser) | every task's check steps |

No gaps.

**2. Placeholder scan**

No "TBD"/"TODO"/"handle edge cases"/"similar to Task N". All code blocks are complete file contents or exact before/after diffs. i18n values are literal per locale. The only deferred content is Task 8's article excerpt/summary — that is a content-authoring step by nature (the plan specifies length, sourcing, and constraints), not a code placeholder.

**3. Type consistency**

- `validateNewsArticleInput(input: Partial<NewsArticleInput>): NewsInputError | null` — defined in Task 3, imported unchanged in Tasks 3 (route) and 4 (page). Same name both places.
- `NewsArticleInput` field names (`title, sourceName, sourceUrl, originalBody, originalLang, body`) match the route's request parse, the page's `EMPTY`/`form` object keys, and the DB insert mapping (`originalBody → original_body`, etc.). Consistent.
- `Post` additions (`originalBody, originalLang, sourceName, sourceUrl`) — defined Task 2, read in Tasks 6 and the plan's Task 4 list query uses snake_case `source_name` directly off the raw row (not `Post`), which is fine.
- i18n keys `news.byline / news.originalLabel / news.summaryLabel / news.sourceLabel` — defined Task 5, consumed with identical spelling in Tasks 6 and 7.
- `POST_SELECT` column list and `PostRow` fields both gain the same four snake_case names in Task 2.

Consistent throughout.
