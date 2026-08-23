# Admin Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the site's operator an `/admin` section to resolve reports, answer inquiries, manage members, and moderate posts — gated by a per-account `is_admin` flag.

**Architecture:** A guarded route group (`src/app/admin/*`) checks `is_admin` server-side before rendering. Every privileged read/write (data belonging to other users) goes through `src/app/api/admin/*` route handlers, which re-check `is_admin` and use the existing service-role client (`createAdminClient()`) to bypass RLS. Reads that are already publicly readable under RLS (posts, comments) are fetched directly from admin pages without an API round-trip; only their mutations need the service role.

**Tech Stack:** Next.js App Router (server components + route handlers), Supabase (`@supabase/ssr` server client, `@supabase/supabase-js` service-role client), no automated test framework — this project has none, so every task ends in a manual browser check instead of an automated test run.

**Spec:** `docs/superpowers/specs/2026-08-23-admin-panel-design.md`

## Global Constraints

- Admin UI text is hardcoded Korean, not run through the 10-language dictionary — `/admin` is operator-only, never seen by end users, so it's exempt from this project's usual "every UI string needs all 10 locales" rule. Exception: category names reuse `useLanguage()`/`CATEGORIES[slug].labelKey` since that mapping already exists and reimplementing it would duplicate data.
- Every `/api/admin/*` route starts with `const admin = await assertAdmin(); if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });` — this is the actual security boundary, not the page-level redirect.
- Dynamic route params are `Promise`-typed and must be awaited (`{ params }: { params: Promise<{ id: string }> }`), matching this codebase's Next.js version.
- No automated tests exist anywhere in this project. Each task's verification step is a manual check against the local dev server, matching how every other feature in this codebase has been verified.
- Follow existing file conventions: `snake_case` DB columns mapped to `camelCase` in TS at the data-access boundary, Tailwind utility classes (no CSS modules), `cn()` from `@/lib/utils` for conditional classes.

---

### Task 1: Migration, admin bootstrap, and the `assertAdmin` helper

**Files:**
- Create: `supabase/migrations/0009_admin.sql`
- Create: `src/lib/supabase/adminAuth.ts`

**Interfaces:**
- Produces: `assertAdmin(): Promise<{ userId: string } | null>` — every later task's API routes and the admin layout import this.

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/0009_admin.sql
-- Adds a per-account admin flag and report resolution tracking. Admin
-- writes to other users' data go through the service-role key from
-- trusted server routes (see src/lib/supabase/adminAuth.ts), the same
-- pattern already used for inquiry replies -- no admin RLS policies
-- are added here.

alter table profiles add column is_admin boolean not null default false;

alter table reports add column status text not null default 'pending'
  check (status in ('pending', 'resolved'));
alter table reports add column resolved_at timestamptz;
```

- [ ] **Step 2: Apply the migration**

This project has no linked Supabase CLI project (no `supabase/config.toml`), so every prior migration was applied by pasting it into the Supabase SQL editor. Open the project's SQL editor at
`https://supabase.com/dashboard/project/dohnbbhjvfbdmujlvcqm/sql/new`,
paste the contents of `0009_admin.sql`, and run it. Confirm it succeeds
(no error banner).

- [ ] **Step 3: Write `assertAdmin`**

```ts
// src/lib/supabase/adminAuth.ts
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export interface AdminContext {
  userId: string;
}

export async function assertAdmin(): Promise<AdminContext | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.is_admin) return null;

  return { userId: user.id };
}
```

- [ ] **Step 4: Bootstrap the first admin account**

Run this once from the project root (uses the service-role key already in
`.env.local` — do not print or commit the key itself):

```bash
node -e "
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
(async () => {
  const { data: { users } } = await supabase.auth.admin.listUsers();
  const target = users.find(u => u.email === 'gupguptalk@gmail.com');
  if (!target) { console.error('no auth user with that email'); process.exit(1); }
  const { error } = await supabase.from('profiles').update({ is_admin: true }).eq('id', target.id);
  if (error) { console.error(error); process.exit(1); }
  console.log('is_admin set for', target.email);
})();
"
```

Expected output: `is_admin set for gupguptalk@gmail.com`.

- [ ] **Step 5: Manual verification**

In the Supabase SQL editor, run
`select id, nickname, is_admin from profiles where is_admin = true;`
and confirm exactly one row comes back, matching the `gupguptalk@gmail.com`
account.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0009_admin.sql src/lib/supabase/adminAuth.ts
git commit -m "Add is_admin flag, report status column, and assertAdmin helper"
```

---

### Task 2: Guarded admin layout, dashboard, and nav discoverability

**Files:**
- Create: `src/app/admin/layout.tsx`
- Create: `src/app/admin/page.tsx`
- Modify: `src/lib/auth/AuthProvider.tsx`
- Modify: `src/components/layout/UserMenu.tsx`

**Interfaces:**
- Consumes: `assertAdmin()` from Task 1; `createAdminClient()` from `@/lib/supabase/admin` (existing).
- Produces: `Profile.isAdmin: boolean` on the context from `useAuth()` — Task 5's users page and this task's `UserMenu` both read it; no other task depends on it.

- [ ] **Step 1: Add `is_admin` to the auth profile shape**

In `src/lib/auth/AuthProvider.tsx`, the `Profile` and `ProfileRow`
interfaces and both profile-fetching call sites need the new column.

Change:
```ts
export interface Profile {
  id: string;
  nickname: string;
  country: string;
  avatar_url: string | null;
  points: number;
}

