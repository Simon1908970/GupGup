# 환영봇(Welcome Bot) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 가입 직후 가벼운 환영 토스트(메시지①)와, 첫 글 작성 직후 포인트 규칙을
강제로 확인시키는 모달(메시지②)을 추가한다. 둘 다 `profiles` 테이블 플래그로
평생 1회만 노출한다.

**Architecture:** 기존 `AuthProvider`의 `profile` 컨텍스트에 플래그 2개
(`welcomed_at`, `points_ack_at`)를 추가하고, 두 신규 컴포넌트가 각각 자신이
마운트된 화면에서 그 플래그와 로그인 상태를 보고 스스로 렌더 여부를 결정한다.
언어는 기존 `useLanguage()`/`dictionaries.ts` i18n 체계를 그대로 재사용한다.

**Tech Stack:** Next.js (App Router, client components), Supabase JS client,
기존 `useAuth()`/`useLanguage()` 훅. 이 레포에는 React 컴포넌트 테스트 프레임워크가
없으므로(`package.json`의 `test`는 `node --test`로 `.test.mjs` 스크립트만 실행),
UI 컴포넌트의 "테스트" 단계는 전부 **개발 서버 + 브라우저 수동 검증**으로
대체한다. 순수 타입 레벨 검증은 `npx tsc --noEmit`으로 한다.

**Spec:** `docs/superpowers/specs/2026-10-25-welcome-bot-design.md`

## Global Constraints

- 두 메시지 모두 "평생 1회만" — DB 플래그(`profiles.welcomed_at`,
  `profiles.points_ack_at`)가 기준이며 세션/로컬스토리지로 대체하지 않는다.
- 언어는 기존 `LanguageProvider`의 시스템/브라우저 자동감지를 그대로 쓴다 —
  `country` 필드 기반 별도 언어 매핑을 새로 만들지 않는다.
- 메시지①은 비차단 토스트(닫기 가능/자동 소멸), 메시지②는 닫기 버튼 없이
  "이해했습니다"를 눌러야만 닫히는 forced-action 모달이다.
- 메시지②의 포인트 설명 내용은 기존 `points.infoTitle`/`points.infoBody`를
  그대로 재사용한다 — 포인트 규칙 자체는 변경하지 않는다.
- 플래그 업데이트가 네트워크 오류로 실패해도 사용자에게 에러를 노출하지 않고
  조용히 무시한다(재시도 로직 없음 — 다음 방문에 다시 뜰 수 있는 정도는 허용).
- 신규 번역 키(`welcome.greeting`, `welcome.firstPostThanks`,
  `welcome.understood`)는 11개 로케일(ko/en/vi/th/id/tl/lo/my/mn/ru/km) 전부에
  추가한다.

## Review Focus

- 다른 사람의 글을 열람할 때는 메시지②가 뜨면 안 된다(글쓴이가 자기 자신일 때만).
- 비로그인 상태(열람은 비로그인 가능)에서는 메시지①·② 모두 렌더링되지 않는다.
- `en` 로케일 블록은 `Dictionary`(전체 키 필수) 타입이므로, 신규 키를 `en`에
  빠뜨리면 `tsc`가 빌드를 깨뜨려야 한다 — 이 안전장치가 실제로 동작하는지 확인한다.
- 플래그 업데이트 네트워크 실패 시 UI가 멈추거나 에러 토스트/얼럿을 띄우지 않는다.
- 메시지②는 포인트 부족으로 글쓰기 자체가 막힌 경우(`insufficientPoints`)엔
  애초에 글이 생성되지 않으므로 뜨지 않는다 — `post`가 존재할 때만 모달을 평가하는
  가드로 자연히 보장된다.

---

### Task 1: DB 마이그레이션 (플래그 컬럼 + 쓰기 권한)

**Files:**
- Create: `supabase/migrations/0030_welcome_flags.sql`

**Interfaces:**
- Produces: `profiles.welcomed_at timestamptz` (nullable), `profiles.points_ack_at
  timestamptz` (nullable) — 이후 모든 태스크가 이 두 컬럼명을 그대로 쓴다.

