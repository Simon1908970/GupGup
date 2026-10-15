-- 0025 added profiles.is_supporter, but 0008's column-level grant list was
-- never updated to include it -- the same class of bug 0010 fixed for
-- is_admin. Selecting a column without a grant fails the whole query with a
-- Postgres permission error, so every post/comment list that embeds
-- author:profiles(..., is_supporter) returns nothing (permission denied for
-- table profiles) for anon and authenticated alike. Verified live: every
-- board list page was broken by this since 0025 was applied.

grant select (is_supporter) on profiles to anon, authenticated;
