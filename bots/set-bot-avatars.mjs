// One-time fix for supporter bot accounts (accounts.json, question-accounts.json,
// reply-accounts.json): they were created via setup-*.mjs without profiles.avatar_url,
// so they show a blank avatar instead of one of the signup default-avatar icons.
// Assigns a random avatar to every bot profile that doesn't already have one set.
// None of the current personas read as female, so this only picks from the male
// icons in DEFAULT_AVATARS (src/lib/constants/avatars.ts).
// Safe to re-run: profiles that already have avatar_url (checked in the DB, not just
// the json) are left untouched; newly-set ones are also recorded back into the json
// files as `avatarUrl` for visibility.
//
// Usage:
//   node --env-file=.env.local bots/set-bot-avatars.mjs [--dry-run]

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";

const MALE_AVATARS = [1, 2, 3, 4, 5].map((n) => `/avatars/male-${n}.svg`);

const FILES = [
  fileURLToPath(new URL("./accounts.json", import.meta.url)),
  fileURLToPath(new URL("./question-accounts.json", import.meta.url)),
  fileURLToPath(new URL("./reply-accounts.json", import.meta.url)),
];

function pickRandomAvatar() {
  return MALE_AVATARS[Math.floor(Math.random() * MALE_AVATARS.length)];
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
      if (!account.profileId) continue;

      const { data: profile, error: fetchError } = await supabase
        .from("profiles")
        .select("avatar_url")
        .eq("id", account.profileId)
        .maybeSingle();
      if (fetchError) {
        console.error(`${id}: fetch failed: ${fetchError.message}`);
        continue;
      }

      if (profile?.avatar_url) {
        console.log(`skip ${id}: already has avatar_url (${profile.avatar_url})`);
        if (account.avatarUrl !== profile.avatar_url) {
          account.avatarUrl = profile.avatar_url;
          changed = true;
        }
        continue;
      }

      const avatarUrl = pickRandomAvatar();
      if (dryRun) {
        console.log(`[dry-run] would set ${id} -> ${avatarUrl}`);
        continue;
      }

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: avatarUrl })
        .eq("id", account.profileId);
      if (updateError) {
        console.error(`${id}: update failed: ${updateError.message}`);
        continue;
      }

      account.avatarUrl = avatarUrl;
      changed = true;
      console.log(`${id}: set avatar -> ${avatarUrl}`);
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
