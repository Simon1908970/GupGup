// One-time setup for the 8 country "supporter" accounts (see
// CLAUDE.md "국가별 커뮤니티 봇" section). Creates an auth user + profiles
// row for each country still missing a profileId in accounts.json, then
// writes the new id back into that file. Safe to re-run -- countries that
// already have a profileId are skipped.
//
// Usage:
//   node --env-file=.env.local bots/setup-accounts.mjs [--dry-run]

import { readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";

const ACCOUNTS_PATH = fileURLToPath(new URL("./accounts.json", import.meta.url));

export function loadAccounts() {
  return JSON.parse(readFileSync(ACCOUNTS_PATH, "utf8"));
}

function saveAccounts(accounts) {
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

  const accounts = loadAccounts();
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  for (const [country, account] of Object.entries(accounts)) {
    if (account.profileId) {
      console.log(`skip ${country}: already set up (${account.profileId})`);
      continue;
    }
    if (dryRun) {
      console.log(`[dry-run] would create ${country}: ${account.nickname}`);
      continue;
    }

    const { data: created, error: userError } = await supabase.auth.admin.createUser({
      email: `bot.${country}@gupgup.internal`,
      password: randomUUID() + randomUUID(),
      email_confirm: true,
      user_metadata: { role: "supporter_bot", country },
    });
    if (userError) {
      console.error(`${country}: auth user creation failed: ${userError.message}`);
      continue;
    }

    const { error: profileError } = await supabase.from("profiles").insert({
      id: created.user.id,
      nickname: account.nickname,
      country,
      is_supporter: true,
    });
    if (profileError) {
      console.error(`${country}: profile insert failed: ${profileError.message}`);
      await supabase.auth.admin.deleteUser(created.user.id).catch(() => {});
      continue;
    }

    account.profileId = created.user.id;
    console.log(`${country}: created ${created.user.id} (${account.nickname})`);
  }

  if (!dryRun) saveAccounts(accounts);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
