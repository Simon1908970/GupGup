# 업체 지도(Business Map) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 국가 탭(기존 7개국+한국/기타) 구글맵에 카카오 로컬 API로 수집한 업체 핀과,
한국생활 카테고리 회원 글에서 등록한 업체 위치 핀을 함께 보여주는 지도 기능을 만든다.

**Architecture:** 데이터를 2트랙으로 분리한다 — 운영자가 수집하는 `businesses` 테이블
(카카오 로컬 API, 서비스 롤로만 쓰기)과, 회원이 한국생활 글쓰기에서 체크박스로 선택하는
`posts`의 신규 컬럼 4개(지오코딩은 서버 라우트에서 카카오 REST 키로 수행). 화면 표시는
구글 Maps JS SDK 하나로 통일하고, 지도 타일 언어는 `ko`로 고정한다.

**Tech Stack:** Next.js App Router(기존), Supabase(Postgres + RLS + service role),
카카오 로컬 API(REST, 서버 전용), 구글 Maps JavaScript API(브라우저), Node.js
`node:test`(기존 `news-digest/*.test.mjs`와 동일한 테스트 러너).

**Spec:** [docs/superpowers/specs/2026-10-03-business-map-design.md](../specs/2026-10-03-business-map-design.md)

## Global Constraints

- 국가 코드는 정확히 `'vn', 'th', 'la', 'id', 'mm', 'ph', 'mn', 'kr', 'etc'` (기존
  `posts`/`profiles` check 제약과 동일 — 새 값 추가 금지)
- 업체 카테고리는 정확히 `'restaurant', 'mart', 'salon', 'hospital', 'mobile', 'admin', 'etc'`
- 신규 UI 문구는 **10개 로케일 전부** (`ko, en, vi, th, id, tl, lo, my, mn, ru`)에 실제
  번역을 채운다 — `en`/`ko`만 채우고 나머지를 비워서 자동 폴백에 맡기지 않는다.
- "업체 위치 표시" 체크박스는 **한국생활(`life`) 카테고리에만** 노출 — 다른 카테고리
  글쓰기 화면은 변경하지 않는다.
- `KAKAO_REST_API_KEY`는 서버 전용 환경변수(절대 `NEXT_PUBLIC_` 접두어 금지).
  `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`는 브라우저에 노출되는 공개 키.
- 구글 지도 타일 언어는 항상 `ko`로 고정 — 국가 탭을 바꿔도 지도 자체 언어는 바뀌지 않음.
- `/admin/businesses`에는 업체 직접 추가/수정 폼을 만들지 않는다 — 활성/비활성 토글만.
- 카카오 수집 스크립트(`map-data/sync-businesses.mjs`)는 수동 실행만 — 스케줄러 연동 없음.
- 이 레포는 React/Next 프론트엔드 자동 테스트 프레임워크가 없다(`package.json`의
  `test` 스크립트는 `node --test` 기반 `.mjs` 파일만 대상). UI 컴포넌트는 수동 브라우저
  검증으로, **순수 로직(파서/매퍼 함수)은 TDD로 `node:test` 단위 테스트를 작성한다** —
  기존 `news-digest/_lib.mjs` + `_lib.test.mjs` 패턴을 그대로 따른다.

---

## Task 1: DB 마이그레이션 — `businesses` 테이블 + `posts` 컬럼

**Files:**
- Create: `supabase/migrations/0017_business_map.sql`

**Interfaces:**
- Produces: `businesses` 테이블(컬럼: `id, name, category, country, address, lat, lng,
  phone, kakao_place_id, is_active, created_at, updated_at`), `posts` 신규 컬럼
  (`show_on_map boolean`, `business_address text`, `business_detail_address text`,
  `business_lat double precision`, `business_lng double precision`) — 이후 모든
  태스크가 이 스키마를 전제로 한다.

- [ ] **Step 1: 마이그레이션 파일 작성**

```sql
-- supabase/migrations/0017_business_map.sql
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

- [ ] **Step 2: Supabase 프로젝트에 적용**

Supabase 대시보드 → SQL Editor에 위 파일 내용을 그대로 붙여넣고 실행한다(이 레포에는
로컬 Supabase CLI/`config.toml`이 없어 기존 마이그레이션들도 전부 이 방식으로
적용돼 왔다 — `0016_exchange_rate_history.sql` 등과 동일).

- [ ] **Step 3: 적용 확인**

SQL Editor에서 아래 쿼리를 실행해 테이블/컬럼이 생겼는지 확인:

```sql
select column_name, data_type from information_schema.columns
where table_name = 'businesses' order by ordinal_position;

select column_name from information_schema.columns
where table_name = 'posts' and column_name like 'business_%' or column_name = 'show_on_map';
```

Expected: `businesses`에 11개 컬럼, `posts`에 4개 신규 컬럼이 보여야 한다.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0017_business_map.sql
git commit -m "feat(db): 업체 지도용 businesses 테이블 + posts 업체 위치 컬럼 추가

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 2: 타입 + 업체 데이터 조회 레이어

**Files:**
- Modify: `src/lib/types.ts`
- Create: `src/lib/supabase/businesses.ts`

**Interfaces:**
- Consumes: Task 1의 `businesses` 테이블(공개 select RLS 정책)
- Produces: `BusinessCategory` 타입, `Business` 인터페이스, `fetchBusinesses(country:
  CountryCode | "all"): Promise<Business[]>` — Task 8(지도 위젯)이 이 함수를 쓴다.

- [ ] **Step 1: `src/lib/types.ts`에 타입 추가**

`CategorySlug` 타입 선언 아래 어딘가에 추가:

```ts
export type BusinessCategory =
  | "restaurant"
  | "mart"
  | "salon"
  | "hospital"
  | "mobile"
  | "admin"
  | "etc";

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

`Post` 인터페이스에 다음 옵션 필드 추가:

```ts
showOnMap?: boolean;
businessAddress?: string;
businessDetailAddress?: string;
businessLat?: number;
businessLng?: number;
```

- [ ] **Step 2: `src/lib/supabase/businesses.ts` 작성**

```ts
import { createClient } from "@/lib/supabase/client";
import type { Business, BusinessCategory, CountryCode } from "@/lib/types";

interface BusinessRow {
  id: string;
  name: string;
  category: BusinessCategory;
  country: CountryCode;
  address: string;
  lat: number;
  lng: number;
  phone: string | null;
}

const BUSINESS_SELECT = "id, name, category, country, address, lat, lng, phone";

function mapBusiness(row: BusinessRow): Business {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    country: row.country,
    address: row.address,
    lat: row.lat,
    lng: row.lng,
    phone: row.phone ?? undefined,
  };
}

export async function fetchBusinesses(country: CountryCode | "all"): Promise<Business[]> {
  const supabase = createClient();
  let query = supabase.from("businesses").select(BUSINESS_SELECT).eq("is_active", true);
  if (country !== "all") {
    query = query.eq("country", country);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((row) => mapBusiness(row as unknown as BusinessRow));
}
```

- [ ] **Step 3: 타입 체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 4: 수동 동작 확인용 샘플 로우 삽입(검증 후 삭제 가능)**

Supabase SQL Editor에서 임시 행 하나를 넣어 `fetchBusinesses`가 실제로 데이터를
가져오는지 확인할 수 있게 준비(다음 단계인 지도 위젯 완성 전까지는 UI로 볼 수
없으므로, 지금은 넣어두고 Task 8에서 화면에 뜨는지 확인한다):

