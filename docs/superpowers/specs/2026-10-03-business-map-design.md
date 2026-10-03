# 업체 지도(Business Map) 설계 문서

- 날짜: 2026-10-03
- 상태: 설계 승인됨 (스펙 검토 대기 → 구현 계획)
- 관련 코드: `src/app/page.tsx`, `src/components/layout/CategoryNav.tsx`,
  `src/app/board/[category]/write/page.tsx`, `src/lib/supabase/posts.ts`,
  `src/lib/constants/`, `src/lib/i18n/dictionaries.ts`, `src/app/admin/`,
  `supabase/migrations/`

## 배경 / 목적

Gemini와의 대화에서 출발한 아이디어: 한국에 거주하는 외국인을 위한 "업체 지도"를
만들고 싶다는 요청. 원안은 베트남 전용이었으나, 줍줍은 이미 7개국(+기타/한국) 국가
필터 체계(`CountryCode`)로 모든 대상 국가를 동등하게 다루는 구조라서, 베트남에
한정하지 않고 **국가 탭으로 전환되는 범용 업체 지도**로 범위를 넓혔다.

대화를 통해 정리된 핵심 방향:
1. 업체 데이터는 **카카오 로컬 API로 수집**(네이버/카카오맵 크롤링은 약관 위반 —
   공식 API만 사용), **구글 Maps JS SDK로 화면에 표시**. 소스와 표시 레이어를
   분리해 각 API의 역할을 명확히 한다.
2. 메인 화면 카테고리 그리드 **위**에 국가 탭 + 지도 위젯을 올리고, 헤더 메뉴바에도
   "지도" 항목을 추가해 전용 `/map` 페이지로 연결한다.
3. 운영자가 수집한 업체 데이터만으로는 부족하므로, **한국생활(life) 카테고리**
   글쓰기 화면에 "업체 위치를 지도에 표시합니다" 체크박스를 추가해 회원이 직접
   올리는 글도 지도 핀으로 연동한다(다른 카테고리는 적용하지 않음).
4. 주소는 자유 텍스트가 아니라 **다음(Daum) 우편번호 검색 팝업**으로 선택하게 해
   지오코딩 정확도를 보장하고, 상세주소(동/호수)는 핀 좌표에 영향 없는 선택 필드로
   분리한다.
5. 구글 지도 타일 자체를 국가 탭마다 다른 언어로 바꾸는 것은 검토했으나 **채택하지
   않음** — 한국 도로명 데이터는 어차피 대부분 한국어/영어로만 존재해 체감 효과가
   적고, 탭 전환마다 지도를 통째로 리로드해야 해 깜빡임이 생긴다. 지도 타일은
   한국어로 고정하고, 탭 라벨·핀 정보창 등 사이트 자체 UI만 헤더 지구본 언어를
   따른다.

## 범위

**포함**
1. `businesses` 테이블 신설(카카오 수집 전용) + `posts`에 업체 위치 컬럼 4개 추가
2. 서버 라우트 `/api/geocode` — 카카오 로컬 API로 주소→좌표 변환(서버 전용 키)
3. 글쓰기 화면: 한국생활 카테고리 전용 "업체 위치 표시" 체크박스 + 주소검색 팝업 +
   상세주소(선택) 입력
4. 지도 위젯 컴포넌트(국가 탭 + 구글맵 핀) — 메인 화면 미리보기 + `/map` 전체화면
   페이지에서 재사용
5. 헤더 2행 메뉴바에 "지도" 링크 추가(데스크톱/모바일/드롭다운)
6. `/admin/businesses` — 수집된 업체 목록 확인 + 활성/비활성 토글
7. `map-data/sync-businesses.mjs` — 카카오 로컬 API 수집 스크립트(국가×업종×지역
   키워드 조합, `kakao_place_id` 기준 upsert)
8. 신규 UI 문구를 10개 로케일(ko/en/vi/th/id/tl/lo/my/mn/ru) 전부에 추가
9. `.env.local.example`에 `KAKAO_REST_API_KEY`, `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` 추가

**제외 (YAGNI / Phase 2 후보)**
- 유료 광고·상단 노출, "내 주변 반경 검색", 핀 클러스터링
- 지도 타일 언어를 국가 탭별로 전환
- `/admin/businesses`에서 업체 직접 추가/수정 폼 (잘못된 데이터는 비활성화만 가능,
  신규/정정은 수집 스크립트 재실행으로 처리)
