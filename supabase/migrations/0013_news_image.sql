-- Public bucket for news-article images (stock photos).
-- Uploads go through news-digest/publish-news.mjs with the service-role key,
-- which bypasses RLS; a public bucket serves reads with no storage.objects
-- policy (same as 0002_avatar_storage.sql).

insert into storage.buckets (id, name, public)
values ('news', 'news', true)
on conflict (id) do nothing;

alter table posts add column image_credit text;