- [ ] **Step 1: 마이그레이션 SQL 작성**

`0020_profiles_write_lockdown.sql`의 컬럼 단위 권한 패턴을 그대로 따른다:

```sql
alter table profiles
  add column welcomed_at timestamptz,
  add column points_ack_at timestamptz;

grant update (welcomed_at, points_ack_at) on profiles to anon, authenticated;
```

파일 상단에 용도를 설명하는 주석 1~2줄(두 컬럼이 각각 메시지①/②의 "1회만 노출"
플래그라는 것, null = 아직 안 봄)을 단다.

- [ ] **Step 2: 사용자에게 적용 요청**

이 레포 관례상 마이그레이션은 Supabase CLI가 아니라 **Supabase SQL 에디터에
수동으로 붙여넣어 적용**한다(CLAUDE.md 국가별 봇 섹션 참고). 이 태스크 완료
시점에 사용자에게 파일 내용을 보여주고 SQL 에디터에 적용해 달라고 요청한다.
Task 6의 브라우저 검증 전까지 적용되어 있으면 된다 — 이 태스크 자체를 막지는
않는다.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0030_welcome_flags.sql
git commit -m "feat(db): add welcome/points-ack flag columns to profiles"
```

---

### Task 2: AuthProvider에 신규 컬럼 반영

**Files:**
- Modify: `src/lib/auth/AuthProvider.tsx`

**Interfaces:**
- Consumes: Task 1의 `profiles.welcomed_at`, `profiles.points_ack_at`.
- Produces: `Profile.welcomed_at: string | null`, `Profile.points_ack_at: string |
  null` — Task 4/5가 `useAuth().profile.welcomed_at` /
  `.points_ack_at`로 그대로 읽는다.

- [ ] **Step 1: `Profile`, `ProfileRow` 인터페이스에 필드 추가**

`src/lib/auth/AuthProvider.tsx:14-30`의 두 인터페이스 각각에
`welcomed_at: string | null;`, `points_ack_at: string | null;`을 추가한다.

- [ ] **Step 2: `loadProfile`의 select 쿼리에 컬럼 추가**

`src/lib/auth/AuthProvider.tsx:79` select 문자열을
`"id, nickname, country, avatar_url, is_withdrawn, is_admin, welcomed_at,
points_ack_at"`로 바꾼다.

- [ ] **Step 3: `refreshProfile`의 select 쿼리에 컬럼 추가**

`src/lib/auth/AuthProvider.tsx:124` select 문자열을
`"id, nickname, country, avatar_url, is_admin, welcomed_at, points_ack_at"`로
바꾼다.

- [ ] **Step 4: 타입 체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음 (두 select가 반환하는 행이 `ProfileRow`/`Profile`과 필드가
일치해야 한다).

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth/AuthProvider.tsx
git commit -m "feat(auth): expose welcomed_at/points_ack_at on profile context"
```

---

### Task 3: i18n 신규 키 3개 × 11개 로케일

**Files:**
- Modify: `src/lib/i18n/dictionaries.ts`

**Interfaces:**
- Produces: `DictionaryKey`에 `"welcome.greeting"`, `"welcome.firstPostThanks"`,
  `"welcome.understood"` 3개 추가 — Task 4/5가 `t("welcome.greeting")` 등으로
  그대로 쓴다.

- [ ] **Step 1: `ko` 블록에 3개 키 추가 (파일 내 `points.infoBody` 바로 아래)**

```ts
"welcome.greeting": "가입을 환영합니다. 회원들과의 활발한 교류를 부탁드려요.",
"welcome.firstPostThanks": "첫 글을 작성해 주셔서 감사합니다.",
"welcome.understood": "이해했습니다",
```

- [ ] **Step 2: `en` 블록(`Dictionary`, 전체 키 필수)에 3개 키 추가**

```ts
"welcome.greeting": "Welcome to Gup Gup! We hope you'll connect and chat with other members.",
"welcome.firstPostThanks": "Thanks for writing your first post!",
"welcome.understood": "Got it",
```

- [ ] **Step 3: 나머지 9개 로케일(`vi/th/id/tl/lo/my/mn/ru/km`, 전부
  `Partial<Dictionary>`) 블록에 동일 3개 키를 각 언어로 추가 — 정확히 아래 값을
  쓴다(1차 AI 번역, 설계 문서의 "builder's call" 절 참고 — 추후 원어민 검수
  권장이며 이번 구현을 막지 않음)**

```ts
// vi
"welcome.greeting": "Chào mừng bạn đến với Gup Gup! Mong bạn giao lưu tích cực cùng các thành viên khác.",
"welcome.firstPostThanks": "Cảm ơn bạn đã viết bài đầu tiên!",
"welcome.understood": "Đã hiểu",

