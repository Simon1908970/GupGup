-- 0030 added welcomed_at/points_ack_at as null on every existing row. Both
-- components trigger on "flag is null", so without a backfill every
-- existing user would see the "가입을 환영합니다" toast on their next
-- homepage visit, and every existing user who has ever posted would hit
-- the blocking "첫 글을 작성해 주셔서 감사합니다" modal the next time they
-- open one of their own old posts -- neither message is true for them.
--
-- Run this once, right before this code is deployed (not before -- it
-- backfills everyone as of whenever it's run, so new signups between now
-- and deploy would otherwise be wrongly backfilled too). Existing users
-- are marked as already welcomed. Existing users who have never posted
-- are left with points_ack_at = null on purpose, so the modal still
-- teaches them the points rules on their real first post.
update profiles set welcomed_at = now() where welcomed_at is null;

update profiles set points_ack_at = now()
  where points_ack_at is null
    and exists (select 1 from posts p where p.author_id = profiles.id);
