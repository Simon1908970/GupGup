-- Gup Gup (줍줍) initial schema
-- Run this in the Supabase SQL editor (or via `supabase db push`).

create extension if not exists "pgcrypto";

-- ── profiles ────────────────────────────────────────────────────────────
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nickname text not null unique,
  country text not null check (
    country in ('vn', 'th', 'la', 'id', 'mm', 'ph', 'mn', 'etc')
  ),
  avatar_url text,
  is_withdrawn boolean not null default false,
  created_at timestamptz not null default now()
);

create view public_profiles as
select
  id,
  case when is_withdrawn then '탈퇴한 회원입니다' else nickname end as nickname,
  country,
  case when is_withdrawn then null else avatar_url end as avatar_url,
  is_withdrawn,
  created_at
from profiles;

-- ── posts ───────────────────────────────────────────────────────────────
create table posts (
  id uuid primary key default gen_random_uuid(),
  category text not null check (
    category in (
      'news', 'community', 'housing', 'life',
      'marketplace', 'university', 'meeting'
    )
  ),
  sub_category text,
  country text not null check (
    country in ('vn', 'th', 'la', 'id', 'mm', 'ph', 'mn', 'etc')
  ),
  title text not null,
  body text not null,
  author_id uuid not null references profiles (id) on delete cascade,
  thumbnail_url text,
  view_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index posts_category_idx on posts (category, created_at desc);
create index posts_country_idx on posts (category, country, created_at desc);

-- ── comments ────────────────────────────────────────────────────────────
create table comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts (id) on delete cascade,
  author_id uuid not null references profiles (id) on delete cascade,
  parent_id uuid references comments (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index comments_post_idx on comments (post_id, created_at);

-- ── blocks ──────────────────────────────────────────────────────────────
create table blocks (
  blocker_id uuid not null references profiles (id) on delete cascade,
  blocked_id uuid not null references profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);

-- ── reports ─────────────────────────────────────────────────────────────
create table reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references profiles (id) on delete cascade,
  target_type text not null check (target_type in ('post', 'comment', 'user')),
  target_id uuid not null,
  reason text not null check (
    reason in ('spam', 'abuse', 'obscene', 'fraud', 'personal_info', 'etc')
  ),
  detail text,
  created_at timestamptz not null default now()
);

-- ── message threads / messages ─────────────────────────────────────────
create table message_threads (
  id uuid primary key default gen_random_uuid(),
  participant_a uuid not null references profiles (id) on delete cascade,
  participant_b uuid not null references profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (participant_a, participant_b)
);

create table messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references message_threads (id) on delete cascade,
  sender_id uuid not null references profiles (id) on delete cascade,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index messages_thread_idx on messages (thread_id, created_at);

-- ── inquiries (private 1:1 with operators) ────────────────────────────
create table inquiries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  title text not null,
  status text not null default 'pending' check (status in ('pending', 'answered')),
  created_at timestamptz not null default now()
);

create table inquiry_messages (
  id uuid primary key default gen_random_uuid(),
  inquiry_id uuid not null references inquiries (id) on delete cascade,
  sender_type text not null check (sender_type in ('user', 'admin')),
  sender_id uuid references profiles (id) on delete set null,
  body text not null,
  created_at timestamptz not null default now()
);

-- ── row level security ────────────────────────────────────────────────
alter table profiles enable row level security;
alter table posts enable row level security;
alter table comments enable row level security;
alter table blocks enable row level security;
alter table reports enable row level security;
alter table message_threads enable row level security;
alter table messages enable row level security;
alter table inquiries enable row level security;
alter table inquiry_messages enable row level security;

create policy "profiles are publicly readable" on profiles
  for select using (true);
create policy "users manage their own profile" on profiles
  for update using (auth.uid() = id);
create policy "users insert their own profile" on profiles
  for insert with check (auth.uid() = id);

create policy "posts are publicly readable" on posts
  for select using (true);
create policy "authenticated users create posts" on posts
  for insert with check (auth.uid() = author_id);
create policy "authors manage their own posts" on posts
  for update using (auth.uid() = author_id);
create policy "authors delete their own posts" on posts
  for delete using (auth.uid() = author_id);

create policy "comments are publicly readable" on comments
  for select using (true);
create policy "authenticated users create comments" on comments
  for insert with check (auth.uid() = author_id);
create policy "authors manage their own comments" on comments
  for update using (auth.uid() = author_id);
create policy "authors delete their own comments" on comments
  for delete using (auth.uid() = author_id);

create policy "users manage their own blocks" on blocks
  for all using (auth.uid() = blocker_id) with check (auth.uid() = blocker_id);

create policy "users create reports" on reports
  for insert with check (auth.uid() = reporter_id);
create policy "users view their own reports" on reports
  for select using (auth.uid() = reporter_id);

create policy "participants view their threads" on message_threads
  for select using (auth.uid() in (participant_a, participant_b));
create policy "participants create threads" on message_threads
  for insert with check (auth.uid() in (participant_a, participant_b));

create policy "participants view their messages" on messages
  for select using (
    auth.uid() in (
      select participant_a from message_threads where id = thread_id
      union
      select participant_b from message_threads where id = thread_id
    )
  );
create policy "participants send messages" on messages
  for insert with check (
    auth.uid() = sender_id
    and auth.uid() in (
      select participant_a from message_threads where id = thread_id
      union
      select participant_b from message_threads where id = thread_id
    )
  );

create policy "users view their own inquiries" on inquiries
  for select using (auth.uid() = user_id);
create policy "users create inquiries" on inquiries
  for insert with check (auth.uid() = user_id);

create policy "users view their own inquiry messages" on inquiry_messages
  for select using (
    auth.uid() in (select user_id from inquiries where id = inquiry_id)
  );
create policy "users send inquiry messages" on inquiry_messages
  for insert with check (
    sender_type = 'user'
    and auth.uid() in (select user_id from inquiries where id = inquiry_id)
  );

-- Admin/operator replies to inquiries and inquiry status changes are expected
-- to go through the Supabase service-role key from a trusted server context,
-- which bypasses RLS — no separate "admin" policy is defined here.
