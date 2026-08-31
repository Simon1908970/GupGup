# 배포 가이드 (Vercel + Supabase)

이 문서는 Gup Gup(줍줍)을 **접근 제한 스테이징**으로 배포하는 절차다.
정식 공개 출시는 맨 아래 "정식 출시 전 체크리스트"를 먼저 끝낸 뒤에 한다.

- 앱: Next.js 16 (App Router) — Vercel이 프리셋 자동 인식, 별도 설정 파일 불필요
- DB/Auth/Storage: 기존 Supabase 프로젝트 그대로 사용 (스테이징도 같은 프로젝트를 쓸지,
  별도 프로젝트를 팔지는 "DB 분리" 항목 참고)
- 빌드 검증: `npx next build` 가 로컬에서 통과해야 한다 (현재 통과함)

---

## 0. 사전 준비

- GitHub 저장소: `github.com/Simon1908970/GupGup` (비공개 유지)
- Vercel 계정 (GitHub로 로그인 가능)
- Supabase 프로젝트 대시보드 접근 권한
- Google Cloud Console / Meta for Developers 접근 (OAuth 리다이렉트 URI 등록용)

---

## 1. GitHub에 push (사용자)

로컬 `master` 가 `origin/master` 보다 여러 커밋 앞서 있다. 배포는 원격 기준이므로 먼저 push.

```bash
git checkout master
git merge --ff-only fix/build-suspense-boundaries   # 이 브랜치 머지 후
git push origin master
```

> `.env.local` 은 `.gitignore` 에 잡혀 있어 커밋되지 않는다. 키는 절대 커밋하지 말 것.

---

## 2. Vercel 프로젝트 생성 (사용자)

1. vercel.com → **Add New… → Project** → `Simon1908970/GupGup` import
2. Framework Preset: **Next.js** (자동 감지). Build Command / Output 은 기본값 그대로.
3. **Root Directory**: 저장소 루트 (그대로)
4. 일단 **Deploy** 누르지 말고 먼저 3번(환경변수)까지 채운 뒤 배포한다.
   (환경변수 없이 배포하면 첫 빌드는 되지만 런타임에서 Supabase 접속이 전부 실패한다.)

---

## 3. 환경변수 (사용자 — 값 직접 입력)

Vercel 프로젝트 → **Settings → Environment Variables**. Production / Preview 둘 다 체크.

| 이름 | 값 출처 | 종류 | 비고 |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → Project URL | 공개 | 브라우저에 노출됨 (정상) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → API → `anon` `public` key | 공개 | 브라우저에 노출됨 (정상) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → API → `service_role` key | **비밀** | `NEXT_PUBLIC_` 접두어 절대 붙이지 말 것 — 서버 전용. 관리자 API 라우트가 사용 |
| `TRANSLATE_API_KEY` | Google Cloud → Cloud Translation API 키 | **비밀** | `/api/translate` 라우트 서버 전용 |

- `NAVER_SEARCH_CLIENT_ID` / `NAVER_SEARCH_CLIENT_SECRET` 은 **설정하지 않는다** —
  로컬 `news-digest/` 스크립트 전용이고 웹 앱은 쓰지 않는다.
- 값 입력 후 저장하면 다음 배포부터 반영된다. 이미 배포했다면 **Redeploy** 필요.

---

## 4. Supabase Auth 설정 (사용자)

배포 도메인이 생기면 (예: `gupgup-staging.vercel.app`, 그리고 프리뷰용 와일드카드) 등록한다.

### 4-1. Supabase → Authentication → URL Configuration

- **Site URL**: `https://<프로덕션 도메인>`  (예: `https://gupgup-staging.vercel.app`)
- **Redirect URLs** (여러 개 허용, 줄바꿈으로 추가):
  ```
  https://<프로덕션 도메인>/auth/callback
  https://*-<vercel-scope>.vercel.app/auth/callback
  http://localhost:3000/auth/callback
  ```
  마지막 줄은 로컬 개발용. 와일드카드는 Vercel 프리뷰 배포용.

> 앱 코드(`src/app/login/page.tsx`)는 `redirectTo: ${window.location.origin}/auth/callback`
> 로 현재 도메인을 그대로 쓴다. 그래서 Supabase에 도메인만 허용 목록에 넣으면 된다.

### 4-2. 소셜 provider 리다이렉트 URI

- **Google**: Google Cloud Console → 사용자 인증 정보 → OAuth 2.0 클라이언트 →
  "승인된 리디렉션 URI" 에 `https://<Supabase 프로젝트>.supabase.co/auth/v1/callback` 추가
  (Supabase가 중계하므로 Vercel 도메인이 아니라 Supabase 콜백 URL이다)
