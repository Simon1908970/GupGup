import { test } from "node:test";
import assert from "node:assert/strict";
import { parseArgs, validateDraft, buildInsertPayload, resolveAuthorAccount } from "./publish-post.mjs";

const VALID = {
  country: "vn",
  category: "community",
  subCategory: "qna",
  title: "제목",
  body: "본문 내용.",
};

test("parseArgs: file plus --dry-run in any order", () => {
  assert.deepEqual(parseArgs(["node", "s", "d.json"]), { file: "d.json", dryRun: false });
  assert.deepEqual(parseArgs(["node", "s", "--dry-run", "d.json"]), {
    file: "d.json",
    dryRun: true,
  });
});

test("parseArgs: rejects an unknown flag", () => {
  assert.throws(() => parseArgs(["node", "s", "d.json", "--force"]), /unknown flag/);
});

test("validateDraft: a complete draft is valid", () => {
  assert.equal(validateDraft(VALID), null);
});

test("validateDraft: missing or blank required field", () => {
  assert.equal(validateDraft({ ...VALID, body: "" }), "missing: body");
  assert.equal(validateDraft({ ...VALID, title: "   " }), "missing: title");
  assert.equal(validateDraft(null), "draft must be an object");
});

test("validateDraft: rejects an unknown country", () => {
  assert.equal(validateDraft({ ...VALID, country: "kr" }), "invalid: country");
});

test("validateDraft: rejects news (operator-only) or an unknown category", () => {
  assert.equal(validateDraft({ ...VALID, category: "news" }), "invalid: category");
  assert.equal(validateDraft({ ...VALID, category: "bogus" }), "invalid: category");
});

test("buildInsertPayload: maps fields and defaults attachments/membersOnly", () => {
  assert.deepEqual(buildInsertPayload(VALID, "author-id", null), {
    category: "community",
    sub_category: "qna",
    country: "vn",
    author_id: "author-id",
    points_awarded: 0,
    title: "제목",
    body: "본문 내용.",
    attachments: [],
    members_only: false,
  });
});

test("buildInsertPayload: membersOnly true is passed through as members_only", () => {
  const payload = buildInsertPayload({ ...VALID, membersOnly: true }, "author-id", null);
  assert.equal(payload.members_only, true);
});

test("validateDraft: rejects a non-boolean membersOnly", () => {
  assert.equal(validateDraft({ ...VALID, membersOnly: "yes" }), "invalid: membersOnly");
});

test("buildInsertPayload: an uploaded image becomes a single attachment", () => {
  const payload = buildInsertPayload(VALID, "author-id", "https://example.com/x.jpg");
  assert.deepEqual(payload.attachments, [
    { url: "https://example.com/x.jpg", type: "image" },
  ]);
});

test("buildInsertPayload: subCategory is optional", () => {
  const draft = { country: "vn", category: "community", title: "제목", body: "본문 내용." };
  const payload = buildInsertPayload(draft, "author-id", null);
  assert.equal(payload.sub_category, null);
});

test("validateDraft: rejects a blank author", () => {
  assert.equal(validateDraft({ ...VALID, author: "" }), "invalid: author");
  assert.equal(validateDraft({ ...VALID, author: "  " }), "invalid: author");
});

const ACCOUNTS = { vn: { country: "vn", profileId: "country-vn-id" } };
const QUESTION_ACCOUNTS = {
  "vn-q1": { country: "vn", profileId: "q1-id" },
  "th-q1": { country: "th", profileId: "th-q1-id" },
};

test("resolveAuthorAccount: no author falls back to the plain country account", () => {
  assert.deepEqual(resolveAuthorAccount(VALID, ACCOUNTS, QUESTION_ACCOUNTS), {
    profileId: "country-vn-id",
  });
});

test("resolveAuthorAccount: no author errors when the country account isn't set up", () => {
  const result = resolveAuthorAccount({ ...VALID, country: "th" }, ACCOUNTS, QUESTION_ACCOUNTS);
  assert.match(result.error, /no bot account set up for country "th"/);
});

test("resolveAuthorAccount: an author key resolves through the merged question-account pool", () => {
  assert.deepEqual(resolveAuthorAccount({ ...VALID, author: "vn-q1" }, ACCOUNTS, QUESTION_ACCOUNTS), {
    profileId: "q1-id",
  });
});

test("resolveAuthorAccount: errors when the author key isn't set up", () => {
  const result = resolveAuthorAccount({ ...VALID, author: "vn-q9" }, ACCOUNTS, QUESTION_ACCOUNTS);
  assert.match(result.error, /no bot account set up for author "vn-q9"/);
});

test("resolveAuthorAccount: errors when the author's own country doesn't match the draft", () => {
  const result = resolveAuthorAccount({ ...VALID, country: "vn", author: "th-q1" }, ACCOUNTS, QUESTION_ACCOUNTS);
  assert.match(result.error, /author "th-q1" belongs to country "th", not "vn"/);
});