// th
"welcome.greeting": "ยินดีต้อนรับสู่ Gup Gup! หวังว่าคุณจะมีปฏิสัมพันธ์ที่ดีกับสมาชิกคนอื่น ๆ",
"welcome.firstPostThanks": "ขอบคุณที่เขียนโพสต์แรกของคุณ!",
"welcome.understood": "เข้าใจแล้ว",

// id
"welcome.greeting": "Selamat datang di Gup Gup! Semoga Anda dapat berinteraksi secara aktif dengan anggota lain.",
"welcome.firstPostThanks": "Terima kasih telah menulis postingan pertama Anda!",
"welcome.understood": "Saya mengerti",

// tl
"welcome.greeting": "Maligayang pagdating sa Gup Gup! Sana ay makipag-ugnayan ka nang aktibo sa ibang miyembro.",
"welcome.firstPostThanks": "Salamat sa pagsulat ng iyong unang post!",
"welcome.understood": "Nauunawaan ko",

// lo
"welcome.greeting": "ຍິນດີຕ້ອນຮັບສູ່ Gup Gup! ຫວັງວ່າທ່ານຈະມີປະຕິສຳພັນທີ່ດີກັບສະມາຊິກຄົນອື່ນ.",
"welcome.firstPostThanks": "ຂອບໃຈທີ່ຂຽນບົດຄວາມທຳອິດຂອງທ່ານ!",
"welcome.understood": "ເຂົ້າໃຈແລ້ວ",

// my
"welcome.greeting": "Gup Gup မှ ကြိုဆိုပါသည်! အခြားအဖွဲ့ဝင်များနှင့် တက်ကြွစွာ ဆက်သွယ်နိုင်ပါစေ။",
"welcome.firstPostThanks": "သင့်ပထမဆုံး ပို့စ်ကို ရေးသားပေးတဲ့အတွက် ကျေးဇူးတင်ပါသည်။",
"welcome.understood": "နားလည်ပါပြီ",

// mn
"welcome.greeting": "Gup Gup-д тавтай морил! Бусад гишүүдтэй идэвхтэй харилцаарай.",
"welcome.firstPostThanks": "Эхний нийтлэлээ бичсэнд баярлалаа!",
"welcome.understood": "Ойлголоо",

// ru
"welcome.greeting": "Добро пожаловать в Gup Gup! Надеемся, вы будете активно общаться с другими участниками.",
"welcome.firstPostThanks": "Спасибо за ваш первый пост!",
"welcome.understood": "Понятно",

// km
"welcome.greeting": "សូមស្វាគមន៍មកកាន់ Gup Gup! សង្ឃឹមថាអ្នកនឹងទាក់ទងយ៉ាងសកម្មជាមួយសមាជិកផ្សេងទៀត។",
"welcome.firstPostThanks": "អរគុណសម្រាប់ការសរសេរប្រកាសដំបូងរបស់អ្នក!",
"welcome.understood": "យល់ហើយ",
```

파일 자체에는 주석을 달지 않는다(기존 `points.infoBody` 번역들도 주석이 없다) —
위 `// vi` 등은 이 계획 문서 안에서 구분용일 뿐이다.

