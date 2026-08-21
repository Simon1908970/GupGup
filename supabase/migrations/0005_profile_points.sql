-- Points are shown only to the account owner (header menu, my-profile screen),
-- never on another user's public profile.

alter table profiles add column points integer not null default 0;
