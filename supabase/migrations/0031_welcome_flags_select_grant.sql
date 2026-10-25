-- 0030은 welcomed_at/points_ack_at에 UPDATE 권한만 열고 SELECT 권한을 빠뜨렸다.
-- 이 프로젝트는 profiles의 SELECT를 컬럼 단위로 관리하므로(0008/0010/0026과 동일
-- 패턴), 새 컬럼도 명시적으로 열어주지 않으면 로그인 유저 본인도 그 값을 읽지
-- 못해 전체 select가 조용히 실패한다(AuthProvider가 에러를 무시하고 profile을
-- null로 둠 -- 실제로 로컬에서 재현/확인함).
grant select (welcomed_at, points_ack_at) on profiles to anon, authenticated;