```sql
insert into businesses (name, category, country, address, lat, lng, phone, kakao_place_id)
values ('테스트 베트남 마트', 'mart', 'vn', '경기도 안산시 단원구 원곡동', 37.3215, 126.8373, '031-000-0000', 'test-place-1');
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/types.ts src/lib/supabase/businesses.ts
git commit -m "feat(map): Business 타입 + fetchBusinesses 조회 함수 추가

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 3: `posts.ts` 지도 연동 (읽기 + 쓰기)

**Files:**
- Modify: `src/lib/supabase/posts.ts`

**Interfaces:**
- Consumes: Task 1의 `posts` 신규 컬럼, Task 2에서 `Post`에 추가한
  `showOnMap`/`businessAddress`/`businessDetailAddress`/`businessLat`/`businessLng`
  필드
- Produces: `fetchMapPosts(country: CountryCode | "all"): Promise<Post[]>`,
  `CreatePostInput`에 `showOnMap?`, `businessAddress?`, `businessDetailAddress?`,
  `businessLat?`, `businessLng?` 추가 — Task 7(글쓰기 화면)과 Task 8(지도 위젯)이
  이걸 쓴다.

- [ ] **Step 1: `PostRow`/`POST_SELECT`/`mapPost` 확장**

`PostRow` 인터페이스에 추가:
```ts
show_on_map: boolean;
business_address: string | null;
business_detail_address: string | null;
business_lat: number | null;
business_lng: number | null;
```

`POST_SELECT` 문자열 끝에 추가 (기존 문자열에 이어붙이기):
```
", show_on_map, business_address, business_detail_address, business_lat, business_lng"
```

`mapPost`의 반환 객체에 추가:
```ts
showOnMap: row.show_on_map,
businessAddress: row.business_address ?? undefined,
businessDetailAddress: row.business_detail_address ?? undefined,
businessLat: row.business_lat ?? undefined,
businessLng: row.business_lng ?? undefined,
```

- [ ] **Step 2: `CreatePostInput`에 필드 추가 + `createPost` insert 확장**

```ts
export interface CreatePostInput {
  category: CategorySlug;
  subCategory?: string;
  country: CountryCode;
  title: string;
  body: string;
  authorId: string;
  attachments?: Attachment[];
  showOnMap?: boolean;
  businessAddress?: string;
  businessDetailAddress?: string;
  businessLat?: number;
  businessLng?: number;
}
```

`createPost`의 `.insert({...})` 객체에 추가:
```ts
show_on_map: input.showOnMap ?? false,
business_address: input.businessAddress ?? null,
business_detail_address: input.businessDetailAddress ?? null,
business_lat: input.businessLat ?? null,
business_lng: input.businessLng ?? null,
```

- [ ] **Step 3: `fetchMapPosts` 함수 추가**

파일 끝(또는 `fetchPostsByAuthor` 근처)에 추가:

```ts
export async function fetchMapPosts(country: CountryCode | "all"): Promise<Post[]> {
  const supabase = createClient();
  let query = supabase
    .from("posts")
    .select(POST_SELECT)
    .eq("category", "life")
    .eq("show_on_map", true);
  if (country !== "all") {
    query = query.eq("country", country);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((row) => mapPost(row as unknown as PostRow));
}
```

- [ ] **Step 4: 타입 체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음. (`show_on_map`이 `not null default false`이므로 기존 글들도
전부 `false`로 채워져 있어 기존 `mapPost` 호출부가 깨지지 않는다.)

- [ ] **Step 5: Commit**

```bash
git add src/lib/supabase/posts.ts
git commit -m "feat(map): posts에 업체 위치 필드 연동 (fetchMapPosts, createPost 확장)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 4: 카카오 지오코딩 파서(TDD) + `/api/geocode` 라우트

**Files:**
- Create: `src/lib/kakaoGeocode.ts`
- Test: `src/lib/kakaoGeocode.test.mjs`
- Create: `src/app/api/geocode/route.ts`
- Modify: `package.json` (test 스크립트 glob에 `src/**/*.test.mjs` 추가)

**Interfaces:**
- Produces: `parseKakaoAddressResponse(json: unknown): { lat: number; lng: number } | null`
  — Task 7(글쓰기 화면)이 `/api/geocode` 라우트를 통해 간접적으로 쓴다.

이 태스크는 네트워크 호출 없이 테스트 가능한 "카카오 응답 파싱" 부분만 TDD로 만들고,
실제 HTTP 호출은 라우트에서 감싼다 (라우트 자체는 수동 검증).

- [ ] **Step 1: 실패하는 테스트 작성**

```js
// src/lib/kakaoGeocode.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseKakaoAddressResponse } from "./kakaoGeocode.mjs";

test("documents가 있으면 x/y를 lng/lat으로 변환", () => {
  const response = {
    meta: { total_count: 1 },
    documents: [
      { address_name: "서울 강남구 역삼동 719", x: "127.036456", y: "37.500622" },
    ],
  };
  assert.deepEqual(parseKakaoAddressResponse(response), { lat: 37.500622, lng: 127.036456 });
});

test("documents가 비어있으면 null", () => {
  assert.equal(parseKakaoAddressResponse({ meta: { total_count: 0 }, documents: [] }), null);
});

test("documents 필드가 없으면 null", () => {
  assert.equal(parseKakaoAddressResponse({}), null);
});
```

(참고: `node --test`는 `.mjs`만 대상으로 돈다 — TypeScript 소스를 그대로 테스트
러너가 읽을 수 없으므로, 파서 로직을 순수 JS 모듈(`kakaoGeocode.mjs`)로 작성하고
TypeScript 쪽(`kakaoGeocode.ts`)에서 재노출(re-export)한다. TS 쪽은 Next.js
빌드/타입체크 대상이고, mjs 쪽은 `node --test` 대상이라 양쪽 다 커버된다.)

- [ ] **Step 2: 테스트 실행해서 실패 확인**

Run: `node --test src/lib/kakaoGeocode.test.mjs`
Expected: FAIL — `kakaoGeocode.mjs` 파일이 없어서 import 에러.

- [ ] **Step 3: 순수 파서 모듈 작성**

```js
// src/lib/kakaoGeocode.mjs
export function parseKakaoAddressResponse(json) {
  const doc = json?.documents?.[0];
  if (!doc) return null;
  return { lat: Number.parseFloat(doc.y), lng: Number.parseFloat(doc.x) };
}
```

```ts
// src/lib/kakaoGeocode.ts
export { parseKakaoAddressResponse } from "./kakaoGeocode.mjs";
```

- [ ] **Step 4: 테스트 실행해서 통과 확인**

Run: `node --test src/lib/kakaoGeocode.test.mjs`
Expected: PASS (3 tests).

- [ ] **Step 5: `package.json`의 `test` 스크립트에 경로 추가**

```json
"test": "node --test \"news-digest/**/*.test.mjs\" \"src/**/*.test.mjs\""
```

Run: `npm test`
Expected: 기존 news-digest 테스트 + 새 `kakaoGeocode.test.mjs` 3개 모두 PASS.

- [ ] **Step 6: `/api/geocode` 라우트 작성**

```ts
// src/app/api/geocode/route.ts
import { NextResponse } from "next/server";
import { parseKakaoAddressResponse } from "@/lib/kakaoGeocode";

export async function POST(request: Request) {
  const { address } = (await request.json()) as { address?: string };
  if (!address) {
    return NextResponse.json({ error: "address is required" }, { status: 400 });
  }

  const apiKey = process.env.KAKAO_REST_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "geocoding is not configured" }, { status: 500 });
  }

  const res = await fetch(
    `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(address)}`,
    { headers: { Authorization: `KakaoAK ${apiKey}` } },
  );

  if (!res.ok) {
    const detail = await res.text();
    return NextResponse.json({ error: detail }, { status: 502 });
  }

  const data = await res.json();
  const coords = parseKakaoAddressResponse(data);
  if (!coords) {
    return NextResponse.json({ error: "no matching address found" }, { status: 404 });
  }

  return NextResponse.json(coords);
}
```

