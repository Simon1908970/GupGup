-- Post likes: one row per (post, user). Used for the like button and for
-- ranking the homepage "인기 게시글" (popular posts) widget by likes + comments.
--
-- The app's shared POST_SELECT (src/lib/supabase/posts.ts) embeds
-- `likes:post_likes(count)` unconditionally, the same way 0013/0014 note for
-- image_credit/attachments -- so 0015 MUST be applied to production BEFORE
-- this code is deployed, or every post list/detail fetch site-wide 400s
-- with "Could not find a relationship between 'posts' and 'post_likes'".
create table post_likes (
  post_id uuid not null references posts (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create index post_likes_post_idx on post_likes (post_id);

alter table post_likes enable row level security;

create policy "likes are publicly readable" on post_likes
  for select using (true);
create policy "users like posts as themselves" on post_likes
  for insert with check (auth.uid() = user_id);
create policy "users remove their own like" on post_likes
  for delete using (auth.uid() = user_id);