- "업체 위치 표시" 체크박스를 한국생활 외 카테고리(중고거래/만남 등)로 확장
- 수집 스크립트의 자동 스케줄링(Task Scheduler 연동) — 지금은 운영자가 수동 실행
- 지오코딩 실패 시 지도에서 핀 위치를 수동 드래그로 보정하는 기능
- 카카오/구글 외 제3의 지도·장소 데이터 소스 통합

## 승인된 접근: 데이터 2트랙 분리

업체 데이터를 `businesses`(운영자가 수집한 제3자 정보)와 `posts` 확장 컬럼(회원이
직접 쓰는 글)으로 분리하고, 지도 화면에서만 두 소스를 합쳐 보여준다.

근거:
- 신뢰 모델이 다르다. `businesses`는 회원이 소유하지 않는 제3자 업체 정보라
  신고(`reports.target_type`)·삭제 권한 체계가 posts/comments와 다르게 가야
  한다(운영자 단독 관리). 하나의 테이블로 합치면 RLS·신고 대상 분기가 꼬인다.
- `posts` 확장은 기존 뉴스 기능 설계(`2026-08-31-news-category-admin-articles-design.md`)
  에서 이미 검증된 패턴 — nullable 컬럼 추가로 기존 목록/상세/댓글/신고/관리자
  배관을 그대로 재사용한다. `show_on_map=true`인 글도 똑같이 신고·삭제 가능.

기각한 대안:
- **업체까지 전부 `posts`에 통합**: "운영자 수집 데이터"에 author_id가 없어
  posts의 NOT NULL 제약·작성자 UI 전제가 깨진다.
- **지도 화면 전용 테이블 하나로 통합(뷰로 합성)**: 수집 데이터 재수집 시
  posts와 조인 로직이 꼬이고, 회원 글의 생명주기(수정/삭제)를 추적하기 어려움.

## 1. 데이터 모델 & 마이그레이션

### 마이그레이션 `supabase/migrations/0017_business_map.sql`

```sql
-- 업체 지도: 카카오 로컬 API로 수집한 제3자 업체 데이터
create table businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null check (
    category in ('restaurant', 'mart', 'salon', 'hospital', 'mobile', 'admin', 'etc')
  ),
  country text not null check (
    country in ('vn', 'th', 'la', 'id', 'mm', 'ph', 'mn', 'kr', 'etc')
  ),
  address text not null,
  lat double precision not null,
  lng double precision not null,
  phone text,
  kakao_place_id text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index businesses_country_idx on businesses (country, is_active);

alter table businesses enable row level security;
create policy "businesses are publicly readable"
  on businesses for select using (is_active = true);
-- insert/update/delete 정책 없음 = 기본 거부. 수집 스크립트·관리자 API는
-- service role 키로 RLS를 우회해 쓴다 (기존 /admin/news, news-digest 스크립트와 동일 패턴).

-- posts: 한국생활 카테고리 전용 "업체 위치 표시" 필드. category='life'일 때만
-- 채워지며 나머지 카테고리는 전부 null/false.
alter table posts add column show_on_map boolean not null default false;
alter table posts add column business_address text;
alter table posts add column business_detail_address text;
alter table posts add column business_lat double precision;
alter table posts add column business_lng double precision;

create index posts_show_on_map_idx on posts (country, show_on_map) where show_on_map = true;
```

컬럼 grant 변경 없음(`posts`는 전체 테이블 grant, 읽기 정책 이미 `using (true)`).

### 타입 (`src/lib/types.ts`)

```ts
export type BusinessCategory =
  | "restaurant" | "mart" | "salon" | "hospital" | "mobile" | "admin" | "etc";

export interface Business {
  id: string;
  name: string;
  category: BusinessCategory;
  country: CountryCode;
  address: string;
  lat: number;
  lng: number;
  phone?: string;
}
```

`Post`에 추가:
```ts
showOnMap?: boolean;
businessAddress?: string;
businessDetailAddress?: string;
businessLat?: number;
businessLng?: number;
```

## 2. 업체 데이터 조회 (`src/lib/supabase/businesses.ts`, 신규)

