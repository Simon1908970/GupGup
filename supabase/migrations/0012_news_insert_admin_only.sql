-- News posts are operator-only. The 0001 insert policy let any authenticated
-- user insert any category; restrict category='news' to admins. profiles.is_admin
-- is SELECT-granted to authenticated (0010) and profiles SELECT RLS is using(true),
-- so the subquery is evaluable from the anon/authenticated context. The
-- service-role client used by POST /api/admin/news bypasses RLS and is unaffected.
drop policy "authenticated users create posts" on posts;
create policy "authenticated users create posts" on posts
  for insert with check (
    auth.uid() = author_id
    and (
      category <> 'news'
      or exists (
        select 1 from profiles p
        where p.id = auth.uid() and p.is_admin
      )
    )
  );
