-- Adds a per-account admin flag and report resolution tracking. Admin
-- writes to other users' data go through the service-role key from
-- trusted server routes (see src/lib/supabase/adminAuth.ts), the same
-- pattern already used for inquiry replies -- no admin RLS policies
-- are added here.

alter table profiles add column is_admin boolean not null default false;

alter table reports add column status text not null default 'pending'
  check (status in ('pending', 'resolved'));
alter table reports add column resolved_at timestamptz;