- [ ] **Step 7: `.env.local.example`에 키 추가**

```
# Optional: 업체 지도 — 카카오 로컬 API(주소 지오코딩 + 수집 스크립트), 서버 전용
KAKAO_REST_API_KEY=
```

- [ ] **Step 8: 수동 검증 (카카오 REST 키 발급 후)**

[Kakao Developers](https://developers.kakao.com) 에서 앱 생성 → REST API 키 발급
→ `.env.local`에 `KAKAO_REST_API_KEY` 설정 → dev 서버 실행 후:

```bash
curl -X POST http://localhost:3000/api/geocode -H "Content-Type: application/json" -d "{\"address\":\"경기도 안산시 단원구 원곡동\"}"
```

Expected: `{"lat":..., "lng":...}` 형태의 JSON 응답 (200).

- [ ] **Step 9: Commit**

```bash
git add src/lib/kakaoGeocode.mjs src/lib/kakaoGeocode.ts src/lib/kakaoGeocode.test.mjs src/app/api/geocode/route.ts package.json .env.local.example
git commit -m "feat(map): 카카오 주소 지오코딩 파서(TDD) + /api/geocode 라우트

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 5: i18n 키 추가 (10개 로케일)

**Files:**
- Modify: `src/lib/i18n/dictionaries.ts`

**Interfaces:**
- Produces: `nav.map`, `map.*` 번역 키 17개 — Task 7~10(UI)이 전부 이 키들로
  `t("...")`를 호출한다. 정확한 키 이름은 아래 표가 유일한 출처이며, 이후 태스크는
  이 표의 키 이름을 그대로 써야 한다.

| 키 | ko | en |
|---|---|---|
| `nav.map` | 지도 | Map |
| `map.showOnMapLabel` | 업체 위치를 지도에 표시합니다 | Show this business on the map |
| `map.addressSearchButton` | 주소 검색 | Search address |
| `map.addressPlaceholder` | 주소 검색 버튼을 눌러주세요 | Tap "Search address" |
| `map.detailAddressLabel` | 상세주소 (선택) | Detailed address (optional) |
| `map.geocodeError` | 주소를 좌표로 변환하지 못했습니다. 다시 검색해주세요. | Could not locate this address. Please search again. |
| `map.viewFullMap` | 지도 전체화면 보기 | View full map |
| `map.legendBusiness` | 등록 업체 | Listed businesses |
| `map.legendPost` | 회원 등록 글 | Member posts |
| `map.viewPost` | 글 보기 | View post |
| `map.category.restaurant` | 식당 | Restaurant |
| `map.category.mart` | 마트 | Mart |
| `map.category.salon` | 미용실 | Salon |
| `map.category.hospital` | 병원 | Hospital |
| `map.category.mobile` | 휴대폰 | Mobile phone |
| `map.category.admin` | 행정·법률 | Admin & legal |
| `map.category.etc` | 기타 | Other |

- [ ] **Step 1: `ko` 객체에 17개 키 추가**

`ko` 객체(파일 상단, `nav.*` 키들 근처에 `nav.map`을, 파일 뒤쪽 적절한 위치에
`map.*` 14개를) 위 표의 ko 열 값 그대로 추가.

- [ ] **Step 2: `en` 객체에 동일 17개 키 추가**

`en` 객체(타입이 `Dictionary`라 **반드시** 전부 채워야 함)에 위 표의 en 열 값 그대로
추가.

- [ ] **Step 3: 타입 체크로 누락 확인**

Run: `npx tsc --noEmit`
Expected: `en`에 키가 하나라도 빠지면 `Dictionary` 타입 에러가 뜬다 — 전부 채워졌으면
에러 없음.

- [ ] **Step 4: 나머지 8개 로케일(vi/th/id/tl/lo/my/mn/ru)에 번역 추가**

각 로케일 객체(`Partial<Dictionary>`)에 위 17개 키를 해당 언어로 번역해 추가한다.
예시(`vi`, `th`만 발췌 — 나머지도 같은 방식으로 각 언어 전문 번역을 채운다):

```ts
// vi 객체에 추가
"nav.map": "Bản đồ",
"map.showOnMapLabel": "Hiển thị vị trí cửa hàng trên bản đồ",
"map.addressSearchButton": "Tìm địa chỉ",
"map.addressPlaceholder": "Nhấn \"Tìm địa chỉ\"",
"map.detailAddressLabel": "Địa chỉ chi tiết (không bắt buộc)",
"map.geocodeError": "Không thể xác định vị trí địa chỉ này. Vui lòng tìm lại.",
"map.viewFullMap": "Xem bản đồ toàn màn hình",
"map.legendBusiness": "Cửa hàng đã đăng ký",
"map.legendPost": "Bài viết của thành viên",
"map.viewPost": "Xem bài viết",
"map.category.restaurant": "Nhà hàng",
"map.category.mart": "Siêu thị",
"map.category.salon": "Tiệm tóc",
"map.category.hospital": "Bệnh viện",
"map.category.mobile": "Điện thoại di động",
"map.category.admin": "Hành chính & pháp lý",
"map.category.etc": "Khác",
```

```ts
// th 객체에 추가
"nav.map": "แผนที่",
"map.showOnMapLabel": "แสดงตำแหน่งร้านบนแผนที่",
"map.addressSearchButton": "ค้นหาที่อยู่",
"map.addressPlaceholder": "กดปุ่ม \"ค้นหาที่อยู่\"",
"map.detailAddressLabel": "ที่อยู่โดยละเอียด (ไม่บังคับ)",
"map.geocodeError": "ไม่พบตำแหน่งของที่อยู่นี้ กรุณาค้นหาใหม่",
"map.viewFullMap": "ดูแผนที่แบบเต็มจอ",
"map.legendBusiness": "ร้านค้าที่ลงทะเบียน",
"map.legendPost": "โพสต์ของสมาชิก",
"map.viewPost": "ดูโพสต์",
"map.category.restaurant": "ร้านอาหาร",
"map.category.mart": "มินิมาร์ท",
"map.category.salon": "ร้านเสริมสวย",
"map.category.hospital": "โรงพยาบาล",
"map.category.mobile": "โทรศัพท์มือถือ",
"map.category.admin": "งานราชการ·กฎหมาย",
"map.category.etc": "อื่นๆ",
```

나머지 6개 로케일 객체에도 동일한 17개 키를 아래 값 그대로 추가한다.

```ts
// id 객체에 추가
"nav.map": "Peta",
"map.showOnMapLabel": "Tampilkan lokasi usaha ini di peta",
"map.addressSearchButton": "Cari alamat",
"map.addressPlaceholder": "Tekan tombol \"Cari alamat\"",
"map.detailAddressLabel": "Alamat detail (opsional)",
"map.geocodeError": "Tidak dapat menemukan lokasi alamat ini. Silakan cari lagi.",
"map.viewFullMap": "Lihat peta layar penuh",
"map.legendBusiness": "Usaha terdaftar",
"map.legendPost": "Postingan anggota",
"map.viewPost": "Lihat postingan",
"map.category.restaurant": "Restoran",
"map.category.mart": "Toko kelontong",
"map.category.salon": "Salon",
"map.category.hospital": "Rumah sakit",
"map.category.mobile": "Ponsel",
"map.category.admin": "Administrasi & hukum",
"map.category.etc": "Lainnya",
```

```ts
// tl 객체에 추가
"nav.map": "Mapa",
"map.showOnMapLabel": "Ipakita ang lokasyon ng negosyong ito sa mapa",
"map.addressSearchButton": "Maghanap ng address",
"map.addressPlaceholder": "Pindutin ang \"Maghanap ng address\"",
"map.detailAddressLabel": "Detalyadong address (opsyonal)",
"map.geocodeError": "Hindi nahanap ang lokasyon ng address na ito. Pakihanap ulit.",
"map.viewFullMap": "Tingnan ang buong mapa",
"map.legendBusiness": "Nakalistang negosyo",
"map.legendPost": "Post ng miyembro",
"map.viewPost": "Tingnan ang post",
"map.category.restaurant": "Restawran",
"map.category.mart": "Tindahan",
"map.category.salon": "Salon",
"map.category.hospital": "Ospital",
"map.category.mobile": "Cellphone",
"map.category.admin": "Administrasyon at legal",
"map.category.etc": "Iba pa",
```

```ts
// lo 객체에 추가
"nav.map": "ແຜນທີ່",
"map.showOnMapLabel": "ສະແດງທີ່ຕັ້ງຮ້ານນີ້ຢູ່ໃນແຜນທີ່",
"map.addressSearchButton": "ຄົ້ນຫາທີ່ຢູ່",
"map.addressPlaceholder": "ກົດປຸ່ມ \"ຄົ້ນຫາທີ່ຢູ່\"",
"map.detailAddressLabel": "ທີ່ຢູ່ລະອຽດ (ບໍ່ບັງຄັບ)",
"map.geocodeError": "ບໍ່ສາມາດຊອກຫາທີ່ຕັ້ງຂອງທີ່ຢູ່ນີ້ໄດ້. ກະລຸນາຄົ້ນຫາໃໝ່.",
"map.viewFullMap": "ເບິ່ງແຜນທີ່ເຕັມຈໍ",
"map.legendBusiness": "ຮ້ານທີ່ລົງທະບຽນ",
"map.legendPost": "ໂພສຂອງສະມາຊິກ",
"map.viewPost": "ເບິ່ງໂພສ",
"map.category.restaurant": "ຮ້ານອາຫານ",
"map.category.mart": "ຕະຫຼາດ",
"map.category.salon": "ຮ້ານເສີມສວຍ",
"map.category.hospital": "ໂຮງໝໍ",
"map.category.mobile": "ໂທລະສັບມືຖື",
"map.category.admin": "ບໍລິຫານ ແລະ ກົດໝາຍ",
"map.category.etc": "ອື່ນໆ",
```

```ts
// my 객체에 추가
"nav.map": "မြေပုံ",
"map.showOnMapLabel": "ဤစီးပွားရေးလုပ်ငန်း၏တည်နေရာကို မြေပုံပေါ်တွင်ပြပါ",
"map.addressSearchButton": "လိပ်စာရှာရန်",
"map.addressPlaceholder": "\"လိပ်စာရှာရန်\" ကိုနှိပ်ပါ",
"map.detailAddressLabel": "အသေးစိတ်လိပ်စာ (ရွေးချယ်နိုင်)",
"map.geocodeError": "ဤလိပ်စာကိုရှာမတွေ့ပါ။ ထပ်မံရှာဖွေပါ။",
"map.viewFullMap": "မြေပုံကို full screen ဖြင့်ကြည့်ရန်",
"map.legendBusiness": "စာရင်းသွင်းထားသောစီးပွားရေးလုပ်ငန်းများ",
"map.legendPost": "အသင်းဝင်ပို့စ်များ",
"map.viewPost": "ပို့စ်ကိုကြည့်ရန်",
"map.category.restaurant": "စားသောက်ဆိုင်",
"map.category.mart": "ကုန်စုံဆိုင်",
"map.category.salon": "အလှပြင်ဆိုင်",
"map.category.hospital": "ဆေးရုံ",
"map.category.mobile": "လက်ကိုင်ဖုန်း",
"map.category.admin": "အုပ်ချုပ်ရေးနှင့်ဥပဒေ",
"map.category.etc": "အခြား",
```

```ts
// mn 객체에 추가
"nav.map": "Газрын зураг",
"map.showOnMapLabel": "Энэ бизнесийн байршлыг газрын зураг дээр харуулах",
"map.addressSearchButton": "Хаяг хайх",
"map.addressPlaceholder": "\"Хаяг хайх\" товчийг дарна уу",
"map.detailAddressLabel": "Дэлгэрэнгүй хаяг (сайн дурын)",
"map.geocodeError": "Энэ хаягийн байршлыг олж чадсангүй. Дахин хайж үзнэ үү.",
"map.viewFullMap": "Бүтэн дэлгэцийн газрын зураг харах",
"map.legendBusiness": "Бүртгэлтэй бизнесүүд",
"map.legendPost": "Гишүүдийн нийтлэл",
"map.viewPost": "Нийтлэл харах",
"map.category.restaurant": "Ресторан",
"map.category.mart": "Дэлгүүр",
"map.category.salon": "Үсчин",
"map.category.hospital": "Эмнэлэг",
"map.category.mobile": "Гар утас",
"map.category.admin": "Захиргаа & хууль",
"map.category.etc": "Бусад",
```

```ts
// ru 객체에 추가
"nav.map": "Карта",
"map.showOnMapLabel": "Показать это предприятие на карте",
"map.addressSearchButton": "Поиск адреса",
"map.addressPlaceholder": "Нажмите «Поиск адреса»",
"map.detailAddressLabel": "Подробный адрес (необязательно)",
"map.geocodeError": "Не удалось определить местоположение по этому адресу. Попробуйте снова.",
"map.viewFullMap": "Посмотреть карту на весь экран",
"map.legendBusiness": "Зарегистрированные предприятия",
"map.legendPost": "Публикации участников",
"map.viewPost": "Посмотреть публикацию",
"map.category.restaurant": "Ресторан",
"map.category.mart": "Магазин",
"map.category.salon": "Салон красоты",
"map.category.hospital": "Больница",
"map.category.mobile": "Мобильный телефон",
"map.category.admin": "Администрация и право",
"map.category.etc": "Другое",
```

- [ ] **Step 5: 최종 타입 체크 + 린트**

Run: `npx tsc --noEmit && npm run lint`
Expected: 에러 없음.

- [ ] **Step 6: Commit**

```bash
git add src/lib/i18n/dictionaries.ts
git commit -m "feat(i18n): 업체 지도 UI 문구 10개 로케일 추가

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 6: `AddressPicker` 컴포넌트 (다음 우편번호서비스 팝업)

**Files:**
- Create: `src/components/board/AddressPicker.tsx`

**Interfaces:**
- Produces: `<AddressPicker onSelect={(address: string) => void} />` — Task 7(글쓰기
  화면)이 이 컴포넌트를 쓴다.

- [ ] **Step 1: 컴포넌트 작성**

```tsx
// src/components/board/AddressPicker.tsx
"use client";

import { useLanguage } from "@/lib/i18n/LanguageProvider";

declare global {
  interface Window {
    daum?: {
      Postcode: new (options: {
        oncomplete: (data: { roadAddress: string; jibunAddress: string }) => void;
      }) => { open: () => void };
    };
  }
}

const SCRIPT_SRC = "//ssl.daum.net/postcode/postcodev2.js";

function loadDaumPostcodeScript(): Promise<void> {
  if (window.daum?.Postcode) return Promise.resolve();
  const existing = document.querySelector(`script[src="${SCRIPT_SRC}"]`);
  if (existing) {
    return new Promise((resolve) => existing.addEventListener("load", () => resolve()));
  }
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.onload = () => resolve();
    document.head.appendChild(script);
  });
}

export function AddressPicker({ onSelect }: { onSelect: (address: string) => void }) {
  const { t } = useLanguage();

  async function openPicker() {
    await loadDaumPostcodeScript();
    if (!window.daum?.Postcode) return;
    new window.daum.Postcode({
      oncomplete: (data) => {
        onSelect(data.roadAddress || data.jibunAddress);
      },
    }).open();
  }

  return (
    <button
      type="button"
      onClick={openPicker}
      className="rounded-md border border-[var(--color-brand-red)] px-3 py-1.5 text-sm font-medium text-[var(--color-brand-red)] hover:bg-[var(--color-brand-red)]/5"
    >
      {t("map.addressSearchButton")}
    </button>
  );
}
```

- [ ] **Step 2: 타입 체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 3: 수동 검증 (Task 7에서 글쓰기 화면에 꽂은 뒤 통합 확인)**

이 컴포넌트는 Task 7에서 실제로 화면에 붙기 전까지는 단독으로 렌더할 곳이 없다.
Task 7 완료 후 "주소 검색" 버튼 클릭 → 다음 우편번호 팝업이 뜨고 주소를 선택하면
입력칸에 도로명주소가 채워지는지 확인한다 (이 Step은 Task 7의 검증에서 함께 수행).

- [ ] **Step 4: Commit**

```bash
git add src/components/board/AddressPicker.tsx
git commit -m "feat(map): 다음 우편번호서비스 기반 AddressPicker 컴포넌트

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 7: 글쓰기 화면 통합 (한국생활 전용 "업체 위치 표시")

**Files:**
- Modify: `src/app/board/[category]/write/page.tsx`

**Interfaces:**
- Consumes: `AddressPicker`(Task 6), `/api/geocode`(Task 4), `createPost`의
  `showOnMap`/`businessAddress`/`businessDetailAddress`/`businessLat`/`businessLng`
  (Task 3), `t("map.showOnMapLabel")` 등(Task 5)
- Produces: 한국생활 글쓰기에서 저장된 `show_on_map=true` 게시글 — Task 8(지도
  위젯)이 `fetchMapPosts`로 이걸 읽는다.

- [ ] **Step 1: 상태 추가**

`WritePostPage` 컴포넌트 안, 기존 `const [attachments, ...]` 근처에 추가:

```tsx
const [showOnMap, setShowOnMap] = useState(false);
const [businessAddress, setBusinessAddress] = useState("");
const [businessDetailAddress, setBusinessDetailAddress] = useState("");
```

(지오코딩 중에도 기존 `submitting` 상태가 그대로 제출 버튼을 비활성화하므로 별도
로딩 상태는 추가하지 않는다.)

- [ ] **Step 2: 체크박스 + 주소 입력 UI 추가 (한국생활 전용)**

폼 JSX에서 첨부파일 입력(`<PostAttachmentInput ...>`) 다음, 제출 버튼 이전에 추가:

```tsx
{config.slug === "life" && (
  <div className="flex flex-col gap-2 rounded-md border border-[var(--color-border-gray-light)] p-3">
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={showOnMap}
        onChange={(e) => setShowOnMap(e.target.checked)}
      />
      {t("map.showOnMapLabel")}
    </label>
    {showOnMap && (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <input
            type="text"
            readOnly
            value={businessAddress}
            placeholder={t("map.addressPlaceholder")}
            className="min-w-0 flex-1 rounded-md border border-[var(--color-border-gray-light)] px-3 py-1.5 text-sm"
          />
          <AddressPicker onSelect={setBusinessAddress} />
        </div>
        <input
          type="text"
          value={businessDetailAddress}
          onChange={(e) => setBusinessDetailAddress(e.target.value)}
          placeholder={t("map.detailAddressLabel")}
          className="rounded-md border border-[var(--color-border-gray-light)] px-3 py-1.5 text-sm"
        />
      </div>
    )}
  </div>
)}
```

파일 상단 import에 추가:
```tsx
import { AddressPicker } from "@/components/board/AddressPicker";
```

- [ ] **Step 3: 제출 로직에 지오코딩 단계 끼워넣기**

현재 `handleSubmit`은 다음과 같다 (파일 48~73행, import 등 기준선 기준이며 Task 2~6
적용 후 줄 번호는 달라질 수 있음 — 아래 "before" 블록을 코드에서 찾아 그대로
"after" 블록으로 바꾼다):

Before:
```tsx
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !body.trim() || !user) return;
    if (insufficientPoints) {
      setError(t("points.insufficientError"));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const postId = await createPost({
        category: config!.slug,
        subCategory: config!.subCategories ? subCategory : undefined,
        country,
        title: title.trim(),
        body: body.trim(),
        authorId: user.id,
        attachments,
      });
      await refreshProfile();
      router.push(`/board/${config!.slug}/${postId}`);
    } catch (err) {
      setError(err instanceof InsufficientPointsError ? t("points.insufficientError") : getErrorMessage(err));
      setSubmitting(false);
    }
  }
