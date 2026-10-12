-- Tracks monthly Google Cloud Translation API character usage so admins can
-- watch it against the free tier (500,000 chars/month) before it starts
-- billing. Written only by the service-role client from the
-- /api/translate route (src/app/api/translate/route.ts) -- RLS is enabled
-- with no policies, so no other role can read or write it directly
-- (service_role bypasses RLS entirely, same as every other admin-only
-- table in this schema).

create table translation_usage (
  month text primary key, -- 'YYYY-MM' in UTC
  char_count bigint not null default 0,
  updated_at timestamptz not null default now()
);

alter table translation_usage enable row level security;

create or replace function increment_translation_usage(delta bigint)
returns void
language sql
as $$
  insert into translation_usage (month, char_count, updated_at)
  values (to_char(now() at time zone 'utc', 'YYYY-MM'), delta, now())
  on conflict (month) do update
    set char_count = translation_usage.char_count + excluded.char_count,
        updated_at = now();
$$;

revoke execute on function increment_translation_usage(bigint) from public;
grant execute on function increment_translation_usage(bigint) to service_role;