```ts
export async function fetchBusinesses(country: CountryCode | "all"): Promise<Business[]>
```
- `is_active = true` + (`country !== "all"`이면 `.eq("country", country)`) — 공개
  읽기 정책이라 브라우저에서 anon 클라이언트로 직접 조회(기존 `fetchLatestPosts`와
  동일한 방식).

`src/lib/supabase/posts.ts`에 추가:
```ts
export async function fetchMapPosts(country: CountryCode | "all"): Promise<Post[]>
```
- `category = 'life' and show_on_map = true`, country 필터는 위와 동일 패턴.
  `POST_SELECT`에 `show_on_map, business_address, business_detail_address,
  business_lat, business_lng` 추가, `mapPost`에 매핑 추가.

## 3. 지오코딩 서버 라우트 (`src/app/api/geocode/route.ts`, 신규)

- `POST { address: string }` → 카카오 로컬 API 주소 검색
  (`https://dapi.kakao.com/v2/local/search/address.json?query=...`),
  `Authorization: KakaoAK ${process.env.KAKAO_REST_API_KEY}` 헤더.
- 결과 0건 또는 API 오류 → `{ error }` 400/502. 클라이언트는 에러 메시지를 보여주고
  "주소 검색" 버튼으로 다시 선택하도록 안내(수동 좌표 보정 기능 없음, YAGNI).
- 성공 → `{ lat, lng }` (첫 번째 결과의 `x`/`y`를 lng/lat으로 매핑 — 카카오 API는
  `x=경도, y=위도` 순서이므로 주의).
- `KAKAO_REST_API_KEY`는 서버 환경변수로만 존재, 브라우저에 노출 안 됨.

## 4. 글쓰기 화면 — 한국생활 전용 "업체 위치 표시"

파일: `src/app/board/[category]/write/page.tsx`

- `config.slug === "life"`일 때만 체크박스 노출: `t("map.showOnMapLabel")`
  ("업체 위치를 지도에 표시합니다")
- 체크 시:
  - "주소 검색" 버튼(`t("map.addressSearchButton")`) → 신규 컴포넌트
    `src/components/board/AddressPicker.tsx`가 다음 우편번호서비스 팝업
    (`//ssl.daum.net/postcode/postcodev2.js`, 무료·키 불필요)을 열고, 사용자가
    선택한 도로명주소를 읽기전용 입력칸에 채움
  - "상세주소 (선택)" 자유 입력 — 지오코딩에는 쓰지 않고 그대로 저장만
- 제출(`handleSubmit`) 시: `show_on_map`이 true인데 주소가 비어있으면 제출 차단
  + 에러 표시. 주소가 있으면 먼저 `/api/geocode`를 호출해 좌표를 구하고(성공해야
  다음 단계 진행), 실패 시 제출 중단 + `t("map.geocodeError")` 표시(체크 해제 후
  글만 올리는 것도 안내).
- `CreatePostInput`/`createPost`(`src/lib/supabase/posts.ts`)에
  `showOnMap?`, `businessAddress?`, `businessDetailAddress?`, `businessLat?`,
  `businessLng?` 추가, insert 객체에 매핑(해당 없으면 전부 `null`/`false`).

## 5. 지도 위젯 (`src/components/map/CountryMapWidget.tsx`, 신규)

- Props: `{ compact?: boolean }`. 내부 상태: 선택된 country 탭(기본값 `"all"`).
- 국가 탭은 `src/lib/constants/countries.ts`의 `COUNTRIES` 그대로 재사용(전체
  포함) — 지도만을 위한 별도 국가 목록을 만들지 않는다.
- 탭 변경 시 `fetchBusinesses(country)` + `fetchMapPosts(country)`를 병렬 호출해
  핀 데이터로 합성.
- 구글 Maps JS SDK는 기존 카카오맵 연동 아이디어와 동일하게, npm 패키지 추가 없이
  `useEffect`에서 `<script src="https://maps.googleapis.com/maps/api/js?key=${NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&language=ko">`를
  동적 삽입해 로드(언어는 항상 `ko`로 고정 — 배경 참고).
- 핀 구분: `businesses` 유래는 브랜드 레드 마커, `posts` 유래는 다른 색(예: 블루)
  마커로 시각적으로 구분.
  - `businesses` 핀 클릭 → `InfoWindow`에 이름/주소/전화(`t("map.category.*")`로
    업종 라벨 표시)
  - `posts` 핀 클릭 → `InfoWindow`에 제목 + "글 보기"(`t("map.viewPost")`) 링크 →
    `/board/life/[postId]`