```

After:
```tsx
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !body.trim() || !user) return;
    if (insufficientPoints) {
      setError(t("points.insufficientError"));
      return;
    }
    if (showOnMap && !businessAddress.trim()) {
      setError(t("map.addressPlaceholder"));
      return;
    }

    setSubmitting(true);
    setError(null);

    let businessLat: number | undefined;
    let businessLng: number | undefined;

    if (showOnMap && businessAddress.trim()) {
      try {
        const res = await fetch("/api/geocode", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address: businessAddress.trim() }),
        });
        if (!res.ok) throw new Error("geocode failed");
        const coords = (await res.json()) as { lat: number; lng: number };
        businessLat = coords.lat;
        businessLng = coords.lng;
      } catch {
        setSubmitting(false);
        setError(t("map.geocodeError"));
        return;
      }
    }

    try {
      const postId = await createPost({
        category: config!.slug,
        subCategory: config!.subCategories ? subCategory : undefined,
        country,
        title: title.trim(),
        body: body.trim(),
        authorId: user.id,
        attachments,
        showOnMap,
        businessAddress: showOnMap ? businessAddress.trim() : undefined,
        businessDetailAddress: showOnMap ? businessDetailAddress.trim() || undefined : undefined,
        businessLat,
        businessLng,
      });
      await refreshProfile();
      router.push(`/board/${config!.slug}/${postId}`);
    } catch (err) {
      setError(err instanceof InsufficientPointsError ? t("points.insufficientError") : getErrorMessage(err));
      setSubmitting(false);
    }
  }
