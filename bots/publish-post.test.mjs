import { test } from "node:test";
import assert from "node:assert/strict";
import { parseArgs, validateDraft, buildInsertPayload } from "./publish-post.mjs";

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

test("buildInsertPayload: maps fields and defaults attachments to empty", () => {
  assert.deepEqual(buildInsertPayload(VALID, "author-id", null), {
    category: "community",
    sub_category: "qna",
    country: "vn",
    author_id: "author-id",
    points_awarded: 0,
    title: "제목",
    body: "본문 내용.",
    attachments: [],
  });
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