- `compact`일 때 고정 높이(약 320px) + 하단에 "지도 전체화면 보기"
  (`t("map.viewFullMap")`) 링크 → `/map`. `compact`가 아니면 전체 높이로 렌더.

## 6. `/map` 페이지 (신규, `src/app/map/page.tsx`)

`<CountryMapWidget />`(비압축)을 전체 폭/높이로 렌더하는 얇은 래퍼.

## 7. 메인 화면 (`src/app/page.tsx`)

`ExchangeRateTicker`/`PopularPostsWidget` 다음, `LARGE_BOX_CATEGORIES` 그리드
**이전**에 `<CountryMapWidget compact />` 삽입.

## 8. 헤더 메뉴 (`src/components/layout/CategoryNav.tsx`)

데스크톱 `<ul>`에서 `CATEGORY_ORDER.map(...)` 다음, `/inquiries` 링크 앞에 `/map`
링크 추가(`t("nav.map")`). 모바일 버전과 `hiddenSlugs` 드롭다운에도 동일하게
추가 — `/inquiries`가 처리되는 위치와 똑같은 패턴(CATEGORY_ORDER/CATEGORIES에는
넣지 않음 — 게시판 목록 UI 패턴과 무관하므로).

## 9. 관리자 화면 (`/admin/businesses`, 신규)

- `src/app/admin/businesses/page.tsx`: `businesses` 목록(국가/업종 필터), 각 행에
  활성/비활성 토글 버튼. 직접 추가/수정 폼은 만들지 않음(YAGNI) — 데이터 오류는
  비활성화로 가리고, 정정은 수집 스크립트 재실행으로 처리.
- `src/app/api/admin/businesses/route.ts`: `PATCH { id, isActive }` →
  `assertAdmin()` 게이트 → service role로 `is_active` 갱신.
- `src/app/admin/layout.tsx`의 `NAV`에 `{ href: "/admin/businesses", label: "업체 지도 관리" }`
  추가(기존 "게시글 관리" 근처).

## 10. 데이터 수집 스크립트 (`map-data/sync-businesses.mjs`, 신규 폴더)

`news-digest/fetch.mjs`와 동일한 실행 패턴: `node --env-file=.env.local
map-data/sync-businesses.mjs`.

- 스크립트 상단에 설정 배열(국가×업종×키워드×지역 조합)을 하드코딩, 예:
  ```js
  const TARGETS = [
    { country: "vn", category: "restaurant", keyword: "베트남 음식", regions: ["안산시 원곡동", "서울 광희동"] },
    { country: "th", category: "mart", keyword: "태국 마트", regions: ["서울", "안산"] },
    // ...
  ];
  ```
- 각 조합마다 카카오 로컬 "키워드로 장소 검색" API
  (`https://dapi.kakao.com/v2/local/search/keyword.json?query=<keyword> <region>`)
  호출, 응답의 `id`를 `kakao_place_id`로 사용해 `businesses` 테이블에 upsert
  (service role 키, `onConflict: "kakao_place_id"`).
- 지금은 운영자가 필요할 때 수동 실행(스케줄러 연동 없음) — Phase 2에서 검토.

## 11. i18n — 신규 키 (10개 로케일 전부: ko/en/vi/th/id/tl/lo/my/mn/ru)

| 키 | ko (참고) |
|---|---|
| `nav.map` | 지도 |
| `map.showOnMapLabel` | 업체 위치를 지도에 표시합니다 |
| `map.addressSearchButton` | 주소 검색 |
| `map.addressPlaceholder` | 주소 검색 버튼을 눌러주세요 |
| `map.detailAddressLabel` | 상세주소 (선택) |
| `map.geocodeError` | 주소를 좌표로 변환하지 못했습니다. 다시 검색해주세요. |
| `map.viewFullMap` | 지도 전체화면 보기 |
| `map.legendBusiness` | 등록 업체 |
| `map.legendPost` | 회원 등록 글 |
| `map.viewPost` | 글 보기 |
| `map.category.restaurant` | 식당 |
| `map.category.mart` | 마트 |
| `map.category.salon` | 미용실 |
| `map.category.hospital` | 병원 |
| `map.category.mobile` | 휴대폰 |
| `map.category.admin` | 행정·법률 |
| `map.category.etc` | 기타 |

