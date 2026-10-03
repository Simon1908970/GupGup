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
