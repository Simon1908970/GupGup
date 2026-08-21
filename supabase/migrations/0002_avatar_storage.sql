-- Public bucket for user-uploaded profile photos.
-- Uploads go through the app's server (service role), which bypasses RLS,
-- so no additional storage.objects policies are required here.

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;