interface ProfileRow {
  id: string;
  nickname: string;
  country: string;
  avatar_url: string | null;
  is_withdrawn: boolean;
}
```
to:
```ts
export interface Profile {
  id: string;
  nickname: string;
  country: string;
  avatar_url: string | null;
  points: number;
  is_admin: boolean;
}

interface ProfileRow {
  id: string;
  nickname: string;
  country: string;
  avatar_url: string | null;
  is_withdrawn: boolean;
  is_admin: boolean;
}
```

Change the `loadProfile` select from
`"id, nickname, country, avatar_url, is_withdrawn"` to
`"id, nickname, country, avatar_url, is_withdrawn, is_admin"`.

Change `refreshProfile`'s select from
`"id, nickname, country, avatar_url"` to
`"id, nickname, country, avatar_url, is_admin"`.

- [ ] **Step 2: Write the admin layout**

```tsx
// src/app/admin/layout.tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { assertAdmin } from "@/lib/supabase/adminAuth";

const NAV = [
  { href: "/admin", label: "대시보드" },
  { href: "/admin/reports", label: "신고 관리" },
  { href: "/admin/inquiries", label: "문의사항" },
  { href: "/admin/users", label: "회원 관리" },
  { href: "/admin/posts", label: "게시글 관리" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await assertAdmin();
  if (!admin) redirect("/");

  return (
    <div className="mx-auto flex max-w-5xl gap-6 px-4 py-6">
      <nav className="flex w-40 shrink-0 flex-col gap-1 text-sm">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-md px-3 py-2 hover:bg-[var(--color-border-gray-light)]"
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
```

- [ ] **Step 3: Write the dashboard**

```tsx
// src/app/admin/page.tsx
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function AdminDashboardPage() {
  const admin = createAdminClient();
  const [{ count: pendingReports }, { count: pendingInquiries }] = await Promise.all([
    admin.from("reports").select("id", { count: "exact", head: true }).eq("status", "pending"),
    admin.from("inquiries").select("id", { count: "exact", head: true }).eq("status", "pending"),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-bold">관리자 대시보드</h1>
      <div className="grid grid-cols-2 gap-4">
        <Link
          href="/admin/reports"
          className="rounded-lg border border-[var(--color-border-gray)] p-4 hover:border-[var(--color-brand-red)]"
        >
          <p className="text-xs text-[var(--color-text-muted)]">대기 중인 신고</p>
          <p className="text-2xl font-bold">{pendingReports ?? 0}</p>
        </Link>
        <Link
          href="/admin/inquiries"
          className="rounded-lg border border-[var(--color-border-gray)] p-4 hover:border-[var(--color-brand-red)]"
        >
          <p className="text-xs text-[var(--color-text-muted)]">대기 중인 문의</p>
          <p className="text-2xl font-bold">{pendingInquiries ?? 0}</p>
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Add the nav link in `UserMenu`**

In `src/components/layout/UserMenu.tsx`, inside the logged-in dropdown
(the `{open && (...)}` block), add a conditional link right after the
"포인트" row and before the "내 프로필" link:

```tsx
{profile?.is_admin && (
  <Link
    href="/admin"
    className="block px-4 py-2 text-sm font-semibold text-[var(--color-brand-red)] hover:bg-[var(--color-border-gray-light)]"
    onClick={() => setOpen(false)}
  >
    관리자 페이지
  </Link>
)}
```

- [ ] **Step 5: Manual verification**

Start the dev server (`npm run dev` or the existing preview task). While
logged out, visit `http://localhost:3000/admin` and confirm it redirects
to `/`. Log in as `gupguptalk@gmail.com`, confirm the header dropdown now
shows "관리자 페이지", click it, and confirm the dashboard renders with
two count cards (both `0` is expected on a fresh install). Log in as any
other (non-admin) account and confirm `/admin` still redirects and the
dropdown link is absent.

- [ ] **Step 6: Commit**

```bash
git add src/app/admin/layout.tsx src/app/admin/page.tsx src/lib/auth/AuthProvider.tsx src/components/layout/UserMenu.tsx
git commit -m "Add guarded admin layout, dashboard, and nav entry"
```

---

### Task 3: Reports queue (list, detail, resolve, and the shared delete routes)

**Files:**
- Create: `src/app/api/admin/reports/route.ts`
- Create: `src/app/api/admin/reports/[id]/route.ts`
- Create: `src/app/api/admin/reports/[id]/resolve/route.ts`
- Create: `src/app/api/admin/posts/[id]/route.ts`
- Create: `src/app/api/admin/comments/[id]/route.ts`
- Create: `src/app/admin/reports/page.tsx`
- Create: `src/app/admin/reports/[id]/page.tsx`

**Interfaces:**
- Consumes: `assertAdmin()` (Task 1).
- Produces: `DELETE /api/admin/posts/:id` and `PATCH /api/admin/comments/:id` — Task 6's posts page calls the first one directly; nothing outside this task calls the second.

- [ ] **Step 1: List reports**

```ts
// src/app/api/admin/reports/route.ts
import { NextResponse } from "next/server";
import { assertAdmin } from "@/lib/supabase/adminAuth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const admin = await assertAdmin();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const status = new URL(request.url).searchParams.get("status") ?? "pending";
  const supabase = createAdminClient();
  let query = supabase
    .from("reports")
    .select(
      "id, target_type, target_id, reason, detail, status, created_at, reporter:profiles(nickname)",
    )
    .order("created_at", { ascending: false });
  if (status !== "all") query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ reports: data });
}
```

- [ ] **Step 2: Report detail (with the reported content)**

```ts
// src/app/api/admin/reports/[id]/route.ts
import { NextResponse } from "next/server";
import { assertAdmin } from "@/lib/supabase/adminAuth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await assertAdmin();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;
  const supabase = createAdminClient();
  const { data: report, error } = await supabase
    .from("reports")
    .select(
      "id, target_type, target_id, reason, detail, status, created_at, reporter:profiles(nickname)",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!report) return NextResponse.json({ error: "not found" }, { status: 404 });

  let target: unknown = null;
  if (report.target_type === "post") {
    const { data } = await supabase
      .from("posts")
      .select("id, title, body, category, author_id, author:profiles(nickname)")
      .eq("id", report.target_id)
      .maybeSingle();
    target = data;
  } else if (report.target_type === "comment") {
    const { data } = await supabase
      .from("comments")
      .select("id, body, post_id, is_deleted, author_id, author:profiles(nickname)")
      .eq("id", report.target_id)
      .maybeSingle();
    target = data;
  } else {
    const { data } = await supabase
      .from("profiles")
      .select("id, nickname, country, is_withdrawn")
      .eq("id", report.target_id)
      .maybeSingle();
    target = data;
  }

  return NextResponse.json({ report, target });
}
```

- [ ] **Step 3: Resolve a report**

```ts
// src/app/api/admin/reports/[id]/resolve/route.ts
import { NextResponse } from "next/server";
import { assertAdmin } from "@/lib/supabase/adminAuth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await assertAdmin();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("reports")
    .update({ status: "resolved", resolved_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Delete any post (admin), reversing its points like the user-facing delete does**

```ts
// src/app/api/admin/posts/[id]/route.ts
import { NextResponse } from "next/server";
import { assertAdmin } from "@/lib/supabase/adminAuth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await assertAdmin();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;
  const supabase = createAdminClient();

  const { data: post } = await supabase
    .from("posts")
    .select("author_id, points_awarded")
    .eq("id", id)
    .maybeSingle();
  if (!post) return NextResponse.json({ error: "not found" }, { status: 404 });

  const { error: deleteError } = await supabase.from("posts").delete().eq("id", id);
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });

  if (post.points_awarded) {
    const { data: author } = await supabase
      .from("profiles")
      .select("points")
      .eq("id", post.author_id)
      .maybeSingle();
    if (author) {
      await supabase
        .from("profiles")
        .update({ points: Math.max(author.points - post.points_awarded, 0) })
        .eq("id", post.author_id);
    }
  }

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 5: Soft-delete any comment (admin)**

```ts
// src/app/api/admin/comments/[id]/route.ts
import { NextResponse } from "next/server";
import { assertAdmin } from "@/lib/supabase/adminAuth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await assertAdmin();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;
  const supabase = createAdminClient();
  const { error } = await supabase.from("comments").update({ is_deleted: true }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 6: Reports list page**

```tsx
// src/app/admin/reports/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatDate } from "@/lib/utils";

const REASON_LABEL: Record<string, string> = {
  spam: "스팸/광고",
  abuse: "욕설/비방",
  obscene: "음란물",
  fraud: "사기 의심",
  personal_info: "개인정보 노출",
  etc: "기타",
};

const TARGET_LABEL: Record<string, string> = {
  post: "게시글",
  comment: "댓글",
  user: "회원",
};

interface ReportListItem {
  id: string;
  target_type: "post" | "comment" | "user";
  reason: string;
  status: "pending" | "resolved";
  created_at: string;
  reporter: { nickname: string } | null;
}

export default function AdminReportsPage() {
  const [reports, setReports] = useState<ReportListItem[]>([]);
  const [status, setStatus] = useState<"pending" | "all">("pending");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/reports?status=${status}`)
      .then((r) => r.json())
      .then((data) => setReports(data.reports ?? []))
      .finally(() => setLoading(false));
  }, [status]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">신고 관리</h1>
        <div className="flex gap-1.5 text-xs">
          <button
            onClick={() => setStatus("pending")}
            className={status === "pending" ? "font-semibold text-[var(--color-brand-red)]" : "text-[var(--color-text-muted)]"}
          >
            대기 중
          </button>
          <span className="text-[var(--color-border-gray)]">|</span>
          <button
            onClick={() => setStatus("all")}
            className={status === "all" ? "font-semibold text-[var(--color-brand-red)]" : "text-[var(--color-text-muted)]"}
          >
            전체
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-[var(--color-text-muted)]">불러오는 중...</p>
      ) : reports.length === 0 ? (
        <p className="rounded-lg border border-[var(--color-border-gray)] py-10 text-center text-sm text-[var(--color-text-muted)]">
          신고가 없습니다.
        </p>
      ) : (
        <ul className="divide-y divide-[var(--color-border-gray-light)] rounded-lg border border-[var(--color-border-gray)]">
          {reports.map((r) => (
            <li key={r.id}>
              <Link
                href={`/admin/reports/${r.id}`}
                className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-[var(--color-border-gray-light)]"
              >
                <span className="shrink-0 rounded border border-[var(--color-border-gray)] px-1.5 py-0.5 text-xs">
                  {TARGET_LABEL[r.target_type]}
                </span>
                <span className="flex-1 truncate">{REASON_LABEL[r.reason] ?? r.reason}</span>
                <span className="shrink-0 text-xs text-[var(--color-text-muted)]">
                  {r.reporter?.nickname ?? "알 수 없음"}
                </span>
                <span className="shrink-0 text-xs text-[var(--color-text-muted)]">
                  {formatDate(r.created_at)}
                </span>
                <span
                  className={
                    r.status === "pending"
                      ? "shrink-0 text-xs font-semibold text-[var(--color-brand-red)]"
                      : "shrink-0 text-xs text-[var(--color-text-muted)]"
                  }
                >
                  {r.status === "pending" ? "대기" : "완료"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 7: Report detail page**

```tsx
// src/app/admin/reports/[id]/page.tsx
"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ConfirmModal } from "@/components/common/ConfirmModal";
import { formatDate } from "@/lib/utils";

const REASON_LABEL: Record<string, string> = {
  spam: "스팸/광고",
  abuse: "욕설/비방",
  obscene: "음란물",
  fraud: "사기 의심",
  personal_info: "개인정보 노출",
  etc: "기타",
};

interface ReportDetail {
  id: string;
  target_type: "post" | "comment" | "user";
  target_id: string;
  reason: string;
  detail: string | null;
  status: "pending" | "resolved";
  created_at: string;
  reporter: { nickname: string } | null;
}

interface PostTarget {
  id: string;
  title: string;
  body: string;
  category: string;
  author: { nickname: string } | null;
}

interface CommentTarget {
  id: string;
  body: string;
  post_id: string;
  is_deleted: boolean;
  author: { nickname: string } | null;
}

interface UserTarget {
  id: string;
  nickname: string;
  country: string;
  is_withdrawn: boolean;
}

export default function AdminReportDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [report, setReport] = useState<ReportDetail | null>(null);
  const [target, setTarget] = useState<PostTarget | CommentTarget | UserTarget | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  function load() {
    fetch(`/api/admin/reports/${params.id}`)
      .then((r) => r.json())
      .then((data) => {
        setReport(data.report ?? null);
        setTarget(data.target ?? null);
      });
  }

  useEffect(load, [params.id]);

  async function handleResolve() {
    await fetch(`/api/admin/reports/${params.id}/resolve`, { method: "POST" });
    load();
  }

  async function handleDelete() {
    if (!report) return;
    if (report.target_type === "post") {
      await fetch(`/api/admin/posts/${report.target_id}`, { method: "DELETE" });
    } else if (report.target_type === "comment") {
      await fetch(`/api/admin/comments/${report.target_id}`, { method: "PATCH" });
    }
    setConfirmDelete(false);
    load();
  }

  if (!report) {
    return <p className="text-sm text-[var(--color-text-muted)]">불러오는 중...</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <Link href="/admin/reports" className="text-xs text-[var(--color-text-muted)]">
        ← 목록으로
      </Link>
      <h1 className="text-lg font-bold">신고 상세</h1>

      <div className="rounded-lg border border-[var(--color-border-gray)] p-4 text-sm">
        <p>사유: {REASON_LABEL[report.reason] ?? report.reason}</p>
        <p>신고자: {report.reporter?.nickname ?? "알 수 없음"}</p>
        <p>일시: {formatDate(report.created_at)}</p>
        <p>상태: {report.status === "pending" ? "대기" : "처리 완료"}</p>
        {report.detail && <p className="mt-2 whitespace-pre-line">상세: {report.detail}</p>}
      </div>

      <div className="rounded-lg border border-[var(--color-border-gray)] p-4 text-sm">
        <p className="mb-2 font-semibold">신고된 대상</p>
        {!target ? (
          <p className="text-[var(--color-text-muted)]">대상을 찾을 수 없습니다 (이미 삭제됨).</p>
        ) : report.target_type === "post" ? (
          <>
            <p className="font-medium">{(target as PostTarget).title}</p>
            <p className="mt-1 whitespace-pre-line text-[var(--color-text-muted)]">
              {(target as PostTarget).body}
            </p>
            <p className="mt-2 text-xs text-[var(--color-text-muted)]">
              작성자: {(target as PostTarget).author?.nickname ?? "알 수 없음"}
            </p>
          </>
        ) : report.target_type === "comment" ? (
          <>
            <p className="whitespace-pre-line">{(target as CommentTarget).body}</p>
            <p className="mt-2 text-xs text-[var(--color-text-muted)]">
              작성자: {(target as CommentTarget).author?.nickname ?? "알 수 없음"}
              {(target as CommentTarget).is_deleted && " (이미 삭제됨)"}
            </p>
          </>
        ) : (
          <Link href={`/admin/users?q=${(target as UserTarget).nickname}`} className="text-[var(--color-brand-red)]">
            {(target as UserTarget).nickname} 회원 관리로 이동 →
          </Link>
        )}
      </div>

      <div className="flex gap-2">
        {target && report.target_type !== "user" && (
          <button
            onClick={() => setConfirmDelete(true)}
            className="h-10 flex-1 rounded-md border border-[var(--color-brand-red)] text-sm font-medium text-[var(--color-brand-red)]"
          >
            대상 삭제
          </button>
        )}
        {report.status === "pending" && (
          <button
            onClick={handleResolve}
            className="relative h-10 flex-1 rounded-md bg-[var(--color-brand-red)] text-sm font-medium text-white gg-glossy-btn"
          >
            처리 완료로 표시
          </button>
        )}
      </div>

      {confirmDelete && (
        <ConfirmModal
          message="이 대상을 삭제하시겠습니까?"
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 8: Manual verification**

As the reported-content author (a non-admin test account), create a
post, then report it (existing report flow) with reason "스팸/광고". Log
in as the admin, open `/admin/reports`, confirm the new report appears
under "대기 중" with the right reason/reporter labels. Click into it,
confirm the post's title/body/author render. Click "대상 삭제", confirm
the modal appears, confirm, and verify the post is gone from its board
page. Reload the report detail and confirm it now shows "대상을 찾을 수
없습니다". Click "처리 완료로 표시" on a second (undeleted) report and
confirm it disappears from the "대기 중" filter and appears under
"전체" with 완료 status.

- [ ] **Step 9: Commit**

```bash
git add src/app/api/admin/reports src/app/api/admin/posts src/app/api/admin/comments src/app/admin/reports
git commit -m "Add admin report queue with delete/resolve actions"
```

---

### Task 4: Inquiry replies

**Files:**
- Create: `src/app/api/admin/inquiries/route.ts`
- Create: `src/app/api/admin/inquiries/[id]/messages/route.ts`
- Create: `src/app/api/admin/inquiries/[id]/reply/route.ts`
- Create: `src/app/admin/inquiries/page.tsx`
- Create: `src/app/admin/inquiries/[id]/page.tsx`

**Interfaces:**
- Consumes: `assertAdmin()` (Task 1).
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: List all inquiries**

```ts
// src/app/api/admin/inquiries/route.ts
import { NextResponse } from "next/server";
import { assertAdmin } from "@/lib/supabase/adminAuth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const admin = await assertAdmin();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const status = new URL(request.url).searchParams.get("status") ?? "all";
  const supabase = createAdminClient();
  let query = supabase
    .from("inquiries")
    .select("id, title, status, created_at, user:profiles(nickname)")
    .order("created_at", { ascending: false });
  if (status !== "all") query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ inquiries: data });
}
```

- [ ] **Step 2: Thread messages**

```ts
// src/app/api/admin/inquiries/[id]/messages/route.ts
import { NextResponse } from "next/server";
import { assertAdmin } from "@/lib/supabase/adminAuth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await assertAdmin();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("inquiry_messages")
    .select("id, sender_type, body, created_at")
    .eq("inquiry_id", id)
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ messages: data });
}
```

- [ ] **Step 3: Reply as admin**

```ts
// src/app/api/admin/inquiries/[id]/reply/route.ts
import { NextResponse } from "next/server";
import { assertAdmin } from "@/lib/supabase/adminAuth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await assertAdmin();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;
  const { body } = (await request.json()) as { body?: string };
  if (!body?.trim()) {
    return NextResponse.json({ error: "empty body" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error: insertError } = await supabase.from("inquiry_messages").insert({
    inquiry_id: id,
    sender_type: "admin",
    sender_id: admin.userId,
    body: body.trim(),
  });
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  const { error: statusError } = await supabase
    .from("inquiries")
    .update({ status: "answered" })
    .eq("id", id);
  if (statusError) return NextResponse.json({ error: statusError.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Inquiries list page**

```tsx
// src/app/admin/inquiries/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatDate } from "@/lib/utils";

interface InquiryListItem {
  id: string;
  title: string;
  status: "pending" | "answered";
  created_at: string;
  user: { nickname: string } | null;
}

export default function AdminInquiriesPage() {
  const [inquiries, setInquiries] = useState<InquiryListItem[]>([]);
  const [status, setStatus] = useState<"pending" | "all">("pending");

  useEffect(() => {
    fetch(`/api/admin/inquiries?status=${status}`)
      .then((r) => r.json())
      .then((data) => setInquiries(data.inquiries ?? []));
  }, [status]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">문의사항</h1>
        <div className="flex gap-1.5 text-xs">
          <button
            onClick={() => setStatus("pending")}
            className={status === "pending" ? "font-semibold text-[var(--color-brand-red)]" : "text-[var(--color-text-muted)]"}
          >
            답변대기
          </button>
          <span className="text-[var(--color-border-gray)]">|</span>
          <button
            onClick={() => setStatus("all")}
            className={status === "all" ? "font-semibold text-[var(--color-brand-red)]" : "text-[var(--color-text-muted)]"}
          >
            전체
          </button>
        </div>
      </div>

      {inquiries.length === 0 ? (
        <p className="rounded-lg border border-[var(--color-border-gray)] py-10 text-center text-sm text-[var(--color-text-muted)]">
          문의가 없습니다.
        </p>
      ) : (
        <ul className="divide-y divide-[var(--color-border-gray-light)] rounded-lg border border-[var(--color-border-gray)]">
          {inquiries.map((i) => (
            <li key={i.id}>
              <Link
                href={`/admin/inquiries/${i.id}`}
                className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-[var(--color-border-gray-light)]"
              >
                <span className="flex-1 truncate">{i.title}</span>
                <span className="shrink-0 text-xs text-[var(--color-text-muted)]">
                  {i.user?.nickname ?? "알 수 없음"}
                </span>
                <span className="shrink-0 text-xs text-[var(--color-text-muted)]">
                  {formatDate(i.created_at)}
                </span>
                <span
                  className={
                    i.status === "pending"
                      ? "shrink-0 text-xs font-semibold text-[var(--color-brand-red)]"
                      : "shrink-0 text-xs text-[var(--color-text-muted)]"
                  }
                >
                  {i.status === "pending" ? "답변대기" : "답변완료"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Inquiry thread page**

```tsx
// src/app/admin/inquiries/[id]/page.tsx
"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { cn, formatDate } from "@/lib/utils";

interface InquiryMessage {
  id: string;
  sender_type: "user" | "admin";
  body: string;
  created_at: string;
}

export default function AdminInquiryThreadPage() {
  const params = useParams<{ id: string }>();
  const [messages, setMessages] = useState<InquiryMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  function load() {
    fetch(`/api/admin/inquiries/${params.id}/messages`)
      .then((r) => r.json())
      .then((data) => setMessages(data.messages ?? []));
  }

  useEffect(load, [params.id]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    setSending(true);
    try {
      await fetch(`/api/admin/inquiries/${params.id}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: draft.trim() }),
      });
      setDraft("");
      load();
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col gap-3">
      <Link href="/admin/inquiries" className="text-xs text-[var(--color-text-muted)]">
        ← 목록으로
      </Link>

      <div className="flex-1 space-y-3 overflow-y-auto py-2">
        {messages.map((m) => {
          const isAdmin = m.sender_type === "admin";
          return (
            <div key={m.id} className={cn("flex", isAdmin ? "justify-end" : "justify-start")}>
              <div className="flex max-w-[75%] flex-col">
                {isAdmin && (
                  <span className="mb-0.5 self-end text-[10px] text-[var(--color-text-muted)]">
                    Gup Gup 운영팀
                  </span>
                )}
                <div
                  className={cn(
                    "rounded-2xl px-3.5 py-2 text-sm",
                    isAdmin
                      ? "rounded-br-sm bg-[var(--color-brand-red)] text-white"
                      : "rounded-bl-sm bg-[var(--color-border-gray-light)] text-[var(--foreground)]",
                  )}
                >
                  {m.body}
                </div>
                <span className="mt-0.5 text-[10px] text-[var(--color-text-muted)]">
                  {formatDate(m.created_at)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <form onSubmit={handleSend} className="flex gap-2 border-t border-[var(--color-border-gray-light)] pt-3">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="답변을 입력하세요"
          className="h-10 flex-1 rounded-md border border-[var(--color-border-gray)] px-3 text-sm outline-none focus:border-[var(--color-brand-red)]"
        />
        <button
          disabled={sending}
          className="relative rounded-md bg-[var(--color-brand-red)] px-4 text-sm font-medium text-white disabled:opacity-50 gg-glossy-btn"
        >
          전송
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 6: Manual verification**

As a non-admin test account, submit a new inquiry from `/inquiries/new`.
As the admin, open `/admin/inquiries`, confirm it shows under 답변대기,
click in, confirm the user's message renders on the left. Send a reply;
confirm it renders on the right labeled "Gup Gup 운영팀". Go back to the
list and confirm the inquiry moved to 답변완료. Log back in as the
original user, open `/inquiries/[id]`, and confirm the admin's reply is
visible there too (same underlying table, existing user-facing page).

- [ ] **Step 7: Commit**

```bash
git add src/app/api/admin/inquiries src/app/admin/inquiries
git commit -m "Add admin inquiry queue and reply thread"
```

---

### Task 5: Member management

**Files:**
- Create: `src/app/api/admin/users/route.ts`
- Create: `src/app/api/admin/users/[id]/route.ts`
- Create: `src/app/admin/users/page.tsx`

**Interfaces:**
- Consumes: `assertAdmin()` (Task 1).
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Search users**

```ts
// src/app/api/admin/users/route.ts
import { NextResponse } from "next/server";
import { assertAdmin } from "@/lib/supabase/adminAuth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const admin = await assertAdmin();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  const supabase = createAdminClient();
  let query = supabase
    .from("profiles")
    .select("id, nickname, country, points, is_withdrawn, created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  if (q) query = query.ilike("nickname", `%${q}%`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ users: data });
}
```

- [ ] **Step 2: Adjust points / toggle withdrawal**

```ts
// src/app/api/admin/users/[id]/route.ts
import { NextResponse } from "next/server";
import { assertAdmin } from "@/lib/supabase/adminAuth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await assertAdmin();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;
  const body = (await request.json()) as { pointsDelta?: number; isWithdrawn?: boolean };
  const supabase = createAdminClient();

  if (typeof body.pointsDelta === "number" && body.pointsDelta !== 0) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("points")
      .eq("id", id)
      .maybeSingle();
    if (!profile) return NextResponse.json({ error: "not found" }, { status: 404 });
    const { error } = await supabase
      .from("profiles")
      .update({ points: Math.max(profile.points + body.pointsDelta, 0) })
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (typeof body.isWithdrawn === "boolean") {
    const { error } = await supabase
      .from("profiles")
      .update({ is_withdrawn: body.isWithdrawn })
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Users page**

```tsx
// src/app/admin/users/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { formatDate } from "@/lib/utils";

interface AdminUserRow {
  id: string;
  nickname: string;
  country: string;
  points: number;
  is_withdrawn: boolean;
  created_at: string;
}

export default function AdminUsersPage() {
  const searchParams = useSearchParams();
  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [pointsInput, setPointsInput] = useState<Record<string, string>>({});

  function load(query: string) {
    fetch(`/api/admin/users?q=${encodeURIComponent(query)}`)
      .then((r) => r.json())
      .then((data) => setUsers(data.users ?? []));
  }

  useEffect(() => {
    load(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleAdjustPoints(id: string) {
    const raw = pointsInput[id];
    const delta = Number(raw);
    if (!raw || Number.isNaN(delta) || delta === 0) return;
    await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pointsDelta: delta }),
    });
    setPointsInput((prev) => ({ ...prev, [id]: "" }));
    load(q);
  }

  async function handleToggleWithdraw(id: string, next: boolean) {
    await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isWithdrawn: next }),
    });
    load(q);
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-bold">회원 관리</h1>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          load(q);
        }}
        className="flex gap-2"
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="닉네임 검색"
          className="h-10 flex-1 rounded-md border border-[var(--color-border-gray)] px-3 text-sm outline-none focus:border-[var(--color-brand-red)]"
        />
        <button className="h-10 rounded-md border border-[var(--color-border-gray)] px-4 text-sm font-medium">
          검색
        </button>
      </form>

      <ul className="divide-y divide-[var(--color-border-gray-light)] rounded-lg border border-[var(--color-border-gray)]">
        {users.map((u) => (
          <li key={u.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
            <span className="min-w-0 flex-1 truncate font-medium">{u.nickname}</span>
            <span className="text-xs text-[var(--color-text-muted)]">{u.country}</span>
            <span className="text-xs text-[var(--color-text-muted)]">{formatDate(u.created_at)}</span>
            <span className="text-xs font-semibold">{u.points}P</span>
            <input
              value={pointsInput[u.id] ?? ""}
              onChange={(e) => setPointsInput((prev) => ({ ...prev, [u.id]: e.target.value }))}
              placeholder="+/-포인트"
              className="h-8 w-24 rounded border border-[var(--color-border-gray)] px-2 text-xs"
            />
            <button
              onClick={() => handleAdjustPoints(u.id)}
              className="h-8 rounded border border-[var(--color-border-gray)] px-2 text-xs"
            >
              적용
            </button>
            <button
              onClick={() => handleToggleWithdraw(u.id, !u.is_withdrawn)}
              className={
                u.is_withdrawn
                  ? "h-8 rounded border border-[var(--color-border-gray)] px-2 text-xs"
                  : "h-8 rounded border border-[var(--color-brand-red)] px-2 text-xs text-[var(--color-brand-red)]"
              }
            >
              {u.is_withdrawn ? "탈퇴 해제" : "탈퇴 처리"}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 4: Manual verification**

Open `/admin/users`, search for a known test nickname, confirm it shows
country/가입일/points/status. Enter `50` in its points box and click
적용; confirm the displayed points increase by 50 and that account's own
profile page (`/profile`, logged in as that user) shows the same updated
balance. Click 탈퇴 처리, confirm the button flips to "탈퇴 해제"; log in
as that account and confirm it's immediately signed out and redirected
to `/login?withdrawn=1`, matching self-withdrawal behavior. Click 탈퇴
해제 and confirm that account can log in again.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/admin/users src/app/admin/users
git commit -m "Add admin member search, point adjustment, and withdrawal toggle"
```

---

### Task 6: Post moderation

**Files:**
- Create: `src/app/admin/posts/page.tsx`

**Interfaces:**
- Consumes: `DELETE /api/admin/posts/:id` (Task 3); `CATEGORIES`/`CATEGORY_ORDER` from `@/lib/constants/categories` (existing); `useLanguage()` from `@/lib/i18n/LanguageProvider` (existing) for category label lookup only.

- [ ] **Step 1: Posts list page**

Posts are publicly readable under RLS, so this page queries Supabase
directly with the browser client — only the delete action needs the
admin API.

```tsx
// src/app/admin/posts/page.tsx
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { CATEGORIES, CATEGORY_ORDER } from "@/lib/constants/categories";
import type { CategorySlug } from "@/lib/types";
import type { DictionaryKey } from "@/lib/i18n/dictionaries";
import { ConfirmModal } from "@/components/common/ConfirmModal";
import { formatDate } from "@/lib/utils";

interface AdminPostRow {
  id: string;
  title: string;
  category: CategorySlug;
  created_at: string;
  author: { nickname: string } | null;
}

export default function AdminPostsPage() {
  const { t } = useLanguage();
  const [category, setCategory] = useState<CategorySlug | "all">("all");
  const [q, setQ] = useState("");
  const [posts, setPosts] = useState<AdminPostRow[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  function load() {
    const supabase = createClient();
    let query = supabase
      .from("posts")
      .select("id, title, category, created_at, author:profiles(nickname)")
      .order("created_at", { ascending: false })
      .limit(50);
    if (category !== "all") query = query.eq("category", category);
    if (q.trim()) query = query.ilike("title", `%${q.trim()}%`);
    query.then(({ data }) => setPosts((data as unknown as AdminPostRow[]) ?? []));
  }

  useEffect(load, [category]);

  async function handleDelete() {
    if (!deleteTarget) return;
    await fetch(`/api/admin/posts/${deleteTarget}`, { method: "DELETE" });
    setDeleteTarget(null);
    load();
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-bold">게시글 관리</h1>

      <div className="flex flex-wrap gap-2">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as CategorySlug | "all")}
          className="h-10 rounded-md border border-[var(--color-border-gray)] px-3 text-sm"
        >
          <option value="all">전체 카테고리</option>
          {CATEGORY_ORDER.map((slug) => (
            <option key={slug} value={slug}>
              {t(CATEGORIES[slug].labelKey as DictionaryKey)}
            </option>
          ))}
        </select>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            load();
          }}
          className="flex flex-1 gap-2"
        >
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="제목 검색"
            className="h-10 flex-1 rounded-md border border-[var(--color-border-gray)] px-3 text-sm outline-none focus:border-[var(--color-brand-red)]"
          />
          <button className="h-10 rounded-md border border-[var(--color-border-gray)] px-4 text-sm font-medium">
            검색
          </button>
        </form>
      </div>

      <ul className="divide-y divide-[var(--color-border-gray-light)] rounded-lg border border-[var(--color-border-gray)]">
        {posts.map((p) => (
          <li key={p.id} className="flex items-center gap-3 px-4 py-3 text-sm">
            <span className="shrink-0 rounded border border-[var(--color-border-gray)] px-1.5 py-0.5 text-xs">
              {t(CATEGORIES[p.category].labelKey as DictionaryKey)}
            </span>
            <span className="min-w-0 flex-1 truncate">{p.title}</span>
            <span className="shrink-0 text-xs text-[var(--color-text-muted)]">
              {p.author?.nickname ?? "알 수 없음"}
            </span>
            <span className="shrink-0 text-xs text-[var(--color-text-muted)]">
              {formatDate(p.created_at)}
            </span>
            <a
              href={`/board/${p.category}/${p.id}`}
              target="_blank"
              rel="noreferrer"
              className="shrink-0 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-brand-red)]"
            >
              보기
            </a>
            <button
              onClick={() => setDeleteTarget(p.id)}
              className="shrink-0 text-xs font-medium text-[var(--color-brand-red)]"
            >
              삭제
            </button>
          </li>
        ))}
      </ul>

      {deleteTarget && (
        <ConfirmModal
          message="이 게시글을 삭제하시겠습니까?"
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Manual verification**

Open `/admin/posts`, confirm posts from multiple categories list with
correct category badges. Filter by one category and confirm the list
narrows. Search a known title substring and confirm it filters. Click
"보기" and confirm it opens the real post page in a new tab. Click
"삭제" on a test post, confirm via the modal, and verify it's gone both
from this admin list and from its public board page.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/posts
git commit -m "Add admin post moderation list with category filter and delete"
```

---

### Task 7: Final pass

**Files:** none new — this is a review task.

- [ ] **Step 1: Re-check access control end to end**

Log out entirely. Attempt to `fetch('/api/admin/reports')` from the
browser console on the public site (or via `curl` with no auth cookie)
and confirm a 403 JSON body, not a 500 or a leak of data. Repeat for
`/api/admin/users`, `/api/admin/posts/<real-id>` (DELETE), and
`/api/admin/inquiries`. All must 403.

- [ ] **Step 2: Walk every nav item as the admin**

From `/admin`, click through 신고 관리, 문의사항, 회원 관리, 게시글 관리
in the sidebar and confirm each loads without a console error.

- [ ] **Step 3: Commit (if any fixes were needed)**

```bash
git add -A
git commit -m "Fix admin panel issues found in final review"
```
