-- "내 월급" / "내 생활비" pinned posts (한국생활 게시판).
--
-- These are two ordinary posts (category='life', is_notice=true, created once
-- by scripts/create-pinned-form-posts.mjs) whose detail page shows a
-- structured input form instead of/alongside plain text. Submitting the form
-- creates ONE normal `comments` row (the card, parent_id null, body = a
-- plain-text fallback summary so it still reads fine anywhere comments are
-- listed generically, e.g. profile/comments) plus one row here holding the
-- structured fields, linked 1:1 via comment_id. Replies to a card are just
-- ordinary replies to that comment (parent_id = the card's comment id) --
-- no new reply mechanism needed at the DB layer.
--
-- Anonymity ("익명으로 올리기") must hold even against someone reading the raw
-- network response, not just in the UI, so the identity-bearing column
-- (user_id) is never exposed for an anonymous row. That can't be done with
-- RLS alone (RLS is all-or-nothing per row, not per column-and-condition), so
-- the base tables are locked to "owner reads/writes own rows only" and all
-- public reads go through a view that masks the identity columns with CASE
-- when is_anonymous. Views created like this (no security_invoker) run with
-- the view owner's privileges, which is what lets the view see every row
-- despite the base table's owner-only RLS -- the same mechanism already
-- relied on by get_my_points()/adjust_points() (0007/0008) to cross a
-- row-level restriction in a controlled way, just expressed as a view
-- instead of a SECURITY DEFINER function.

alter table posts add column pinned_form_type text
  check (pinned_form_type in ('salary', 'living_cost'));

-- ── salary_entries ("내 월급") ────────────────────────────────────────────
create table salary_entries (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  comment_id uuid not null unique references comments (id) on delete cascade,
  is_anonymous boolean not null default true,

  region_province text not null,
  region_city text not null,
  industry_main text not null check (
    industry_main in ('manufacturing', 'agriculture', 'fishery', 'construction', 'service', 'etc')
  ),
  industry_sub text not null,
  visa text not null check (
    visa in ('e9', 'e7', 'h2', 'f2_f5_f6', 'f4', 'd2_d4', 'etc')
  ),

  weekly_hours smallint not null check (weekly_hours > 0 and weekly_hours <= 100),
  monthly_days_off smallint not null check (monthly_days_off >= 0 and monthly_days_off <= 31),
  night_work text not null default 'none' check (night_work in ('none', 'sometimes', 'shift')),

  gross_pay integer not null check (gross_pay >= 0 and gross_pay <= 2000),
  overtime_included boolean not null default false,
  deduct_housing integer not null default 0 check (deduct_housing >= 0),
  deduct_food integer not null default 0 check (deduct_food >= 0),
  deduct_tax_insurance integer not null default 0 check (deduct_tax_insurance >= 0),
  deduct_other integer not null default 0 check (deduct_other >= 0),
  net_pay integer not null check (net_pay >= 0 and net_pay <= 2000),

  base_month date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (post_id, user_id, base_month)
);

create index salary_entries_post_idx on salary_entries (post_id, created_at desc);

-- ── living_cost_entries ("내 생활비") ─────────────────────────────────────
create table living_cost_entries (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  comment_id uuid not null unique references comments (id) on delete cascade,
  is_anonymous boolean not null default true,

  region_province text not null,
  region_city text not null,
  status text not null check (
    status in ('student', 'worker', 'marriage_migrant', 'etc')
  ),
  household text not null check (household in ('single', 'couple', 'with_children')),
  housing_type text not null check (
    housing_type in ('dorm', 'studio', 'share_room', 'goshiwon', 'with_family', 'etc')
  ),

  net_pay integer not null check (net_pay >= 0 and net_pay <= 2000),
  rent integer not null default 0 check (rent >= 0),
  utilities integer not null default 0 check (utilities >= 0),
  phone integer not null default 0 check (phone >= 0),
  transport integer not null default 0 check (transport >= 0),
  groceries integer not null default 0 check (groceries >= 0),
  eating_out integer not null default 0 check (eating_out >= 0),
  shopping integer not null default 0 check (shopping >= 0),
  other integer not null default 0 check (other >= 0),
  total_cost integer not null check (total_cost >= 0),
  -- remaining = net_pay - total_cost, can go negative (overspending), so no
  -- lower-bound check.
  remaining integer not null,

  base_month date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (post_id, user_id, base_month)
);

create index living_cost_entries_post_idx on living_cost_entries (post_id, created_at desc);

-- ── row level security ───────────────────────────────────────────────────
alter table salary_entries enable row level security;
alter table living_cost_entries enable row level security;

create policy "owner reads own salary entries" on salary_entries
  for select using (auth.uid() = user_id);
create policy "authenticated users create salary entries" on salary_entries
  for insert with check (auth.uid() = user_id);
create policy "owner updates own salary entries" on salary_entries
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "owner deletes own salary entries" on salary_entries
  for delete using (auth.uid() = user_id);

create policy "owner reads own living cost entries" on living_cost_entries
  for select using (auth.uid() = user_id);
create policy "authenticated users create living cost entries" on living_cost_entries
  for insert with check (auth.uid() = user_id);
create policy "owner updates own living cost entries" on living_cost_entries
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "owner deletes own living cost entries" on living_cost_entries
  for delete using (auth.uid() = user_id);

-- ── public (anonymity-safe) read views ───────────────────────────────────
-- Not security_invoker: runs as the view owner, so it can see every row
-- despite the base tables' owner-only RLS above. Every column that could
-- identify the author is nulled out when is_anonymous -- not just the
-- nickname, but user_id itself, since leaking the raw id would let someone
-- correlate it with the same user's non-anonymous activity elsewhere.
create view salary_entries_public as
select
  e.id,
  e.post_id,
  e.comment_id,
  c.is_deleted,
  e.is_anonymous,
  case when e.is_anonymous then null else e.user_id end as user_id,
  case when e.is_anonymous then null else p.nickname end as nickname,
  case when e.is_anonymous then null else p.avatar_url end as avatar_url,
  case when e.is_anonymous then null else p.country end as country,
  case when e.is_anonymous then false else p.is_withdrawn end as is_withdrawn,
  case when e.is_anonymous then false else p.is_supporter end as is_supporter,
  e.region_province,
  e.region_city,
  e.industry_main,
  e.industry_sub,
  e.visa,
  e.weekly_hours,
  e.monthly_days_off,
  e.night_work,
  e.gross_pay,
  e.overtime_included,
  e.deduct_housing,
  e.deduct_food,
  e.deduct_tax_insurance,
  e.deduct_other,
  e.net_pay,
  e.base_month,
  e.created_at,
  e.updated_at
from salary_entries e
join comments c on c.id = e.comment_id
join profiles p on p.id = e.user_id;

create view living_cost_entries_public as
select
  e.id,
  e.post_id,
  e.comment_id,
  c.is_deleted,
  e.is_anonymous,
  case when e.is_anonymous then null else e.user_id end as user_id,
  case when e.is_anonymous then null else p.nickname end as nickname,
  case when e.is_anonymous then null else p.avatar_url end as avatar_url,
  case when e.is_anonymous then null else p.country end as country,
  case when e.is_anonymous then false else p.is_withdrawn end as is_withdrawn,
  case when e.is_anonymous then false else p.is_supporter end as is_supporter,
  e.region_province,
  e.region_city,
  e.status,
  e.household,
  e.housing_type,
  e.net_pay,
  e.rent,
  e.utilities,
  e.phone,
  e.transport,
  e.groceries,
  e.eating_out,
  e.shopping,
  e.other,
  e.total_cost,
  e.remaining,
  e.base_month,
  e.created_at,
  e.updated_at
from living_cost_entries e
join comments c on c.id = e.comment_id
join profiles p on p.id = e.user_id;

grant select on salary_entries_public to anon, authenticated;
grant select on living_cost_entries_public to anon, authenticated;
