-- Points must be visible only to the account owner -- not just hidden in the
-- UI, but actually unreadable by other users at the database level. RLS is
-- row-level only (it can't restrict one column while allowing the rest of
-- the same row), so column-level access to `points` is closed with REVOKE,
-- and all point reads/writes go through SECURITY DEFINER functions that
-- hardcode auth.uid() -- they take no target-user parameter, so no row but
-- the caller's own can ever be read or changed.

revoke select (points) on profiles from anon, authenticated;

create or replace function get_my_points()
returns integer
language sql
security definer
set search_path = public
stable
as $$
  select points from profiles where id = auth.uid();
$$;

grant execute on function get_my_points() to authenticated;

create or replace function adjust_points(delta integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_points integer;
begin
  update profiles
  set points = greatest(points + delta, 0)
  where id = auth.uid()
  returning points into new_points;
  return new_points;
end;
$$;

grant execute on function adjust_points(integer) to authenticated;
