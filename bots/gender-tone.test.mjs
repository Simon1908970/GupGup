import { test } from "node:test";
import assert from "node:assert/strict";
import { GENDER_TONE_NOTES, genderFromAvatar, genderToneNote, genderToneNoteForAccount } from "./gender-tone.mjs";

test("genderFromAvatar: reads male-/female- avatar file names", () => {
  assert.equal(genderFromAvatar("/avatars/female-3.svg"), "female");
  assert.equal(genderFromAvatar("/avatars/male-1.svg"), "male");
  assert.equal(genderFromAvatar("/avatars/other.svg"), null);
  assert.equal(genderFromAvatar(undefined), null);
});

test("GENDER_TONE_NOTES: every bot country except etc has male+female notes; la reuses th", () => {
  for (const c of ["vn", "th", "la", "id", "mm", "ph", "mn", "kh"]) {
    assert.ok(GENDER_TONE_NOTES[c]?.male, `${c} male`);
    assert.ok(GENDER_TONE_NOTES[c]?.female, `${c} female`);
  }
  assert.equal(GENDER_TONE_NOTES.la, GENDER_TONE_NOTES.th);
  assert.equal(genderToneNote("etc", "female"), "");
});

test("genderToneNoteForAccount: empty for missing account or unknown gender", () => {
  assert.equal(genderToneNoteForAccount(null), "");
  assert.equal(genderToneNoteForAccount({ country: "vn", avatarUrl: "/x.svg" }), "");
  assert.match(genderToneNoteForAccount({ country: "kh", avatarUrl: "/avatars/female-1.svg" }), /ចែ/);
});
