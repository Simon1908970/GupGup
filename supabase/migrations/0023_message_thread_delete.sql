-- "내 글" 목록에는 삭제가 있는데 쪽지함에는 없다는 피드백으로 추가.
-- message_threads는 두 참여자가 공유하는 행이라, 한쪽이 지운다고 상대방 쪽
-- 기록까지 같이 사라지면 신고/분쟁 증빙 목적에 문제가 생긴다. 그래서 하드
-- 삭제 대신 "내 쪽에서만 숨김" 타임스탬프를 둔다. 숨긴 뒤 상대가 새 메시지를
-- 보내면(= 마지막 메시지 시각이 내 삭제 시각보다 나중이면) 다시 목록에 나타난다.
--
-- 참여자 A가 실수로 B의 deleted_by_b_at을 바꿔버리는 걸 막기 위해, 테이블
-- UPDATE를 직접 열어주는 대신 auth.uid()로 자기 쪽 컬럼만 건드리는
-- SECURITY DEFINER 함수 하나만 노출한다 (adjust_points와 동일한 패턴).

alter table message_threads add column deleted_by_a_at timestamptz;
alter table message_threads add column deleted_by_b_at timestamptz;

create or replace function delete_my_thread(p_thread_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update message_threads
  set deleted_by_a_at = case when participant_a = auth.uid() then now() else deleted_by_a_at end,
      deleted_by_b_at = case when participant_b = auth.uid() then now() else deleted_by_b_at end
  where id = p_thread_id
    and (participant_a = auth.uid() or participant_b = auth.uid());
end;
$$;

revoke execute on function delete_my_thread(uuid) from public;
grant execute on function delete_my_thread(uuid) to authenticated;