```

- [ ] **Step 4: 타입 체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 5: 수동 검증**

Dev 서버 실행 후:
1. `/board/life/write`로 이동 → "업체 위치를 지도에 표시합니다" 체크박스가 보이는지
2. 체크 → "주소 검색" 버튼 클릭 → 다음 우편번호 팝업이 뜨는지 → 주소 하나 선택 →
   입력칸에 도로명주소가 채워지는지
3. 상세주소에 "2층"처럼 입력 → 제출 → 에러 없이 저장되는지
4. Supabase SQL Editor에서 확인:
   ```sql
   select title, show_on_map, business_address, business_detail_address, business_lat, business_lng
   from posts order by created_at desc limit 1;
   ```
   Expected: 방금 쓴 글의 `show_on_map=true`, `business_lat`/`business_lng`에
   실제 좌표 값이 들어있어야 한다.
5. `/board/housing/write`(한국생활이 아닌 카테고리) → 체크박스가 **보이지 않는지**
   확인 (회귀 체크).

- [ ] **Step 6: Commit**

```bash
git add src/app/board/\[category\]/write/page.tsx
git commit -m "feat(map): 한국생활 글쓰기에 업체 위치 표시 체크박스 + 지오코딩 연동

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 8: `CountryMapWidget` 컴포넌트 (국가 탭 + 구글맵 핀)

