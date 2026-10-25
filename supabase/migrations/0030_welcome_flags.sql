-- 환영봇: 가입 직후 환영 토스트(welcomed_at)와 첫 글 작성 후 포인트 안내
-- 모달(points_ack_at)을 "평생 1회만" 보여주기 위한 플래그. null = 아직 안 봄.
alter table profiles
  add column welcomed_at timestamptz,
  add column points_ack_at timestamptz;

-- 0020에서 UPDATE를 컬럼 단위로 잠가뒀으므로(grant update (nickname, country,
-- avatar_url, is_withdrawn)), 새 컬럼도 명시적으로 열어줘야 클라이언트에서 쓸 수
-- 있다. 단순 "읽음" 플래그라 points처럼 서버 검증이 필요 없어 RPC 없이 바로 연다.
grant update (welcomed_at, points_ack_at) on profiles to anon, authenticated;
