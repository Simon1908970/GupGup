-- 0007 tried to block direct reads of profiles.points via a column-level
-- REVOKE, but Supabase grants whole-table SELECT to anon/authenticated by
-- default, and that table-wide grant still covers every column no matter
-- what a narrower column-level REVOKE says. Verified live: a second user was
-- still able to read another user's points directly after 0007. Fix: revoke
-- the whole-table SELECT and re-grant only the columns meant to be public,
-- leaving `points` reachable solely through get_my_points()/adjust_points()
-- (SECURITY DEFINER, hardcoded to auth.uid()).

revoke select on profiles from anon, authenticated;

grant select (id, nickname, country, avatar_url, is_withdrawn, created_at)
  on profiles to anon, authenticated;
