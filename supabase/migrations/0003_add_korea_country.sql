-- Add "kr" (Korea) as a selectable country value, in addition to the
-- original foreign-resident country list.

alter table profiles drop constraint profiles_country_check;
alter table profiles add constraint profiles_country_check
  check (country in ('vn', 'th', 'la', 'id', 'mm', 'ph', 'mn', 'kr', 'etc'));

alter table posts drop constraint posts_country_check;
alter table posts add constraint posts_country_check
  check (country in ('vn', 'th', 'la', 'id', 'mm', 'ph', 'mn', 'kr', 'etc'));
