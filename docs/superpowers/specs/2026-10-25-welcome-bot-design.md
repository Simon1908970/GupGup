# 환영봇(Welcome Bot) 설계 문서

- 날짜: 2026-10-25
- 상태: 설계 승인됨 → 구현 진행
- 관련 코드: `src/lib/auth/AuthProvider.tsx`, `src/app/onboarding/page.tsx`,
  `src/app/board/[category]/write/page.tsx`, `src/components/common/PointsInfo.tsx`,
  `src/lib/i18n/dictionaries.ts`, `supabase/migrations/`

## 배경 / 목적

신규 가입자(특히 한국어가 모국어가 아닌 외국인 유저)가 ① 가입 직후 커뮤니티에
대한 환영을 받고, ② 첫 글을 쓸 때 포인트 적립/차감 규칙(`PointsInfo.tsx`에 이미
구현되어 있는 내용)을 반드시 한 번은 읽고 넘어가도록 하기 위한 "환영봇" 2종을
추가한다.

대화를 통해 정리된 핵심 방향:
1. 메시지는 **1종이 아니라 2종**이다 — 가입 직후의 가벼운 환영 인사와, 첫 글
   작성 직후의 포인트 안내는 무게감이 달라서 보여주는 모양도 달라야 한다.
2. 언어는 **기존 `LanguageProvider`의 시스템/브라우저 언어 자동감지 메커니즘을
   그대로 재사용**한다. 가입 시 설정하는 `country`(게시글 필터용 필드)를 기준으로
   별도의 언어 매핑을 새로 만들지 않는다 — 이미 전체 UI가 시스템 언어를 따르고
   있고, 포인트 설명(`points.infoTitle`/`points.infoBody`)도 11개 로케일 전부
   번역이 끝나 있으므로 그대로 재사용하면 된다.
3. 두 메시지 모두 **평생 1회만** 노출한다. 세션/로컬스토리지가 아니라
   `profiles` 테이블에 플래그를 저장해 다른 기기로 로그인해도 다시 뜨지 않게 한다.
4. 메시지②는 포인트 규칙을 모르면 실제 손해(포인트 차감/작성 제한)로 이어질 수
   있는 "고위험 순간"이므로, 닫기 버튼 없이 "이해했습니다"를 눌러야만 닫히는
   강제 확인(forced-action) 모달로 간다. 메시지①은 그 정도 무게가 아니므로
   가벼운 토스트/배너로 충분하다.

## 범위

**포함**
1. `profiles`에 `welcomed_at timestamptz`, `points_ack_at timestamptz` 컬럼 추가
   (마이그레이션 `0030_welcome_flags.sql`). 두 컬럼 모두 기본값 `null` = "아직 안 봄".
2. 기존 컬럼 단위 쓰기 잠금(`0020_profiles_write_lockdown.sql`)에 맞춰, 이 두
   컬럼에 대한 `grant update`를 추가로 연다(유저가 자기 행만 수정 가능한 기존 RLS
   정책은 그대로 사용 — `points`처럼 서버 검증이 필요한 값이 아니라 단순 "읽음"
   플래그라 RPC 없이 클라이언트 직접 업데이트로 충분).
3. `AuthProvider.tsx`의 `Profile`/`ProfileRow` 타입과 두 군데(`loadProfile`,
   `refreshProfile`) select 쿼리에 두 컬럼 추가.
4. **메시지①(가입 환영)** — `WelcomeToast` 컴포넌트
   - 트리거: `/onboarding` 제출 성공 후 `/`로 이동했을 때, `profile.welcomed_at`이
     `null`이면 노출.
   - 형태: 화면 상단 토스트/배너. 비차단, X로 닫거나 몇 초 뒤 자동으로 사라짐.
   - 문구(신규 키 `welcome.greeting`): "가입을 환영합니다. 회원들과의 활발한
     교류를 부탁드려요." — 11개 로케일 번역.
   - 닫힐 때(또는 자동 소멸 시) `profiles.welcomed_at = now()` 업데이트.
5. **메시지②(첫 글 작성 후 포인트 안내)** — `FirstPostPointsModal` 컴포넌트
   - 트리거: 글쓰기 제출 성공 → 게시글 상세로 redirect 직후,
     `profile.points_ack_at`이 `null`이면 노출(카테고리 무관 — 사실상 첫 성공
     포스팅에서만 뜬다).
   - 형태: 화면 중앙 모달. 배경 클릭/ESC/닫기 버튼으로 닫히지 않고, "이해했습니다"
     버튼을 눌러야만 닫힘(`PointsInfo.tsx`의 모달 스타일 재사용).
   - 문구: 신규 키 `welcome.firstPostThanks`("첫 글을 작성해 주셔서
     감사합니다.") + 기존 `points.infoTitle`/`points.infoBody` 그대로 재사용 +
     신규 버튼 키 `welcome.understood`("이해했습니다").
   - 버튼 클릭 시 `profiles.points_ack_at = now()` 업데이트.
6. 신규 i18n 키 3개(`welcome.greeting`, `welcome.firstPostThanks`,
   `welcome.understood`) × 11개 로케일을 `dictionaries.ts`에 추가.

**제외 (YAGNI / 이번 범위 아님)**
- 가입 `country` 필드 기준 언어 매핑 신설 — 시스템 언어 감지로 충분하다고 확인됨.
- 포인트 제도 자체의 규칙 변경 — `PointsInfo.tsx`의 기존 내용을 그대로 재사용.
- AI 자동 댓글/활동 봇(국가별 커뮤니티 봇과는 별개 주제) — 이번 작업과 무관.
- 메시지 이력 관리 화면, 관리자 설정(문구를 운영자가 바꿀 수 있게 하는 기능) 등.
- 플래그 업데이트 실패 시 재시도 로직 — 1회성 안내라 실패해도 치명적이지 않으므로
  조용히 무시한다(네트워크 에러 시 다음 방문에 다시 한번 뜰 수 있음, 허용 가능한
  리스크로 판단).

## 내 판단으로 결정한 것(builder's call)

- 토스트의 정확한 위치/애니메이션/지속시간, 모달의 Tailwind 클래스 디테일은
  기존 `PointsInfo.tsx`/헤더 컴포넌트 스타일을 따라 구현 시점에 정한다.
- 신규 i18n 문구 10개 언어(en/vi/th/id/tl/lo/my/mn/ru/km) 번역은 AI가 1차
  초안을 작성한다 — `points.infoBody` 기존 번역과 마찬가지로 추후 원어민 검수를
  권장하되, 이번 구현을 막는 조건은 아니다.
- 메시지②는 "첫 글"이라는 표현을 쓰지만 실제 구현은 카테고리 무관 "포인트 안내를
  아직 확인 안 한 상태에서 올린 첫 글"을 기준으로 한다(두 번째 글부터는 안 뜸).
