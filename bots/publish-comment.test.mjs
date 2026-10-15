import { test } from "node:test";
import assert from "node:assert/strict";
import { parseArgs, validateDraft, buildInsertPayload } from "./publish-comment.mjs";

const VALID = {
  postId: "11111111-1111-1111-1111-111111111111",
  author: "r1",
  body: "답변 내용.",
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
  assert.equal(validateDraft({ ...VALID, postId: "   " }), "missing: postId");
  assert.equal(validateDraft({ ...VALID, author: "" }), "missing: author");
  assert.equal(validateDraft(null), "draft must be an object");
});

test("validateDraft: rejects a non-uuid postId or parentId", () => {
  assert.equal(validateDraft({ ...VALID, postId: "not-a-uuid" }), "invalid: postId");
  assert.equal(validateDraft({ ...VALID, parentId: "not-a-uuid" }), "invalid: parentId");
});

test("buildInsertPayload: maps fields and defaults parent_id to null", () => {
  assert.deepEqual(buildInsertPayload(VALID, "author-id"), {
    post_id: VALID.postId,
    author_id: "author-id",
    parent_id: null,
    body: "답변 내용.",
    points_awarded: 0,
  });
});

test("buildInsertPayload: an explicit parentId is passed through", () => {
  const draft = { ...VALID, parentId: "22222222-2222-2222-2222-222222222222" };
  const payload = buildInsertPayload(draft, "author-id");
  assert.equal(payload.parent_id, draft.parentId);
});
