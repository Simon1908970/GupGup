// Publishes one news post to Supabase from a JSON draft.
// Usage:
//   node --env-file=.env.local news-digest/publish-news.mjs <draft.json> [--dry-run] [--force]
//
// draft.json:
//   { title, sourceName, sourceUrl, originalLang?, originalBody, body, imageUrl?, imageCredit? }
//   - originalBody: source-language excerpt, 2-4 sentences, <= 700 chars
//   - body: Korean summary, rewritten in own words
//   - imageUrl + imageCredit: optional; if imageUrl is set, imageCredit is required

import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";

const MAX_ORIGINAL_BODY = 700;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const REQUIRED = ["title", "sourceName", "sourceUrl", "originalBody", "body"];
const IMAGE_EXT = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export function parseArgs(argv) {
  const rest = argv.slice(2);
  const unknown = rest.filter(
    (a) => a.startsWith("-") && a !== "--dry-run" && a !== "--force",
  );
  if (unknown.length) {
    throw new Error(`unknown flag(s): ${unknown.join(", ")}`);
  }
  return {
    file: rest.find((a) => !a.startsWith("-")),
    dryRun: rest.includes("--dry-run"),
    force: rest.includes("--force"),
  };
}

export function validateDraft(d) {
  if (!d || typeof d !== "object") return "draft must be an object";
  for (const k of REQUIRED) {
    if (typeof d[k] !== "string" || !d[k].trim()) return `missing: ${k}`;
  }
  let url;
  try {
    url = new URL(d.sourceUrl.trim());
  } catch {
    return "invalid: sourceUrl";
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return "invalid: sourceUrl";
  if (d.originalBody.trim().length > MAX_ORIGINAL_BODY) return "invalid: originalBody too long";
  if (d.imageUrl != null && (typeof d.imageUrl !== "string" || !d.imageUrl.trim())) {
    return "invalid: imageUrl";
  }
  if (d.imageUrl && !String(d.imageCredit ?? "").trim()) {
    return "missing: imageCredit (required with imageUrl)";
  }
  return null;
}

export function buildInsertPayload(d, authorId, thumbnailUrl) {
  return {
    category: "news",
    sub_category: null,
    country: "etc",
    author_id: authorId,
    points_awarded: 0,
    title: d.title.trim(),
    body: d.body.trim(),
    original_body: d.originalBody.trim(),
    original_lang: String(d.originalLang || "th").trim(),
    source_name: d.sourceName.trim(),
    source_url: d.sourceUrl.trim(),
    thumbnail_url: thumbnailUrl ?? null,
    image_credit: d.imageUrl ? String(d.imageCredit ?? "").trim() || null : null,
  };
}

async function uploadImage(supabase, imageUrl) {
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`image fetch failed: ${res.status}`);
  const contentType = res.headers.get("content-type") || "";
  const ext = IMAGE_EXT[contentType];
  if (!ext) throw new Error(`unsupported image type: ${contentType}`);
  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.byteLength > MAX_IMAGE_BYTES) throw new Error("image too large (>5MB)");
  const name = `${randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from("news")
    .upload(name, bytes, { contentType });
  if (error) throw error;
  const publicUrl = supabase.storage.from("news").getPublicUrl(name).data.publicUrl;
  return { publicUrl, name };
}

async function main() {
  const { file, dryRun, force } = parseArgs(process.argv);
  if (!file) {
    console.error(
      "usage: node --env-file=.env.local news-digest/publish-news.mjs <draft.json> [--dry-run] [--force]",
    );
    process.exit(1);
  }

  let draft;
  try {
    draft = JSON.parse(readFileSync(file, "utf8"));
  } catch (err) {
    console.error(`cannot read draft: ${err.message}`);
    process.exit(1);
  }

  const reason = validateDraft(draft);
  if (reason) {
    console.error(`invalid draft: ${reason}`);
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const authorId = process.env.NEWS_AUTHOR_ID;
  if (!url || !key || !authorId) {
    console.error(
      "missing env: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / NEWS_AUTHOR_ID",
    );
    process.exit(1);
  }

  if (dryRun) {
    console.log(
      JSON.stringify(
        buildInsertPayload(draft, authorId, draft.imageUrl ? "<uploaded-on-publish>" : null),
        null,
        2,
      ),
    );
    return;
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const { data: dupes, error: dupeError } = await supabase
    .from("posts")
    .select("id")
    .eq("category", "news")
    .eq("source_url", draft.sourceUrl.trim())
    .order("created_at", { ascending: false })
    .limit(1);
  if (dupeError) {
    console.error(`dedupe check failed: ${dupeError.message}`);
    process.exit(1);
  }
  const dupe = dupes?.[0];
  if (dupe && !force) {
    console.error(
      `already published: /board/news/${dupe.id}  (use --force to publish again)`,
    );
    process.exit(1);
  }

  let thumbnailUrl = null;
  let uploadedName = null;
  if (draft.imageUrl) {
    const up = await uploadImage(supabase, draft.imageUrl);
    thumbnailUrl = up.publicUrl;
    uploadedName = up.name;
  }

  const { data, error } = await supabase
    .from("posts")
    .insert(buildInsertPayload(draft, authorId, thumbnailUrl))
    .select("id")
    .single();
  if (error) {
    if (uploadedName) {
      await supabase.storage.from("news").remove([uploadedName]).catch(() => {});
    }
    console.error(`insert failed: ${error.message}`);
    process.exit(1);
  }

  console.log(JSON.stringify({ id: data.id, url: `/board/news/${data.id}` }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