**Files:**
- Create: `src/components/map/CountryMapWidget.tsx`

**Interfaces:**
- Consumes: `fetchBusinesses`(Task 2), `fetchMapPosts`(Task 3), `COUNTRIES`
  (`src/lib/constants/countries.ts`, 기존), `CountryFlag`(`src/components/common/CountryFlag.tsx`,
  기존), `t("map.*")`(Task 5)
- Produces: `<CountryMapWidget compact?: boolean />` — Task 9(홈 화면/`/map` 페이지)가
  이 컴포넌트를 쓴다.

- [ ] **Step 1: 컴포넌트 작성**

```tsx
// src/components/map/CountryMapWidget.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { COUNTRIES } from "@/lib/constants/countries";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import type { DictionaryKey } from "@/lib/i18n/dictionaries";
import { fetchBusinesses } from "@/lib/supabase/businesses";
import { fetchMapPosts } from "@/lib/supabase/posts";
import type { Business, CountryCode, Post } from "@/lib/types";
import { CountryFlag } from "@/components/common/CountryFlag";
import { cn } from "@/lib/utils";

declare global {
  interface Window {
    google?: typeof google;
  }
}

const DEFAULT_CENTER = { lat: 37.5665, lng: 126.978 }; // 서울시청
const SCRIPT_ID = "gupgup-google-maps-script";

function loadGoogleMapsScript(): Promise<void> {
  if (window.google?.maps) return Promise.resolve();
  const existing = document.getElementById(SCRIPT_ID);
  if (existing) {
    return new Promise((resolve) => existing.addEventListener("load", () => resolve()));
  }
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&language=ko`;
    script.onload = () => resolve();
    document.head.appendChild(script);
  });
}

export function CountryMapWidget({ compact = false }: { compact?: boolean }) {
  const { t } = useLanguage();
  const [country, setCountry] = useState<CountryCode | "all">("all");
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const mapDivRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchBusinesses(country), fetchMapPosts(country)]).then(([b, p]) => {
      if (cancelled) return;
      setBusinesses(b);
      setPosts(p);
    });
    return () => {
      cancelled = true;
    };
  }, [country]);

  useEffect(() => {
    let cancelled = false;
    loadGoogleMapsScript().then(() => {
      if (cancelled || !mapDivRef.current || mapRef.current) return;
      mapRef.current = new window.google!.maps.Map(mapDivRef.current, {
        center: DEFAULT_CENTER,
        zoom: 11,
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current || !window.google) return;
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    const infoWindow = new window.google.maps.InfoWindow();

    for (const b of businesses) {
      const marker = new window.google.maps.Marker({
        position: { lat: b.lat, lng: b.lng },
        map: mapRef.current,
        icon: "https://maps.google.com/mapfiles/ms/icons/red-dot.png",
        title: b.name,
      });
      marker.addListener("click", () => {
        infoWindow.setContent(
          `<div style="font-size:13px"><strong>${b.name}</strong><br/>${t(
            `map.category.${b.category}` as DictionaryKey,
          )}<br/>${b.address}${b.phone ? `<br/>${b.phone}` : ""}</div>`,
        );
        infoWindow.open(mapRef.current!, marker);
      });
      markersRef.current.push(marker);
    }

    for (const p of posts) {
      if (p.businessLat == null || p.businessLng == null) continue;
      const marker = new window.google.maps.Marker({
        position: { lat: p.businessLat, lng: p.businessLng },
        map: mapRef.current,
        icon: "https://maps.google.com/mapfiles/ms/icons/blue-dot.png",
        title: p.title,
      });
      marker.addListener("click", () => {
        infoWindow.setContent(
          `<div style="font-size:13px"><strong>${p.title}</strong><br/><a href="/board/life/${p.id}">${t("map.viewPost")}</a></div>`,
        );
        infoWindow.open(mapRef.current!, marker);
      });
      markersRef.current.push(marker);
    }
  }, [businesses, posts, t]);

  return (
    <div className="mb-4 flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5">
        {COUNTRIES.map((c) => (
          <button
            key={c.code}
            type="button"
            onClick={() => setCountry(c.code)}
            className={cn(
              "flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium",
              country === c.code
                ? "border-[var(--color-brand-red)] bg-[var(--color-brand-red)] text-white"
                : "border-[var(--color-border-gray-light)] text-[var(--color-text-muted)]",
            )}
          >
            <CountryFlag code={c.code} size={14} />
            {t(c.labelKey as DictionaryKey)}
          </button>
        ))}
      </div>
      <div
        ref={mapDivRef}
        style={{ height: compact ? 320 : 640 }}
        className="w-full rounded-lg border border-[var(--color-border-gray-light)]"
      />
      <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)]">
        <div className="flex gap-3">
          <span>🔴 {t("map.legendBusiness")}</span>
          <span>🔵 {t("map.legendPost")}</span>
        </div>
        {compact && (
          <Link href="/map" className="font-medium text-[var(--color-brand-red)]">
            {t("map.viewFullMap")}
          </Link>
        )}
      </div>
    </div>
  );
}
```

> `google.maps.Map`/`google.maps.Marker` 등 타입은 `@types/google.maps`가 없으면
> `tsc`에서 `Cannot find namespace 'google'` 에러가 난다. Step 2에서 처리한다.

- [ ] **Step 2: 구글맵 타입 패키지 설치**

```bash
npm install --save-dev @types/google.maps
```

- [ ] **Step 3: 타입 체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 4: `.env.local.example`에 구글 Maps 키 추가**

```
# Optional: 업체 지도 — 구글 Maps JS SDK(브라우저 표시), 공개 키
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=
```

- [ ] **Step 5: 수동 검증 (Task 9에서 실제 화면에 꽂은 뒤 확인)**

이 컴포넌트는 Task 9에서 `/map` 페이지나 홈 화면에 꽂히기 전까지 렌더할 곳이 없다.
[Google Cloud Console](https://console.cloud.google.com/)에서 Maps JavaScript API
키 발급 → `.env.local`에 `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` 설정 → Task 9 완료 후:
1. 국가 탭 클릭 → 지도가 다시 그려지고, Task 2에서 넣은 테스트 업체(빨간 마커)가
   "베트남" 탭에서만 보이는지
2. 마커 클릭 → 정보창에 이름/업종/주소가 보이는지
3. Task 7에서 작성한 글(파란 마커) 클릭 → "글 보기" 링크로 게시글 상세로 이동하는지

- [ ] **Step 6: Commit**

```bash
git add src/components/map/CountryMapWidget.tsx package.json package-lock.json .env.local.example
git commit -m "feat(map): 국가 탭 + 구글맵 핀 위젯(CountryMapWidget) 추가

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 9: `/map` 페이지 + 홈 화면 + 헤더 메뉴 연동

**Files:**
- Create: `src/app/map/page.tsx`
- Modify: `src/app/page.tsx`
- Modify: `src/components/layout/CategoryNav.tsx`

**Interfaces:**
- Consumes: `CountryMapWidget`(Task 8), `t("nav.map")`(Task 5)

- [ ] **Step 1: `/map` 페이지 작성**

```tsx
// src/app/map/page.tsx
import { CountryMapWidget } from "@/components/map/CountryMapWidget";

export default function MapPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <CountryMapWidget />
    </div>
  );
}
```

- [ ] **Step 2: 홈 화면에 미리보기 위젯 삽입**

