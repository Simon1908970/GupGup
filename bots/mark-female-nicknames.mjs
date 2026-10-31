// One-time fix: female-persona bot accounts (avatarUrl pointing at a
// female-*.svg icon) are visually indistinguishable from male ones once the
// avatar is small, so this appends " (여)" to their nickname. Covers
// accounts.json / question-accounts.json / reply-accounts.json. Updates both
// the json files and the already-created profiles.nickname row in Supabase
// (these accounts already have a profileId from setup-*.mjs having run).
// Safe to re-run: nicknames that already end with " (여)" are left alone.
//
// Usage:
//   node --env-file=.env.local bots/mark-female-nicknames.mjs [--dry-run]

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";

const SUFFIX = " (여)";

const FILES = [
  fileURLToPath(new URL("./accounts.json", import.meta.url)),
  fileURLToPath(new URL("./question-accounts.json", import.meta.url)),
  fileURLToPath(new URL("./reply-accounts.json", import.meta.url)),
];

function isFemale(account) {
  return typeof account.avatarUrl === "string" && account.avatarUrl.includes("female-");
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("missing env: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  for (const path of FILES) {
    const accounts = JSON.parse(readFileSync(path, "utf8"));
    let changed = false;

    for (const [id, account] of Object.entries(accounts)) {
      if (!isFemale(account)) continue;
      if (account.nickname.endsWith(SUFFIX)) continue;

      const newNickname = account.nickname + SUFFIX;

      if (dryRun) {
        console.log(`[dry-run] ${path.split(/[\\/]/).pop()} ${id}: ${account.nickname} -> ${newNickname}`);
        continue;
      }

      if (account.profileId) {
        const { error: updateError } = await supabase
          .from("profiles")
          .update({ nickname: newNickname })
          .eq("id", account.profileId);
        if (updateError) {
          console.error(`${id}: DB update failed: ${updateError.message}`);
          continue;
        }
      }

      account.nickname = newNickname;
      changed = true;
      console.log(`${id}: ${newNickname}`);
    }

    if (changed && !dryRun) {
      writeFileSync(path, JSON.stringify(accounts, null, 2) + "\n");
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
