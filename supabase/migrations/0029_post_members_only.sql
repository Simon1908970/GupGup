-- Members-only posts: for sensitive topics (e.g. undocumented-stay Q&A) that
-- should not be shown to anonymous/logged-out visitors. Listing and detail
-- reads both go through the anon client, so this is enforced at the RLS
-- layer -- a logged-out viewer's query simply never receives the row.

alter table posts add column members_only boolean not null default false;

drop policy "posts are publicly readable" on posts;
create policy "posts are publicly readable" on posts
  for select using (not members_only or auth.uid() is not null);
