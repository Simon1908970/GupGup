-- "내 월급"/"내 생활비" 카드의 세부 항목을 전부 선택 입력으로 완화한다.
--
-- 처음엔 지역·업종·근무시간 등을 필수로 설계했는데, 실제로 외국인 회원이
-- 본인의 세전 월급/공제 내역이나 정확한 동네 이름까지는 모르는 경우가
-- 많다는 피드백으로(2026-11-08) 전부 선택 입력으로 바꾼다. base_month만
-- 필수로 남긴다 -- 폼에 항상 기본값(지난달)이 채워져 있어서 "모름"의
-- 대상이 아니고, (post_id, user_id, base_month) 중복 방지 제약의 기준이라
-- 비워둘 수 없다.
--
-- CHECK 제약(범위 검증)은 그대로 둔다 -- Postgres CHECK는 NULL에 대해
-- 자동으로 통과하므로(피연산자가 NULL이면 식이 FALSE가 아니라 UNKNOWN이
-- 되고, CHECK는 FALSE일 때만 막는다) 입력을 안 한 경우는 막지 않고, 값을
-- 입력했는데 범위를 벗어난 경우만 여전히 막아준다.

alter table salary_entries
  alter column region_province drop not null,
  alter column region_city drop not null,
  alter column industry_main drop not null,
  alter column industry_sub drop not null,
  alter column visa drop not null,
  alter column weekly_hours drop not null,
  alter column monthly_days_off drop not null,
  alter column gross_pay drop not null,
  alter column net_pay drop not null,
  alter column deduct_housing drop not null,
  alter column deduct_food drop not null,
  alter column deduct_tax_insurance drop not null,
  alter column deduct_other drop not null;

alter table living_cost_entries
  alter column region_province drop not null,
  alter column region_city drop not null,
  alter column status drop not null,
  alter column household drop not null,
  alter column housing_type drop not null,
  alter column net_pay drop not null,
  alter column rent drop not null,
  alter column utilities drop not null,
  alter column phone drop not null,
  alter column transport drop not null,
  alter column groceries drop not null,
  alter column eating_out drop not null,
  alter column shopping drop not null,
  alter column other drop not null,
  alter column total_cost drop not null,
  alter column remaining drop not null;
