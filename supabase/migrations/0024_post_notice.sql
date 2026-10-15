-- Admin-pinned posts (shown with a 📌 icon). A pinned post stays at the top of its
-- category list (and of its sub-category tab) regardless of the country
-- filter or sort order. It keeps its normal country tag.

alter table posts add column is_notice boolean not null default false;

create index posts_notice_idx on posts (category, created_at desc)
  where is_notice;

-- Re-create the insert policy from 0012 with the extra notice check.
drop policy "authenticated users create posts" on posts;
create policy "authenticated users create posts" on posts
  for insert with check (
    auth.uid() = author_id
    and (
      (category <> 'news' and not is_notice)
      or exists (
        select 1 from profiles p
        where p.id = auth.uid() and p.is_admin
      )
    )
  );

-- Authors may still update their own posts, but a non-admin cannot flip
-- is_notice on. (0001 had no WITH CHECK, so the USING clause applied.)
drop policy "authors manage their own posts" on posts;
create policy "authors manage their own posts" on posts
  for update
  using (auth.uid() = author_id)
  with check (
    auth.uid() = author_id
    and (
      not is_notice
      or exists (
        select 1 from profiles p
        where p.id = auth.uid() and p.is_admin
      )
    )
  );
