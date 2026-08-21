-- Points system: signup bonus, post/comment rewards, premium-category post cost,
-- and reversal on delete. Points_awarded on posts/comments records the exact
-- signed delta applied at creation time so deletion can reverse it precisely,
-- independent of the current reward rules.

alter table posts add column points_awarded integer not null default 0;
alter table comments add column points_awarded integer not null default 0;

-- Adjusts the CALLING user's own points by `delta`, clamped at 0 (points can
-- never go negative). Always operates on auth.uid() -- never takes a target
-- user id -- so RLS/ownership can't be bypassed by passing someone else's id.
create or replace function adjust_points(delta integer)
returns integer
language plpgsql
security invoker
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
