# Gup Gup (줍줍)

한국에 거주하는 외국인을 위한 커뮤니티 웹앱. 스펙은 [CLAUDE.md](./CLAUDE.md) 참고.

## 기술 스택

- Next.js 16 (App Router, TypeScript, Tailwind CSS v4)
- Supabase (Auth / Postgres / Storage)

## 현재 상태

공통 레이아웃, 메인 화면, 게시판 목록/작성/상세/댓글, 닉네임 팝업(프로필·쪽지·차단·신고), 로그인/회원가입/온보딩, 프로필, 쪽지함, 문의사항, 다국어 UI(9개 언어)까지 화면과 컴포넌트가 구현되어 있습니다. 게시글/댓글/쪽지/문의 데이터는 아직 `src/lib/mock/`의 목업 데이터로 동작하며, 아래 Supabase 설정을 마치면 실제 데이터로 전환할 수 있습니다.

## 시작하기

```bash
npm install
npm run dev
```

http://localhost:3000 에서 확인할 수 있습니다.

## Supabase 연동

1. [supabase.com](https://supabase.com)에서 프로젝트를 생성합니다.
2. `.env.local.example`을 복사해 `.env.local`을 만들고, Supabase 프로젝트의 API 설정 값을 채웁니다.
   ```bash
   cp .env.local.example .env.local
   ```
3. Supabase SQL Editor에서 [`supabase/migrations/0001_init.sql`](./supabase/migrations/0001_init.sql)을 실행해 테이블/RLS 정책을 생성합니다.
4. Supabase 대시보드 Authentication 설정에서 Google, Facebook 소셜 로그인 Provider를 활성화하고, 이메일 인증(Confirm email)을 켭니다.
5. 개발 서버를 재시작하면 로그인/회원가입/프로필/게시글 작성 등이 목업이 아닌 실제 Supabase 데이터로 동작합니다.

`.env.local`이 없어도 앱 자체는 목업 데이터로 정상 실행됩니다(로그인 관련 기능만 비활성화됨).

## 아직 목업/미구현 상태인 부분

- 게시글 작성 시 실제 DB insert (현재는 UI만 존재, `TODO` 주석 참고)
- 이미지 업로드 (Supabase Storage 연동 필요)
- 번역 API 연동 (현재 "번역 보기"는 placeholder)
- 쪽지함/문의사항의 실시간 동기화
- 신고 접수 후 운영자 처리 프로세스 (관리자 화면 별도 필요)
