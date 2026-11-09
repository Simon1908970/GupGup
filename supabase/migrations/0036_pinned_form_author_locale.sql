-- "내 월급"/"내 생활비" 카드 작성자의 국적 표시용. "익명" 옆에 국기 이모지를
-- 보여달라는 요청(2026-11-09) -- 단, profiles.country(회원가입 때 고른 국가)를
-- 쓰지 않고 "글쓴이의 시스템 언어"(제출 시점의 사이트 UI 언어, 보통 기기
-- 언어로 자동 감지됨 -- src/lib/i18n/LanguageProvider.tsx의 detectBrowserLocale
-- 참고)로 추정한다. 그래서 익명 여부와 무관하게(신원을 특정하는 정보가
-- 아니라 "어느 언어로 쓰고 있었나"일 뿐이라) 공개 뷰에서 마스킹하지 않는다.
--
-- 값은 Locale 코드 그대로 저장(vi/th/id/tl/lo/my/mn/km/ko/en/ru) -- 국가
-- 코드로 바로 안 바꾸는 이유는 화면에서 보여줄 국기만 필요하고, 나중에
-- 다른 용도로 더 쓸 수도 있어서다.

alter table salary_entries add column author_locale text;
alter table living_cost_entries add column author_locale text;

drop view salary_entries_public;
create view salary_entries_public as
select
  e.id,
  e.post_id,
  e.comment_id,
  c.is_deleted,
  e.is_anonymous,
  case when e.is_anonymous then null else e.user_id end as user_id,
  case when e.is_anonymous then null else p.nickname end as nickname,
  case when e.is_anonymous then null else p.avatar_url end as avatar_url,
  case when e.is_anonymous then null else p.country end as country,
  case when e.is_anonymous then false else p.is_withdrawn end as is_withdrawn,
  case when e.is_anonymous then false else p.is_supporter end as is_supporter,
  e.author_locale,
  e.region_province,
  e.region_city,
  e.industry_main,
  e.industry_sub,
  e.visa,
  e.weekly_hours,
  e.monthly_days_off,
  e.night_work,
  e.gross_pay,
  e.overtime_included,
  e.deduct_housing,
  e.deduct_food,
  e.deduct_tax_insurance,
  e.deduct_other,
  e.net_pay,
  e.base_month,
  e.created_at,
  e.updated_at
from salary_entries e
join comments c on c.id = e.comment_id
join profiles p on p.id = e.user_id;

drop view living_cost_entries_public;
create view living_cost_entries_public as
select
  e.id,
  e.post_id,
  e.comment_id,
  c.is_deleted,
  e.is_anonymous,
  case when e.is_anonymous then null else e.user_id end as user_id,
  case when e.is_anonymous then null else p.nickname end as nickname,
  case when e.is_anonymous then null else p.avatar_url end as avatar_url,
  case when e.is_anonymous then null else p.country end as country,
  case when e.is_anonymous then false else p.is_withdrawn end as is_withdrawn,
  case when e.is_anonymous then false else p.is_supporter end as is_supporter,
  e.author_locale,
  e.region_province,
  e.region_city,
  e.status,
  e.household,
  e.housing_type,
  e.net_pay,
  e.rent,
  e.utilities,
  e.phone,
  e.transport,
  e.groceries,
  e.eating_out,
  e.shopping,
  e.other,
  e.total_cost,
  e.remaining,
  e.base_month,
  e.created_at,
  e.updated_at
from living_cost_entries e
join comments c on c.id = e.comment_id
join profiles p on p.id = e.user_id;

grant select on salary_entries_public to anon, authenticated;
grant select on living_cost_entries_public to anon, authenticated;