`src/app/page.tsx`에서 `import { ExchangeRateTicker } ...` 아래에 추가:
```tsx
import { CountryMapWidget } from "@/components/map/CountryMapWidget";
```

`<ExchangeRateTicker />` 다음, `<PopularPostsWidget ...>` 다음, `<section>`(대형
박스 그리드) **이전**에 추가:
```tsx
<CountryMapWidget compact />
```

- [ ] **Step 3: 헤더 메뉴바에 "지도" 링크 추가**

`src/components/layout/CategoryNav.tsx`에서 데스크톱 `<ul>` 안, `{CATEGORY_ORDER.map(...)}`
다음 `<li>`(기존 `/inquiries` 링크) **이전**에 추가:
```tsx
<li>
  <Link href="/map" className={linkClass(!!pathname?.startsWith("/map"))}>
    {t("nav.map")}
  </Link>
</li>
```

모바일 버전의 `hiddenSlugs.map(...)` 다음, `/inquiries` `<li>` 이전에도 동일하게
추가(단, `onClick={() => setExpanded(false)}` 포함):
```tsx
<li>
  <Link
    href="/map"
    onClick={() => setExpanded(false)}
    className={linkClass(!!pathname?.startsWith("/map"))}
  >
    {t("nav.map")}
  </Link>
</li>
```

- [ ] **Step 4: 타입 체크 + 빌드**

Run: `npx tsc --noEmit && npx next build`
Expected: 에러 없음.

- [ ] **Step 5: 수동 검증**

1. 홈 화면(`/`) → 카테고리 그리드 위에 국가 탭 + 지도 미리보기(320px 높이)가 보이는지
2. 미리보기 하단 "지도 전체화면 보기" 클릭 → `/map`으로 이동, 더 큰 지도(640px)가
   보이는지
3. 데스크톱 헤더 메뉴바에서 "지도" 클릭 → `/map` 이동, 활성 상태(빨간 배경) 표시 확인
4. 모바일 너비(`resize_window` 또는 좁은 창)에서 "더보기" 드롭다운 펼쳐서 "지도"
   항목이 보이는지, 클릭 시 드롭다운이 닫히고 `/map`으로 이동하는지

- [ ] **Step 6: Commit**

