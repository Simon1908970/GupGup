-- Daily snapshot of the homepage exchange-rate ticker's rates, so the
-- widget can show a day-over-day up/down arrow. Written only by the
-- /api/exchange-rates route using the service-role client (see
-- src/lib/supabase/admin.ts) -- no insert/update policy is defined, so
-- clients cannot write to this table directly, only read it.
create table exchange_rate_history (
  date date not null,
  code text not null,
  rate numeric not null,
  primary key (date, code)
);

alter table exchange_rate_history enable row level security;

create policy "exchange rate history is publicly readable" on exchange_rate_history
  for select using (true);