- [ ] **Step 4: 타입 체크 — `en` 누락 시 빌드가 깨지는지 확인(Review Focus 항목)**

Run: `npx tsc --noEmit`
Expected: 에러 없음. (일부러 `en` 블록에서 한 줄을 지워보고 `tsc`가
`Property '"welcome.xxx"' is missing in type ...`류 에러를 내는지 1회 확인한
뒤 되돌려도 좋다 — 안전장치 자체의 동작 확인.)

- [ ] **Step 5: Commit**

```bash
git add src/lib/i18n/dictionaries.ts
git commit -m "feat(i18n): add welcome bot copy in all 11 locales"
```

---

### Task 4: `WelcomeToast` 컴포넌트 + 홈 화면 연동

**Files:**
- Create: `src/components/common/WelcomeToast.tsx`
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: `useAuth()` → `{ user, profile, refreshProfile }` (Task 2),
  `useLanguage()` → `{ t }`, `t("welcome.greeting")` (Task 3), `createClient()`
  from `@/lib/supabase/client`.
- Produces: `<WelcomeToast />` — props 없음, 자기 완결형. `src/app/page.tsx`는
  그냥 마운트만 한다.

- [ ] **Step 1: `WelcomeToast` 구현**

`"use client"` 컴포넌트. 렌더 조건: `user && profile && !profile.welcomed_at`
(그 외엔 `null` 반환 — 비로그인/이미 본 경우 아무것도 안 그림, Review Focus
항목). 보여줄 때 화면 상단 고정 배너/토스트(기존 `PointsInfo`처럼
`var(--color-border-gray)` 보더 + 흰 배경 톤 맞추기)로 `t("welcome.greeting")`를
표시하고, X 버튼(또는 수 초 뒤 자동)으로 닫힌다. 닫힐 때
`supabase.from("profiles").update({ welcomed_at: new Date().toISOString() }).eq("id",
user.id)`를 호출하고 **실패해도 throw하지 않고 무시**(Global Constraints,
Review Focus)한 뒤 로컬 state로 즉시 숨기고 `refreshProfile()`을 호출한다.

- [ ] **Step 2: 홈 화면에 마운트**

`src/app/page.tsx`의 `Home` 컴포넌트가 반환하는 JSX 최상단 근처에
`<WelcomeToast />`를 추가하고, 파일 상단에 import를 추가한다.

- [ ] **Step 3: 타입 체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 4: 브라우저 수동 검증**

개발 서버(`npm run dev`)로 테스트 계정(DB에서 해당 유저의 `welcomed_at`을
`null`로 맞춰둔 상태) 로그인 → 홈 화면에서 토스트가 `welcome.greeting` 문구로
뜨는지 확인 → 닫기 → 새로고침해도 다시 안 뜨는지, `profiles.welcomed_at`이
채워졌는지 확인. 비로그인 상태로 홈 화면을 열었을 때는 아예 렌더되지 않는지도
확인(Review Focus).

- [ ] **Step 5: Commit**

```bash
git add src/components/common/WelcomeToast.tsx src/app/page.tsx
git commit -m "feat(onboarding): show one-time welcome toast after signup"
```

---

### Task 5: `FirstPostPointsModal` 컴포넌트 + 글 상세 화면 연동

**Files:**
- Create: `src/components/common/FirstPostPointsModal.tsx`
- Modify: `src/app/board/[category]/[postId]/page.tsx`

**Interfaces:**
- Consumes: `useAuth()` → `{ user, profile, refreshProfile }` (Task 2),
  `useLanguage()` → `{ t }`, `t("welcome.firstPostThanks")`,
  `t("points.infoTitle")`, `t("points.infoBody")`, `t("welcome.understood")`
  (Task 3), `createClient()`, `Post`/`Author` 타입(`src/lib/types.ts` — 이미
  존재, 수정 없음).
- Produces: `FirstPostPointsModal({ post }: { post: Post })` — 글 상세 페이지가
  이미 로드한 `post` state를 그대로 넘긴다.

