-- 조회수 증가는 지금까지 클라이언트에서 posts.update({view_count: ...})를 직접 호출했는데,
-- "authors manage their own posts" UPDATE 정책(0001)이 author_id = auth.uid()만 허용해서
-- 글쓴이 본인이 자기 글을 볼 때 말고는 전부 RLS에 막혀 조용히 실패했다(에러가 클라이언트
-- 코드에서 버려짐 — src/lib/supabase/posts.ts의 incrementViewCount 참고). view_count 컬럼
-- 하나만, 원자적으로(동시 조회 시 덮어쓰기 경쟁 조건도 같이 해결) 올리는 SECURITY DEFINER
-- 함수로 RLS를 우회시킨다.

create or replace function increment_post_view_count(post_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update posts set view_count = view_count + 1 where id = post_id;
$$;

grant execute on function increment_post_view_count(uuid) to anon, authenticated;
