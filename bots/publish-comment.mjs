// Publishes one reply comment on an existing post, authored by a "supporter"
// bot account (see CLAUDE.md "국가별 커뮤니티 봇" section). The author can be
// either a per-country posting account (accounts.json) or one of the small
// pool of reply-only personas (reply-accounts.json) -- kept separate so a
// seeded Q&A post and its answer don't share one author. The caller supplies
// a human-approved body already in the target language -- this script only
// resolves the right author id and writes the row; it does not generate
// content.
//
// Usage:
//   node --env-file=.env.local bots/publish-comment.mjs <draft.json> [--dry-run]
//
// draft.json:
//   { postId, author, body, parentId? }
//   - author: a key with a profileId set in accounts.json (vn/th/la/id/mm/
//     ph/mn/etc) or in reply-accounts.json (r1..r5) -- run setup-accounts.mjs
//     or setup-reply-accounts.mjs first if it's missing one

import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { loadAccounts } from "./setup-accounts.mjs";
import { loadReplyAccounts } from "./setup-reply-accounts.mjs";

const REQUIRED = ["postId", "author", "body"];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function loadCommentAuthors() {
  return { ...loadAccounts(), ...loadReplyAccounts() };
}

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
  if (!UUID_RE.test(d.postId)) return "invalid: postId";
  if (d.parentId != null && !UUID_RE.test(d.parentId)) return "invalid: parentId";
  return null;
}

export function buildInsertPayload(d, authorId) {
  return {
    post_id: d.postId,
    author_id: authorId,
    parent_id: d.parentId?.trim() || null,
    body: d.body.trim(),
    points_awarded: 0,
  };
}

async function main() {
  const { file, dryRun } = parseArgs(process.argv);
  if (!file) {
    console.error(
      "usage: node --env-file=.env.local bots/publish-comment.mjs <draft.json> [--dry-run]",
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

  const authors = loadCommentAuthors();
  const account = authors[draft.author];
  if (!account?.profileId) {
    console.error(
      `no bot account set up for author "${draft.author}" -- run setup-accounts.mjs or setup-reply-accounts.mjs first`,
    );
    process.exit(1);
  }

  if (dryRun) {
    console.log(JSON.stringify(buildInsertPayload(draft, account.profileId), null, 2));
    return;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("missing env: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const { data, error } = await supabase
    .from("comments")
    .insert(buildInsertPayload(draft, account.profileId))
    .select("id")
    .single();
  if (error) {
    console.error(`insert failed: ${error.message}`);
    process.exit(1);
  }

  console.log(JSON.stringify({ id: data.id, postId: draft.postId }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