- [ ] **Step 1: `FirstPostPointsModal` 구현**

`"use client"` 컴포넌트, props `{ post: Post }`. 렌더 조건: `user && profile &&
!profile.points_ack_at && post.author.id === user.id` (다른 사람 글이거나
비로그인·이미 확인함이면 `null` — Review Focus 두 항목). 보여줄 때
`PointsInfo.tsx`의 모달 스타일(`fixed inset-0 z-50 flex items-center
justify-center bg-black/40`, 중앙 흰 카드)을 그대로 따르되 **닫기 버튼 없이**
`t("welcome.firstPostThanks")` 제목 + `t("points.infoTitle")` 소제목 +
`t("points.infoBody")` 본문 + `t("welcome.understood")` 버튼만 둔다. 배경
클릭으로도 닫히지 않게 배경 div에 onClick을 달지 않는다. 버튼 클릭 시
`supabase.from("profiles").update({ points_ack_at: new Date().toISOString()
}).eq("id", user.id)`를 호출하고(실패해도 무시), 로컬 state로 즉시 숨긴 뒤
`refreshProfile()`을 호출한다.

- [ ] **Step 2: 글 상세 페이지에 연동**

`src/app/board/[category]/[postId]/page.tsx`의 `useAuth()` 구조분해에
`profile`을 추가한다(현재 `{ user, loading: authLoading, refreshProfile }`만
있음). JSX에서 `post`가 로드된 뒤(`post &&` 가드, 기존 `post === null`/`post ===
undefined` 처리 로직 아래) `<FirstPostPointsModal post={post} />`를 렌더한다.

- [ ] **Step 3: 타입 체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 4: 브라우저 수동 검증**

테스트 계정(`points_ack_at`을 `null`로 맞춰둔 상태)으로 아무 카테고리에나 글
작성 → 제출 후 이동한 게시글 상세 화면에서 모달이 자동으로 뜨는지, 배경
클릭/ESC로 안 닫히는지, "이해했습니다"를 눌러야 닫히는지 확인 → 같은 글이나
자신의 다른 글을 다시 봐도 안 뜨는지, `profiles.points_ack_at`이 채워졌는지
확인. **다른 사람이 쓴 글을 열람할 때는 뜨지 않는지**도 별도로 확인(Review
Focus).

- [ ] **Step 5: Commit**

```bash
git add src/components/common/FirstPostPointsModal.tsx \
  src/app/board/\[category\]/\[postId\]/page.tsx
git commit -m "feat(points): show forced points-rules modal after first post"
```

---

### Task 6: 전체 통합 검증

**Files:** 없음(검증 전용 — 코드 변경 없으면 커밋 없음)

**Interfaces:** 없음(이전 태스크 산출물을 조합해서 눈으로 확인하는 단계).

- [ ] **Step 1: Task 1의 마이그레이션이 실제 Supabase 프로젝트에 적용됐는지
  사용자에게 확인**

적용 안 됐으면 이 태스크를 더 진행하지 말고 사용자에게 적용을 요청한다(Task
1 Step 2에서 이미 요청했다면 여기서는 재확인만).

- [ ] **Step 2: 전체 타입체크 + 린트**

Run: `npx tsc --noEmit && npm run lint`
Expected: 둘 다 에러 없음.

- [ ] **Step 3: 비한국어 로케일에서 번역이 실제로 보이는지 확인**

개발 서버에서 헤더 지구본 아이콘으로 베트남어(또는 다른 로케일)로 전환한 뒤,
테스트 계정의 `welcomed_at`/`points_ack_at`을 다시 `null`로 돌려서 메시지①·②
둘 다 Task 3에서 넣은 번역 문구로 뜨는지(한국어로 폴백되지 않는지) 확인.

- [ ] **Step 4: 사용자에게 결과 보고**

스크린샷 또는 화면 설명으로 메시지①·② 각각의 동작을 보여주고 완료 보고.
