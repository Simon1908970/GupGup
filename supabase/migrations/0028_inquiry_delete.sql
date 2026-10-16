-- 문의사항 삭제 버튼 추가. inquiries는 message_threads처럼 양쪽이 공유하는
-- 행이 아니라 user_id 단독 소유라서, posts의 "authors delete their own posts"와
-- 같은 패턴의 하드 삭제 정책으로 충분하다. inquiry_messages는 inquiries.id FK에
-- on delete cascade가 걸려 있어 함께 삭제된다. 운영자 삭제는 다른 admin 라우트와
-- 동일하게 서비스 롤 키로 RLS를 우회하므로 별도 정책이 필요 없다.

create policy "users delete their own inquiries" on inquiries
  for delete using (auth.uid() = user_id);
