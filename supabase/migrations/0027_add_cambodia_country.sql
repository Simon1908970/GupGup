-- Add "kh" (Cambodia) as a selectable country value, alongside the
-- existing foreign-resident country list.

alter table profiles drop constraint profiles_country_check;
alter table profiles add constraint profiles_country_check
  check (country in ('vn', 'th', 'la', 'id', 'mm', 'ph', 'mn', 'kh', 'kr', 'etc'));

alter table posts drop constraint posts_country_check;
alter table posts add constraint posts_country_check
  check (country in ('vn', 'th', 'la', 'id', 'mm', 'ph', 'mn', 'kh', 'kr', 'etc'));

alter table businesses drop constraint businesses_country_check;
alter table businesses add constraint businesses_country_check
  check (country in ('vn', 'th', 'la', 'id', 'mm', 'ph', 'mn', 'kh', 'kr', 'etc'));