- **Facebook**: Meta for Developers → 앱 → Facebook 로그인 → 설정 →
  "유효한 OAuth 리디렉션 URI" 에 동일하게 `https://<Supabase 프로젝트>.supabase.co/auth/v1/callback`
- 두 provider의 Client ID / Secret 은 Supabase → Authentication → Providers 에 이미 넣어둔 값을 재사용

### 4-3. 이메일 인증

- Supabase → Authentication → Providers → Email → "Confirm email" 켜짐 유지
- Authentication → Emails 의 확인 메일 템플릿 링크가 Site URL 기준으로 나가는지 확인

---

## 5. 배포 보호 (사용자) — 스테이징 비공개 유지

Vercel → 프로젝트 → **Settings → Deployment Protection**

- **Vercel Authentication** 또는 **Password Protection** 을 **Production + Preview** 에 적용
- 이러면 URL을 알아도 비밀번호/로그인 없이는 사이트에 못 들어온다 →
  검색 노출·무단 가입·스팸을 출시 준비 끝날 때까지 차단

---

## 6. 첫 배포 + 스모크 테스트

1. 환경변수·Auth 설정 끝난 뒤 Vercel에서 **Deploy** (또는 `master` 에 push하면 자동)
2. 빌드 로그에 `✓ Compiled successfully` / `Generating static pages` 확인
3. 배포 URL 접속 (배포 보호 비밀번호 입력) 후:
   - [ ] 메인 화면 카테고리 박스 로드 (Supabase 연결 OK)
   - [ ] `/board/community` 목록 + 국가 필터 + 검색 동작
   - [ ] 게시글 상세 열람, "번역하기" 동작 (다른 언어로 전환해도 정상)
   - [ ] Google / Facebook 로그인 왕복 (`/auth/callback` 리다이렉트 성공)
   - [ ] 이메일 회원가입 → 인증 메일 수신 → 온보딩(닉네임/국가)
   - [ ] 로그인 후 글쓰기 / 댓글
   - [ ] `is_admin` 계정으로 `/admin` 접근, `/admin/news` 에서 뉴스 등록/삭제
   - [ ] 비관리자 계정으로 `/board/news/write` 직접 접근 → "카테고리를 찾을 수 없습니다"
         (마이그레이션 `0012` 적용 확인)

---

## DB 마이그레이션

- `supabase/migrations/*.sql` 은 **수동 적용**이다 (Supabase CLI 연동 안 돼 있음).
  Supabase SQL Editor 에서 **번호 순서대로** 실행한다.
- 현재까지: `0001` ~ `0012` (프로덕션 DB에 `0011`, `0012` 적용 완료됨).
- 앞으로 새 마이그레이션을 추가하면 → 커밋 + **배포 전에** 프로덕션 DB에 실행할 것.
  코드가 없는 컬럼/정책을 참조하면 런타임 에러가 난다.

### DB 분리 여부

- 지금은 로컬 개발과 스테이징이 **같은 Supabase 프로젝트**를 쓰게 된다.
  스테이징에서 만든 글·회원이 곧 실데이터가 된다는 뜻.
- 깨끗하게 가려면 Supabase 프로젝트를 하나 더 만들어 스테이징 전용으로 쓰고,
  Vercel 환경변수를 그쪽으로 지정한다. 마이그레이션 `0001~` 전부 새로 실행 필요.
- 판단은 출시 계획에 맡긴다. 분리하면 안전하지만 관리 포인트가 2배가 된다.

---

## 정식 출시 전 체크리스트

CLAUDE.md 기준 미완 항목 + 배포 관점 항목:

- [ ] 이용약관 / 개인정보처리방침 실제 내용 확정 (`/terms`, `/privacy` 페이지는 있음)
- [ ] "만남" 카테고리 정책 + 신고 처리 프로세스 문서화 (법률 자문)
- [ ] 신고 접수 후 운영자 처리 플로우
- [ ] "주택" 하위 항목 확정
- [ ] 커스텀 도메인 연결 (Vercel → Domains) + Supabase Site URL / Redirect URL 갱신
- [ ] Deployment Protection 해제 (또는 Preview만 유지, Production 공개)
- [ ] Supabase 요금제 / 백업 정책 확인 (무료 티어 한도, PITR)
- [ ] Google/Facebook OAuth 앱을 "테스트" → "프로덕션" 상태로 전환, 도메인 검증
- [ ] 에러 모니터링 (Vercel 로그 / Sentry 등) 도입 여부 결정
- [ ] `robots.txt` / 색인 정책 (스테이징은 `noindex`, 프로덕션은 허용)