```bash
git add src/app/map/page.tsx src/app/page.tsx src/components/layout/CategoryNav.tsx
git commit -m "feat(map): /map 페이지 + 홈 화면 지도 위젯 + 헤더 메뉴 연동

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 10: 관리자 업체 관리 화면 (`/admin/businesses`)

**Files:**
- Create: `src/app/admin/businesses/page.tsx`
- Create: `src/app/api/admin/businesses/[id]/route.ts`
- Modify: `src/app/admin/layout.tsx`

**Interfaces:**
- Consumes: `assertAdmin()`, `createAdminClient()`(기존 `@/lib/supabase/adminAuth`,
  `@/lib/supabase/admin`), `Business`/`BusinessCategory` 타입(Task 2)

- [ ] **Step 1: 관리자 API 라우트 작성**

```ts
// src/app/api/admin/businesses/[id]/route.ts
import { NextResponse } from "next/server";
import { assertAdmin } from "@/lib/supabase/adminAuth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await assertAdmin();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;
  const { isActive } = (await request.json()) as { isActive?: boolean };
  if (typeof isActive !== "boolean") {
    return NextResponse.json({ error: "isActive must be a boolean" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("businesses").update({ is_active: isActive }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: 관리자 목록 페이지 작성**

```tsx
// src/app/admin/businesses/page.tsx
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Business } from "@/lib/types";

interface AdminBusinessRow extends Business {
  isActive: boolean;
}

export default function AdminBusinessesPage() {
  const [rows, setRows] = useState<AdminBusinessRow[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const supabase = createClient();
    const { data } = await supabase
      .from("businesses")
      .select("id, name, category, country, address, lat, lng, phone, is_active")
      .order("created_at", { ascending: false });
    setRows(
      (data ?? []).map((r) => ({
        id: r.id,
        name: r.name,
        category: r.category,
        country: r.country,
        address: r.address,
        lat: r.lat,
        lng: r.lng,
        phone: r.phone ?? undefined,
        isActive: r.is_active,
      })),
    );
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function toggle(id: string, next: boolean) {
    await fetch(`/api/admin/businesses/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: next }),
    });
    await load();
  }

  if (loading) return <p className="text-sm text-[var(--color-text-muted)]">로딩 중...</p>;

  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-lg font-bold">업체 지도 관리</h1>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-[var(--color-text-muted)]">
            <th className="py-2">이름</th>
            <th>국가</th>
            <th>업종</th>
            <th>주소</th>
            <th>상태</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b">
              <td className="py-2">{r.name}</td>
              <td>{r.country}</td>
              <td>{r.category}</td>
              <td>{r.address}</td>
              <td>{r.isActive ? "활성" : "비활성"}</td>
              <td>
                <button
                  type="button"
                  onClick={() => toggle(r.id, !r.isActive)}
                  className="rounded-md border px-2 py-1 text-xs"
                >
                  {r.isActive ? "비활성화" : "활성화"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 3: 관리자 nav에 항목 추가**

`src/app/admin/layout.tsx`의 `NAV` 배열에서 `"게시글 관리"` 항목 위에 추가:
```ts
{ href: "/admin/businesses", label: "업체 지도 관리" },
```

- [ ] **Step 4: 타입 체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 5: 수동 검증**

1. 테스트 계정의 `profiles.is_admin`을 `true`로 설정 후 `/admin/businesses` 접속
2. Task 2에서 넣은 테스트 업체가 목록에 보이는지
3. "비활성화" 클릭 → 목록에서 "비활성" 상태로 바뀌는지, `/map`에서 해당 핀이
   사라지는지(새로고침 후 확인) → 다시 "활성화"로 되돌려 확인

- [ ] **Step 6: Commit**

```bash
git add src/app/admin/businesses/page.tsx src/app/api/admin/businesses/\[id\]/route.ts src/app/admin/layout.tsx
git commit -m "feat(admin): 업체 지도 관리 화면(/admin/businesses) 추가

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 11: 카카오 수집 스크립트(TDD) + 환경변수

**Files:**
- Create: `map-data/_lib.mjs`
- Test: `map-data/_lib.test.mjs`
- Create: `map-data/sync-businesses.mjs`
- Modify: `package.json` (test glob에 `map-data/**/*.test.mjs` 추가)

**Interfaces:**
- Produces: `buildSearchQueries(target)`, `mapKakaoPlaceToBusinessRow(place, target)` —
  `sync-businesses.mjs`가 이 둘을 쓴다. 외부에 노출하는 함수는 없음(독립 스크립트).

- [ ] **Step 1: 실패하는 테스트 작성**

```js
// map-data/_lib.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSearchQueries, mapKakaoPlaceToBusinessRow } from "./_lib.mjs";

test("buildSearchQueries: 키워드 × 지역 조합으로 쿼리 문자열 생성", () => {
  const target = { country: "vn", category: "restaurant", keyword: "베트남 음식", regions: ["안산시 원곡동", "서울 광희동"] };
  assert.deepEqual(buildSearchQueries(target), [
    "베트남 음식 안산시 원곡동",
    "베트남 음식 서울 광희동",
  ]);
});

test("mapKakaoPlaceToBusinessRow: 카카오 장소 객체를 businesses row로 변환", () => {
  const place = {
    id: "26338954",
    place_name: "사이공 쌀국수",
    road_address_name: "경기 안산시 단원구 화랑로 123",
    address_name: "경기 안산시 단원구 원곡동 456",
    x: "126.837300",
    y: "37.321500",
    phone: "031-123-4567",
  };
  const target = { country: "vn", category: "restaurant" };
  assert.deepEqual(mapKakaoPlaceToBusinessRow(place, target), {
    name: "사이공 쌀국수",
    category: "restaurant",
    country: "vn",
    address: "경기 안산시 단원구 화랑로 123",
    lat: 37.3215,
    lng: 126.8373,
    phone: "031-123-4567",
    kakao_place_id: "26338954",
  });
});

test("mapKakaoPlaceToBusinessRow: road_address_name 없으면 address_name 사용, phone 없으면 null", () => {
  const place = {
    id: "999",
    place_name: "노이름",
    road_address_name: "",
    address_name: "서울 중구 광희동1가 1",
    x: "126.9",
    y: "37.5",
    phone: "",
  };
  const target = { country: "th", category: "mart" };
  const row = mapKakaoPlaceToBusinessRow(place, target);
  assert.equal(row.address, "서울 중구 광희동1가 1");
  assert.equal(row.phone, null);
});
```

- [ ] **Step 2: 테스트 실행해서 실패 확인**

Run: `node --test map-data/_lib.test.mjs`
Expected: FAIL — `map-data/_lib.mjs` 파일이 없어서 import 에러.

- [ ] **Step 3: 순수 헬퍼 모듈 작성**

```js
// map-data/_lib.mjs
export function buildSearchQueries(target) {
  return target.regions.map((region) => `${target.keyword} ${region}`);
}

export function mapKakaoPlaceToBusinessRow(place, target) {
  return {
    name: place.place_name,
    category: target.category,
    country: target.country,
    address: place.road_address_name || place.address_name,
    lat: Number.parseFloat(place.y),
    lng: Number.parseFloat(place.x),
    phone: place.phone || null,
    kakao_place_id: place.id,
  };
}
```

- [ ] **Step 4: 테스트 실행해서 통과 확인**

Run: `node --test map-data/_lib.test.mjs`
Expected: PASS (3 tests).

- [ ] **Step 5: `package.json` test 스크립트 glob에 `map-data` 추가**

```json
"test": "node --test \"news-digest/**/*.test.mjs\" \"src/**/*.test.mjs\" \"map-data/**/*.test.mjs\""
```

Run: `npm test`
Expected: 기존 테스트 전부 + `map-data/_lib.test.mjs` 3개 모두 PASS.

- [ ] **Step 6: 수집 스크립트 본체 작성**

```js
// map-data/sync-businesses.mjs
import { createClient } from "@supabase/supabase-js";
import { buildSearchQueries, mapKakaoPlaceToBusinessRow } from "./_lib.mjs";

const TARGETS = [
  { country: "vn", category: "restaurant", keyword: "베트남 음식", regions: ["안산시 원곡동", "서울 광희동", "김포시"] },
  { country: "vn", category: "mart", keyword: "베트남 마트", regions: ["안산시 원곡동", "서울 광희동"] },
  { country: "th", category: "restaurant", keyword: "태국 음식", regions: ["서울", "안산시"] },
  { country: "th", category: "mart", keyword: "태국 식료품", regions: ["서울", "안산시"] },
];

const KAKAO_API_KEY = process.env.KAKAO_REST_API_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!KAKAO_API_KEY || !SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("KAKAO_REST_API_KEY / NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY가 필요합니다.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function searchKeyword(query) {
  const res = await fetch(
    `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}`,
    { headers: { Authorization: `KakaoAK ${KAKAO_API_KEY}` } },
  );
  if (!res.ok) {
    console.error(`카카오 검색 실패: ${query} (${res.status})`);
    return [];
  }
  const data = await res.json();
  return data.documents ?? [];
}

async function main() {
  let totalUpserted = 0;
  for (const target of TARGETS) {
    for (const query of buildSearchQueries(target)) {
      const places = await searchKeyword(query);
      const rows = places.map((p) => mapKakaoPlaceToBusinessRow(p, target));
      if (rows.length === 0) continue;
      const { error } = await supabase.from("businesses").upsert(rows, { onConflict: "kakao_place_id" });
      if (error) {
        console.error(`upsert 실패 (${query}):`, error.message);
        continue;
      }
      totalUpserted += rows.length;
      console.log(`"${query}" → ${rows.length}건 upsert`);
    }
  }
  console.log(`완료: 총 ${totalUpserted}건 upsert`);
}

main();
```

- [ ] **Step 7: `.env.local.example`에 설명 보강 (이미 Task 4에서 `KAKAO_REST_API_KEY`
  추가됨 — 수집 스크립트도 같은 키를 재사용한다는 점만 주석에 덧붙인다)**

`.env.local.example`의 `KAKAO_REST_API_KEY=` 줄 바로 위 주석을 아래로 교체:
```
# Optional: 업체 지도 — 카카오 로컬 API. /api/geocode(주소 지오코딩)와
# map-data/sync-businesses.mjs(업체 수집 스크립트) 양쪽에서 재사용, 서버 전용
```

- [ ] **Step 8: 수동 실행 검증 (카카오 키 발급 후)**

```bash
node --env-file=.env.local map-data/sync-businesses.mjs
```

Expected: 각 쿼리별 "N건 upsert" 로그 + "완료: 총 N건 upsert". Supabase SQL
Editor에서 확인:
```sql
select count(*) from businesses where kakao_place_id is not null;
```
재실행했을 때 같은 장소가 중복 생성되지 않고 갱신만 되는지(총 row 수가 늘지 않는지)
두 번 실행해서 비교 확인.

- [ ] **Step 9: Commit**

```bash
git add map-data/_lib.mjs map-data/_lib.test.mjs map-data/sync-businesses.mjs package.json .env.local.example
git commit -m "feat(map): 카카오 로컬 API 업체 수집 스크립트(TDD) 추가

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 12: 전체 통합 검증

**Files:** 없음(검증 전용 태스크, 코드 변경 없음)

- [ ] **Step 1: 자동 검증 전부 재실행**

```bash
npx tsc --noEmit
npm run lint
npm test
npx next build
```

Expected: 전부 성공.

- [ ] **Step 2: 수동 end-to-end 시나리오**

1. 테스트 계정의 `profiles.country`를 `vn`으로 두고 로그인 상태에서 홈 화면 →
   국가 탭이 기본 "전체"로 떠 있는지, "베트남" 탭 클릭 시 베트남 핀만 보이는지
2. 헤더 메뉴바 "지도" → `/map` 전체화면 지도 확인
3. `/board/life/write`에서 업체 위치 체크 → 주소 검색 → 제출 → `/map`에서 파란
   마커로 바로 보이는지(새로고침 후)
4. 그 글의 댓글/신고/삭제가 기존 한국생활 게시글과 동일하게 동작하는지(회귀 없음)
5. `/admin/businesses`에서 비활성화 → 지도에서 사라지는지
6. 헤더 지구본 아이콘으로 언어를 `Tiếng Việt`로 전환 → "지도" 메뉴, 체크박스 라벨,
   핀 정보창의 업종 라벨이 베트남어로 바뀌는지, 지도 타일 자체는 여전히 한국어인지
   (타일 언어는 고정이므로 안 바뀌는 게 정상)
7. Task 2~5에서 넣은 테스트용 더미 데이터(`kakao_place_id = 'test-place-1'`)는
   검증이 끝났으면 SQL Editor에서 삭제:
   ```sql
   delete from businesses where kakao_place_id = 'test-place-1';
   ```

- [ ] **Step 3: 최종 commit (검증 과정에서 코드 수정이 있었다면)**

검증 중 버그를 고쳤다면 그 수정 건별로 개별 commit. 수정이 없었다면 이 태스크는
커밋 없이 종료.
