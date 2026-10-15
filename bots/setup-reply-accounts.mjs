// One-time setup for a small pool of "reply" supporter accounts, distinct
// from the per-country posting accounts in accounts.json. These exist so a
// seeded Q&A post and its answer don't share one author (see CLAUDE.md
// "국가별 커뮤니티 봇" section). Like the country accounts, each row gets
// profiles.is_supporter = true, so it still carries the "서포터" label --
// this is seeded content answering itself, not a disguised regular member.
// Creates an auth user + profiles row for each entry still missing a
// profileId in reply-accounts.json, then writes the new id back into that
// file. Safe to re-run -- entries that already have a profileId are skipped.
//
// Usage:
//   node --env-file=.env.local bots/setup-reply-accounts.mjs [--dry-run]

import { readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";

const ACCOUNTS_PATH = fileURLToPath(new URL("./reply-accounts.json", import.meta.url));

export function loadReplyAccounts() {
  return JSON.parse(readFileSync(ACCOUNTS_PATH, "utf8"));
}

function saveReplyAccounts(accounts) {
  writeFileSync(ACCOUNTS_PATH, JSON.stringify(accounts, null, 2) + "\n");
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("missing env: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const accounts = loadReplyAccounts();
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  for (const [id, account] of Object.entries(accounts)) {
    if (account.profileId) {
      console.log(`skip ${id}: already set up (${account.profileId})`);
      continue;
    }
    if (dryRun) {
      console.log(`[dry-run] would create ${id}: ${account.nickname} (${account.country})`);
      continue;
    }

    const { data: created, error: userError } = await supabase.auth.admin.createUser({
      email: `bot.reply.${id}@gupgup.internal`,
      password: randomUUID() + randomUUID(),
      email_confirm: true,
      user_metadata: { role: "reply_bot", replyId: id },
    });
    if (userError) {
      console.error(`${id}: auth user creation failed: ${userError.message}`);
      continue;
    }

    const { error: profileError } = await supabase.from("profiles").insert({
      id: created.user.id,
      nickname: account.nickname,
      country: account.country,
      is_supporter: true,
    });
    if (profileError) {
      console.error(`${id}: profile insert failed: ${profileError.message}`);
      await supabase.auth.admin.deleteUser(created.user.id).catch(() => {});
      continue;
    }

    account.profileId = created.user.id;
    console.log(`${id}: created ${created.user.id} (${account.nickname})`);
  }

  if (!dryRun) saveReplyAccounts(accounts);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
