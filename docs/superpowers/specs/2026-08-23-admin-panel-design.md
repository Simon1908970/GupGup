# Admin Panel — Design

## Overview

Gup Gup has no operator/admin surface today. Reports and inquiries are
stored (`reports`, `inquiries`, `inquiry_messages`) but nothing reads or
acts on them except the reporting/inquiring user themselves. This adds an
`/admin` section covering the four areas requested: report handling,
inquiry replies, member management, and post moderation.

## Goals

- Let an admin resolve reports (view the reported content, delete it if
  warranted, mark the report resolved).
- Let an admin answer user inquiries through the same conversational UI
  the user sees, as "Gup Gup 운영팀".
- Let an admin search members, adjust their points, and force a
  withdrawal/suspension.
- Let an admin browse and delete any post across all categories.
- Gate all of the above behind a real per-account admin flag, not a
  shared password.

## Non-goals (out of scope for this pass)

- Promoting other users to admin via UI (bootstrapped by direct SQL only).
- Temporary/timed suspensions (reuses the existing permanent
  `is_withdrawn` block).
- Bulk actions, analytics/dashboards beyond a simple pending-count
  summary, or an audit log of who did what.
- Editing post/comment bodies (moderation is delete-only, matching the
  existing user-facing delete behavior).

## Data model changes

One new migration (`0009_admin.sql`):

```sql
alter table profiles add column is_admin boolean not null default false;

alter table reports add column status text not null default 'pending'
  check (status in ('pending', 'resolved'));
alter table reports add column resolved_at timestamptz;
```

No other schema changes:
- Post deletion reuses the existing hard-delete path (`deletePost`),
  extended to allow an admin caller regardless of `author_id`.
- Comment deletion reuses the existing `is_deleted` soft-delete column.
- Member suspension reuses the existing `profiles.is_withdrawn` flag —
  once set, `AuthProvider` already force-signs-out and permanently blocks
  re-login, which is exactly "정지/강제 탈퇴" semantics. An admin can also
  clear it to reverse a mistaken action.
- Points adjustment writes `profiles.points` directly (clamped at 0),
  mirroring the clamping already done in the `adjust_points` RPC — but
  that RPC only operates on `auth.uid()`, so admin adjustment of another
  user's points goes through the API layer instead, not that RPC.

## Access control

**Bootstrap:** after the migration is applied, run once via the service
role (I'll do this as part of implementation, not manually in the
dashboard):

```sql
update profiles set is_admin = true
where id = (select id from auth.users where email = 'gupguptalk@gmail.com');
```

**Route protection:** `src/app/admin/layout.tsx` is a server component
that reads the session, loads `profiles.is_admin` for that user, and
redirects to `/` if the user isn't logged in or isn't an admin. This
guards every page under `/admin/*` in one place.

**Data access:** every privileged read/write (all reports, all
inquiries, any user's profile, any post/comment regardless of author)
goes through Next.js route handlers under `src/app/api/admin/*`. Each
handler re-verifies the caller's session and `is_admin` server-side
(via a shared `assertAdmin(request)` helper in
`src/lib/supabase/adminAuth.ts`) before using the existing
`createAdminClient()` service-role client to perform the action. This
keeps the privilege check in one reusable place instead of adding
admin-bypass RLS policies to five different tables — consistent with
the comment already in `0001_init.sql` anticipating this.

**Discoverability:** `UserMenu` gets a "관리자 페이지" link, shown only
when the loaded profile has `is_admin === true`. This is a convenience,
not the security boundary — the layout guard above is.

## Pages

All under `src/app/admin/`, sharing the guarded layout.

### `/admin` — dashboard
Pending report count and pending inquiry count, each linking into its
section. Exists so landing on `/admin` isn't a dead end.

### `/admin/reports` — report queue
List, pending first: target type (글/댓글/회원), reason, reporter
nickname, date, status. Row click opens a detail view showing the
reported content (fetched via admin API, since it might belong to
another user) and the reporter's free-text detail. Action depends on
`target_type`: for `post`/`comment` it's a delete button for that
content; for `user` it's a link straight to that member's row in
`/admin/users` (so the actual action — point adjustment or
withdrawal — happens from the one place that already does it). Marking
resolved is always available and separate from taking action; resolving
without acting is valid (e.g., report was unfounded).

### `/admin/inquiries` — inquiry queue
List of every user's inquiries (title, requester nickname, status).
Clicking one reuses the existing thread UI pattern from `/messages/[id]`
(bubble layout, textbox + send), styled so admin-sent messages are
visually distinct and always labeled "Gup Gup 운영팀" regardless of
which admin account sent them. First admin reply flips the inquiry's
status to `answered` automatically.

### `/admin/users` — member management
Nickname search box, results list showing country, join date, current
points, withdrawn/active status. Per-row actions: a small
+/− point adjustment input, and a withdraw/reinstate toggle. No
pagination-heavy member browsing — search-first, matching how an admin
actually finds one member to act on.

### `/admin/posts` — post moderation
Category filter + title search, flat list (author, category, date,
country). Each row has a "보기" link to the real post page (existing
`/board/[category]/[postId]`, unchanged) so the admin reviews content
in its normal rendering before acting, and a "삭제" button (with the
existing `ConfirmModal`) that calls the admin API directly from the
list.

## API endpoints (`src/app/api/admin/*`)

All require `assertAdmin`; all return 403 otherwise.

- `GET /api/admin/reports?status=` — list reports
- `GET /api/admin/reports/:id` — one report + its target content
- `POST /api/admin/reports/:id/resolve` — mark resolved
- `DELETE /api/admin/posts/:id` — hard-delete a post (any author)
- `PATCH /api/admin/comments/:id` — set `is_deleted = true`
- `GET /api/admin/posts?category=&q=` — list posts for moderation
- `GET /api/admin/inquiries?status=` — list all inquiries
- `GET /api/admin/inquiries/:id/messages` — thread messages
- `POST /api/admin/inquiries/:id/reply` — send an admin message, flips status
- `GET /api/admin/users?q=` — search profiles by nickname
- `PATCH /api/admin/users/:id` — body is `{ pointsDelta }` and/or
  `{ isWithdrawn }`

## Error handling

- Every admin API route: 401 if no session, 403 if session exists but
  `is_admin` is false, 404 if the target row doesn't exist, otherwise the
  normal 200/JSON shape used elsewhere in the app (`{ error: string }` on
  failure, matching existing routes like `/api/avatar`).
- The `/admin` layout redirect covers the page-level case (no admin
  ever sees a raw 403 page); the API-level check covers direct fetches
  and is the actual security boundary.

## Testing

- Manual pass through each of the four flows against local Supabase:
  report → view target → delete → resolve; inquiry → reply → status
  flips; user search → point adjustment reflected in their profile page
  → withdraw → confirm they're force-logged-out and blocked on next
  login; post list → delete → confirm it's gone from the public board.
- Confirm a non-admin account hitting any `/admin` page gets redirected,
  and hitting any `/api/admin/*` route gets 403.
- No automated test suite exists in this project yet, so this stays
  manual, consistent with how the rest of the app has been verified in
  this session.
