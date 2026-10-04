-- 오늘의 한국어 연습문제 위젯: 날짜별로 미리 쌓아두고, 그날 날짜 문제만 조회해서
-- 보여주는 구조라 별도 스케줄 작업이 필요 없다.
create table topik_questions (
  id uuid primary key default gen_random_uuid(),
  display_date date not null unique,
  level text not null check (level in ('beginner', 'intermediate', 'advanced')),
  type text not null check (type in ('vocab', 'grammar', 'reading')),
  passage text,
  question text not null,
  choices jsonb not null,
  answer_index smallint not null check (answer_index between 0 and 3),
  explanation text not null,
  created_at timestamptz not null default now()
);

alter table topik_questions enable row level security;
create policy "topik questions are publicly readable"
  on topik_questions for select using (true);
-- insert/update/delete 정책 없음 = 기본 거부. 발행 스크립트는 service role로 upsert.
