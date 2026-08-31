-- News-category article fields. Populated only when category='news';
-- null for every other category. posts uses a whole-table SELECT grant
-- (only profiles was narrowed to column-level in 0008), so these new
-- columns are readable by anon/authenticated with no extra grant.
alter table posts add column original_body text;
alter table posts add column original_lang text;
alter table posts add column source_name  text;
alter table posts add column source_url   text;
