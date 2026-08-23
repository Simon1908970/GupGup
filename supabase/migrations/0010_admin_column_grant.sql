-- 0009 added profiles.is_admin, but 0008's column-level grant list was never
-- updated to include it. Selecting a column without a grant fails the whole
-- query with a Postgres permission error -- so every client-side profile
-- fetch that included is_admin (AuthProvider's own load/refresh) was
-- returning no profile at all, for every logged-in user, not just admins.

grant select (is_admin) on profiles to anon, authenticated;
