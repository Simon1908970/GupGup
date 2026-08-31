import { test } from "node:test";
import assert from "node:assert/strict";
import { parseArgs, validateDraft, buildInsertPayload } from "./publish-news.mjs";

const VALID = {
  title: "헤드라인",
  sourceName: "Khaosod",
  sourceUrl: "https://www.khaosod.co.th/x",
  originalLang: "th",
  originalBody: "짧은 발췌 문장.",
  body: "한국어 요약 문장.",
};

test("parseArgs: file plus flags in any order", () => {
  assert.deepEqual(parseArgs(["node", "s", "d.json"]), {
    file: "d.json",
    dryRun: false,
    force: false,
  });
  assert.deepEqual(parseArgs(["node", "s", "--dry-run", "d.json", "--force"]), {
    file: "d.json",
    dryRun: true,
    force: true,
  });
  assert.deepEqual(parseArgs(["node", "s", "--dry-run"]), {
    file: undefined,
    dryRun: true,
    force: false,
  });
});

test("parseArgs: rejects an unknown flag", () => {
  assert.throws(() => parseArgs(["node", "s", "d.json", "--dryrun"]), /unknown flag/);
});

test("validateDraft: a complete draft is valid", () => {
  assert.equal(validateDraft(VALID), null);
});

test("validateDraft: missing or blank required field", () => {
  assert.equal(validateDraft({ ...VALID, body: "" }), "missing: body");
  assert.equal(validateDraft({ ...VALID, title: "   " }), "missing: title");
  assert.equal(validateDraft(null), "draft must be an object");
});

test("validateDraft: sourceUrl must be http(s)", () => {
  assert.equal(validateDraft({ ...VALID, sourceUrl: "ftp://x" }), "invalid: sourceUrl");
  assert.equal(validateDraft({ ...VALID, sourceUrl: "not a url" }), "invalid: sourceUrl");
});

test("validateDraft: originalBody capped at 700 chars", () => {
  assert.equal(validateDraft({ ...VALID, originalBody: "a".repeat(700) }), null);
  assert.equal(
    validateDraft({ ...VALID, originalBody: "a".repeat(701) }),
    "invalid: originalBody too long",
  );
});

test("validateDraft: imageUrl requires imageCredit", () => {
  assert.equal(
    validateDraft({ ...VALID, imageUrl: "https://img/x.jpg" }),
    "missing: imageCredit (required with imageUrl)",
  );
  assert.equal(
    validateDraft({ ...VALID, imageUrl: "https://img/x.jpg", imageCredit: "Photo: A (Pexels)" }),
    null,
  );
});

test("buildInsertPayload: fixed news fields, no points, author from arg", () => {
  const p = buildInsertPayload(VALID, "author-uuid", null);
  assert.equal(p.category, "news");
  assert.equal(p.sub_category, null);
  assert.equal(p.country, "etc");
  assert.equal(p.points_awarded, 0);
  assert.equal(p.author_id, "author-uuid");
  assert.equal(p.original_lang, "th");
  assert.equal(p.thumbnail_url, null);
  assert.equal(p.image_credit, null);
  assert.ok(!("rpc" in p));
});

test("buildInsertPayload: image_credit set only when imageUrl present", () => {
  const withImg = { ...VALID, imageUrl: "https://img/x.jpg", imageCredit: "Photo: A (Pexels)" };
  assert.equal(
    buildInsertPayload(withImg, "a", "https://pub/x.jpg").image_credit,
    "Photo: A (Pexels)",
  );
  assert.equal(buildInsertPayload(VALID, "a", "https://pub/x.jpg").image_credit, null);
});

test("buildInsertPayload: originalLang defaults to th when absent", () => {
  const { originalLang, ...noLang } = VALID;
  void originalLang;
  assert.equal(buildInsertPayload(noLang, "a", null).original_lang, "th");
});
