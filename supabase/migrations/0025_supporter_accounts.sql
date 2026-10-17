-- Marks the small set of operator-run "country supporter" accounts used to
-- seed board content and answer general informational questions (see
-- bots/README.md). The UI shows a small "서포터" label next to these
-- accounts' nicknames so they are not indistinguishable from regular
-- members. Only the service role sets this column -- 0020's column-level
-- UPDATE grant to anon/authenticated does not list it, so it can't be
-- toggled through the client API.

alter table profiles add column is_supporter boolean not null default false;