국가 탭 라벨은 기존 `country.*` 키를 그대로 재사용(신규 키 없음). 업체명·주소·
게시글 본문은 기존 원칙대로 번역 대상이 아님(원문 그대로).

## 12. 환경변수 (`.env.local.example`)

```
# Optional: 업체 지도 — 카카오 로컬 API(주소 지오코딩 + 수집 스크립트), 서버 전용
KAKAO_REST_API_KEY=

# Optional: 업체 지도 — 구글 Maps JS SDK(브라우저 표시), 공개 키
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=
```

## 13. 검증 방법

이 레포에는 프론트엔드 테스트 프레임워크가 없다. 검증은:

1. **타입 체크** — `npx tsc --noEmit` (또는 `next build`)
2. **린트** — `npm run lint`
3. **수동 확인** (dev 서버 + 브라우저 패널):
   - 메인 화면에서 국가 탭 전환 시 지도 핀이 바뀌는지, "지도 전체화면 보기" →
     `/map` 이동 확인
   - 헤더 메뉴바 "지도" 클릭(데스크톱/모바일 모두) → `/map` 이동 확인
   - 한국생활 글쓰기에서 체크박스 체크 → 주소 검색 팝업 → 주소 선택 → 상세주소
     입력 → 제출 → 지도에 핀으로 뜨는지, 핀 클릭 시 게시글 상세로 이동하는지
   - 한국생활이 아닌 다른 카테고리 글쓰기 화면에는 체크박스가 없는지
   - 잘못된/존재하지 않는 주소 입력 시 지오코딩 에러가 표시되고 제출이 막히는지
   - `map-data/sync-businesses.mjs` 실행 → `businesses` 테이블에 upsert되는지,
     재실행 시 중복 생성 없이 갱신되는지
   - `/admin/businesses`에서 비활성화한 업체가 지도에서 사라지는지
   - 다른 로케일로 전환 → 신규 라벨(지도 메뉴, 체크박스, 업종명 등)이 해당
     언어로 나오는지
   - 기존 한국생활 게시판 목록/상세/댓글/신고 흐름이 회귀 없이 동작하는지

## 영향 파일 요약

| 파일 | 변경 |
|---|---|
| `supabase/migrations/0017_business_map.sql` | 신규 — `businesses` 테이블 + `posts` 컬럼 4개 |
| `src/lib/types.ts` | `Business`, `BusinessCategory` 신규, `Post`에 옵션 필드 4개 |
| `src/lib/supabase/businesses.ts` | 신규 — `fetchBusinesses` |
| `src/lib/supabase/posts.ts` | `fetchMapPosts` 신규, `CreatePostInput`/`PostRow`/`POST_SELECT`/`mapPost`/`createPost` 확장 |
| `src/app/api/geocode/route.ts` | 신규 — 카카오 주소 검색 서버 라우트 |
| `src/components/board/AddressPicker.tsx` | 신규 — 다음 우편번호서비스 팝업 래퍼 |
| `src/app/board/[category]/write/page.tsx` | 한국생활 전용 "업체 위치 표시" 체크박스 + 주소 입력 |
| `src/components/map/CountryMapWidget.tsx` | 신규 — 국가 탭 + 구글맵 핀 위젯 |
| `src/app/map/page.tsx` | 신규 — 전체화면 지도 페이지 |
| `src/app/page.tsx` | 그리드 위에 `CountryMapWidget compact` 삽입 |
| `src/components/layout/CategoryNav.tsx` | "지도" 링크 추가(데스크톱/모바일/드롭다운) |
| `src/app/admin/businesses/page.tsx` | 신규 — 업체 목록 + 활성/비활성 토글 |
| `src/app/api/admin/businesses/route.ts` | 신규 — `PATCH`, `assertAdmin`, service role update |
| `src/app/admin/layout.tsx` | `NAV`에 "업체 지도 관리" 항목 |
| `map-data/sync-businesses.mjs` | 신규 — 카카오 로컬 API 수집 스크립트 |
| `src/lib/i18n/dictionaries.ts` | `nav.map`, `map.*` 키 17개 × 10 로케일 |
| `.env.local.example` | `KAKAO_REST_API_KEY`, `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` 추가 |
