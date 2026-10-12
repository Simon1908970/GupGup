-- 0010 granted SELECT on profiles.is_admin to anon/authenticated, fixing the
-- exact bug where a missing column grant makes the client's whole profile
-- query fail (AuthProvider.loadProfile selects is_admin alongside the rest).
-- A production audit during launch smoke-testing (2026-10-12) found this
-- grant missing again -- cause unclear (not reintroduced by any migration
-- in this repo) -- which was silently turning every logged-in user's
-- `profile` into null, hiding the admin menu link and falsely showing
-- "complete your profile first" on the write page. Re-asserting it here;
-- safe to run even if already present.

grant select (is_admin) on profiles to anon, authenticated;
