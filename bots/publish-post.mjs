// Publishes one manually-reviewed post under a country "supporter" bot
// account (see CLAUDE.md "국가별 커뮤니티 봇" section). The caller supplies
// title/body already approved by a human -- this script only resolves the
// right author id and writes the row; it does not generate content.
//
// Usage:
//   node --env-file=.env.local bots/publish-post.mjs <draft.json> [--dry-run]
//
// draft.json:
//   { country, category, subCategory?, title, body, imageUrl? }
//   - country: one of vn/th/la/id/mm/ph/mn/etc (must have a profileId set
//     in accounts.json -- run setup-accounts.mjs first)
//   - category: community/housing/life/marketplace/university/meeting
//     (never "news" -- that is a separate, operator-content category)

import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { loadAccounts } from "./setup-accounts.mjs";

const COUNTRIES = ["vn", "th", "la", "id", "mm", "ph", "mn", "etc"];
const CATEGORIES = ["community", "housing", "life", "marketplace", "university", "meeting"];
const REQUIRED = ["country", "category", "title", "body"];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_EXT = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export function parseArgs(argv) {
  const rest = argv.slice(2);
  const unknown = rest.filter((a) => a.startsWith("-") && a !== "--dry-run");
  if (unknown.length) {
    throw new Error(`unknown flag(s): ${unknown.join(", ")}`);
  }
  return {
    file: rest.find((a) => !a.startsWith("-")),
    dryRun: rest.includes("--dry-run"),
  };
}

export function validateDraft(d) {
  if (!d || typeof d !== "object") return "draft must be an object";
  for (const k of REQUIRED) {
    if (typeof d[k] !== "string" || !d[k].trim()) return `missing: ${k}`;
  }
  if (!COUNTRIES.includes(d.country)) return "invalid: country";
  if (!CATEGORIES.includes(d.category)) return "invalid: category";
  if (d.imageUrl != null && (typeof d.imageUrl !== "string" || !d.imageUrl.trim())) {
    return "invalid: imageUrl";
  }
  return null;
}

export function buildInsertPayload(d, authorId, attachmentUrl) {
  return {
    category: d.category,
    sub_category: d.subCategory?.trim() || null,
    country: d.country,
    author_id: authorId,
    points_awarded: 0,
    title: d.title.trim(),
    body: d.body.trim(),
    attachments: attachmentUrl ? [{ url: attachmentUrl, type: "image" }] : [],
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
    .from("post-media")
    .upload(name, bytes, { contentType });
  if (error) throw error;
  const publicUrl = supabase.storage.from("post-media").getPublicUrl(name).data.publicUrl;
  return { publicUrl, name };
}

async function main() {
  const { file, dryRun } = parseArgs(process.argv);
  if (!file) {
    console.error(
      "usage: node --env-file=.env.local bots/publish-post.mjs <draft.json> [--dry-run]",
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

  const accounts = loadAccounts();
  const account = accounts[draft.country];
  if (!account?.profileId) {
    console.error(
      `no bot account set up for country "${draft.country}" -- run setup-accounts.mjs first`,
    );
    process.exit(1);
  }

  if (dryRun) {
    console.log(
      JSON.stringify(
        buildInsertPayload(draft, account.profileId, draft.imageUrl ? "<uploaded-on-publish>" : null),
        null,
        2,
      ),
    );
    return;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("missing env: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  let attachmentUrl = null;
  let uploadedName = null;
  if (draft.imageUrl) {
    const up = await uploadImage(supabase, draft.imageUrl);
    attachmentUrl = up.publicUrl;
    uploadedName = up.name;
  }

  const { data, error } = await supabase
    .from("posts")
    .insert(buildInsertPayload(draft, account.profileId, attachmentUrl))
    .select("id")
    .single();
  if (error) {
    if (uploadedName) {
      await supabase.storage.from("post-media").remove([uploadedName]).catch(() => {});
    }
    console.error(`insert failed: ${error.message}`);
    process.exit(1);
  }

  console.log(JSON.stringify({ id: data.id, url: `/board/${draft.category}/${data.id}` }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
