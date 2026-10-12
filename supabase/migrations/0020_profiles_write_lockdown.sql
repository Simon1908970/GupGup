-- 0001 granted table-wide UPDATE/INSERT on profiles to anon/authenticated
-- (same default-privilege pattern 0008 found for SELECT). A column-level
-- REVOKE can't override a table-wide grant, so despite RLS policy "users
-- manage their own profile" being scoped to the caller's own row, any user
-- could PATCH their own profiles.points to an arbitrary value via the REST
-- API, completely bypassing adjust_points()/get_my_points(). No app code
-- updates points directly -- every write goes through adjust_points() -- so
-- closing UPDATE on points is a pure lockdown with no functional change.
--
-- INSERT has the same exposure at signup: src/app/onboarding/page.tsx posts
-- `points: SIGNUP_BONUS` directly in its profiles insert (there's no
-- security-definer "create profile" RPC), so a crafted request could set an
-- arbitrary initial balance instead of the real signup bonus. Since the
-- insert can't be routed through a function without a larger app change, the
-- bonus amount is enforced here instead, at the RLS layer.
--
-- NOTE: 2000 below must be kept in sync with SIGNUP_BONUS in
-- src/lib/constants/points.ts.

revoke update on profiles from anon, authenticated;

grant update (nickname, country, avatar_url, is_withdrawn)
  on profiles to anon, authenticated;

drop policy "users insert their own profile" on profiles;
create policy "users insert their own profile" on profiles
  for insert with check (auth.uid() = id and points = 2000);
