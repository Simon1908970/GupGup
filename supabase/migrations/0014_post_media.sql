-- User post attachments: up to 5 photos/videos per post, mixed order preserved.
--
-- Storage: a public bucket 'post-media'. Browsers upload straight to Storage
-- with a short-lived signed upload URL issued by POST /api/post-media
-- (service role). This bypasses the Vercel ~4.5MB request-body limit, which
-- proxying video through an /api route the way avatars work would hit.
-- Public read serves with no storage.objects policy (same as 0002 / 0013).
-- DELETE /api/post-media removes objects on post deletion (service role,
-- path-prefixed by uploader id), so no storage.objects delete policy either.
--
-- The bucket file_size_limit is a single value, so it is set to the 50MB
-- video ceiling; the 5MB photo / 50MB video split is enforced by the sign
-- route and the client. allowed_mime_types is the hard backstop for type.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'post-media', 'post-media', true,
  52428800,
  array[
    'image/png', 'image/jpeg', 'image/webp', 'image/gif',
    'video/mp4', 'video/quicktime', 'video/webm'
  ]
)
on conflict (id) do nothing;

-- Each element: { "url": text, "type": "image" | "video" }. Null-free: default
-- '[]'. posts uses a whole-table SELECT grant (0008 narrowed only profiles),
-- so this is readable by anon/authenticated with no extra grant. The app's
-- shared POST_SELECT references this column unconditionally, so 0014 MUST be
-- applied to production before the code that reads it is deployed (same
-- constraint 0013 documented for image_credit).
alter table posts add column attachments jsonb not null default '[]'::jsonb;
