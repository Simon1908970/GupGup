import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  ATTACHMENT_IMAGE_TYPES,
  ATTACHMENT_VIDEO_TYPES,
  MAX_IMAGE_BYTES,
  MAX_VIDEO_BYTES,
} from "@/lib/types";

const BUCKET = "post-media";

const EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
};

const IMAGE_TYPES: readonly string[] = ATTACHMENT_IMAGE_TYPES;
const VIDEO_TYPES: readonly string[] = ATTACHMENT_VIDEO_TYPES;

// Issue a short-lived signed upload URL so the browser can PUT the file
// straight to Storage (the Vercel ~4.5MB request-body limit rules out
// proxying video through this route the way /api/avatar proxies images).
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { contentType?: unknown; size?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const contentType = typeof body.contentType === "string" ? body.contentType : "";
  const size = typeof body.size === "number" ? body.size : NaN;
  const isImage = IMAGE_TYPES.includes(contentType);
  const isVideo = VIDEO_TYPES.includes(contentType);

  if (!isImage && !isVideo) {
    return NextResponse.json({ error: "unsupported file type" }, { status: 400 });
  }
  if (!Number.isFinite(size) || size <= 0) {
    return NextResponse.json({ error: "invalid size" }, { status: 400 });
  }
  if (isImage && size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "image too large" }, { status: 400 });
  }
  if (isVideo && size > MAX_VIDEO_BYTES) {
    return NextResponse.json({ error: "video too large" }, { status: 400 });
  }

  const admin = createAdminClient();
  const path = `${user.id}/${crypto.randomUUID()}.${EXT[contentType]}`;
  const { data, error } = await admin.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "could not create upload url" },
      { status: 500 },
    );
  }

  const {
    data: { publicUrl },
  } = admin.storage.from(BUCKET).getPublicUrl(path);

  return NextResponse.json({
    path: data.path,
    token: data.token,
    publicUrl,
    type: isImage ? "image" : "video",
  });
}

// Best-effort cleanup of a post's attachment objects when the post is deleted.
// Only paths owned by the caller (prefixed with their user id) are touched.
export async function DELETE(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { urls?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const urls = Array.isArray(body.urls) ? body.urls.filter((u): u is string => typeof u === "string") : [];
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const paths = urls
    .map((u) => {
      const i = u.indexOf(marker);
      return i === -1 ? null : decodeURIComponent(u.slice(i + marker.length));
    })
    .filter((p): p is string => !!p && p.startsWith(`${user.id}/`));

  if (paths.length === 0) return NextResponse.json({ removed: 0 });

  const admin = createAdminClient();
  const { error } = await admin.storage.from(BUCKET).remove(paths);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ removed: paths.length });
}
