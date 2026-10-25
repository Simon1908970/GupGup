import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseArgs,
  validateArgs,
  loadQuestionPersona,
  buildSystemPrompt,
  parseModelResponse,
  generateDraft,
} from "./generate-question.mjs";

test("parseArgs: reads all flags", () => {
  assert.deepEqual(
    parseArgs([
      "node",
      "s",
      "--country",
      "vn",
      "--category",
      "community",
      "--subCategory",
      "qna",
      "--topic",
      "버스카드 환불",
      "--author",
      "vn-q2",
      "--out",
      "d.json",
      "--dry-run",
    ]),
    {
      country: "vn",
      category: "community",
      subCategory: "qna",
      topic: "버스카드 환불",
      author: "vn-q2",
      out: "d.json",
      dryRun: true,
    },
  );
});

test("parseArgs: dryRun defaults to false, subCategory/out undefined", () => {
  const a = parseArgs(["node", "s", "--country", "vn", "--category", "community", "--topic", "t"]);
  assert.equal(a.dryRun, false);
  assert.equal(a.subCategory, undefined);
  assert.equal(a.out, undefined);
});

test("validateArgs: a complete set is valid", () => {
  assert.equal(validateArgs({ country: "vn", category: "community", topic: "t" }), null);
});

test("validateArgs: rejects an unknown country", () => {
  assert.equal(validateArgs({ country: "kr", category: "community", topic: "t" }), "invalid/missing: --country");
});

test("validateArgs: rejects news (operator-only) or an unknown category", () => {
  assert.equal(validateArgs({ country: "vn", category: "news", topic: "t" }), "invalid/missing: --category");
  assert.equal(validateArgs({ country: "vn", category: "bogus", topic: "t" }), "invalid/missing: --category");
});

test("validateArgs: rejects a missing/blank topic", () => {
  assert.equal(validateArgs({ country: "vn", category: "community", topic: "" }), "missing: --topic");
  assert.equal(validateArgs({ country: "vn", category: "community", topic: "   " }), "missing: --topic");
});

test("buildSystemPrompt: names the country and its language", () => {
  const prompt = buildSystemPrompt("th");
  assert.match(prompt, /태국/);
  assert.match(prompt, /ภาษาไทย/);
});

test("loadQuestionPersona: returns each country's 3 distinct persona lines", () => {
  assert.match(loadQuestionPersona("vn-q1"), /조심스러운 신입/);
  assert.match(loadQuestionPersona("vn-q2"), /당당하고 직설적인/);
  assert.match(loadQuestionPersona("vn-q3"), /수다스럽고 친근한/);
  assert.match(loadQuestionPersona("th-q1"), /조심스러운 신입/);
});

test("loadQuestionPersona: returns null for an unknown author key", () => {
  assert.equal(loadQuestionPersona(undefined), null);
  assert.equal(loadQuestionPersona("not-a-real-author"), null);
});

test("buildSystemPrompt: an author key injects that persona's own voice", () => {
  assert.match(buildSystemPrompt("vn", "vn-q1"), /조심스러운 신입/);
  assert.match(buildSystemPrompt("vn", "vn-q3"), /수다스럽고 친근한/);
});

test("buildSystemPrompt: falls back to a generic persona when no author is given or found", () => {
  assert.match(buildSystemPrompt("vn", undefined), /평범하고 무난한 태도/);
  assert.match(buildSystemPrompt("vn", "not-a-real-author"), /평범하고 무난한 태도/);
});

test("parseModelResponse: extracts title/body from a plain JSON text block", () => {
  const data = { content: [{ type: "text", text: '{"title": "제목", "body": "본문"}' }] };
  assert.deepEqual(parseModelResponse(data), { title: "제목", body: "본문" });
});

test("parseModelResponse: strips a ```json fenced block", () => {
  const data = { content: [{ type: "text", text: '```json\n{"title": "제목", "body": "본문"}\n```' }] };
  assert.deepEqual(parseModelResponse(data), { title: "제목", body: "본문" });
});

test("parseModelResponse: ignores leading thinking blocks", () => {
  const data = {
    content: [
      { type: "thinking", thinking: "" },
      { type: "text", text: '{"title": "제목", "body": "본문"}' },
    ],
  };
  assert.deepEqual(parseModelResponse(data), { title: "제목", body: "본문" });
});

test("parseModelResponse: throws on a refusal stop reason", () => {
  assert.throws(
    () => parseModelResponse({ stop_reason: "refusal", stop_details: { category: "general_harms" } }),
    /model refused: general_harms/,
  );
});

test("parseModelResponse: throws on max_tokens truncation", () => {
  assert.throws(() => parseModelResponse({ stop_reason: "max_tokens", content: [] }), /truncated/);
});

test("parseModelResponse: throws when the text block is not valid JSON", () => {
  assert.throws(
    () => parseModelResponse({ content: [{ type: "text", text: "no json here" }] }),
    /did not return valid JSON/,
  );
});

test("parseModelResponse: throws when title or body is missing", () => {
  assert.throws(
    () => parseModelResponse({ content: [{ type: "text", text: '{"title": "제목"}' }] }),
    /missing title\/body/,
  );
});

test("generateDraft: sends the right model/headers/body and returns the parsed draft", async () => {
  let seenUrl, seenInit;
  const fakeFetch = async (url, init) => {
    seenUrl = url;
    seenInit = init;
    return {
      ok: true,
      json: async () => ({ content: [{ type: "text", text: '{"title": "제목", "body": "본문"}' }] }),
    };
  };

  const draft = await generateDraft({ country: "vn", topic: "버스카드 환불" }, "test-key", fakeFetch);

  assert.deepEqual(draft, { title: "제목", body: "본문" });
  assert.equal(seenUrl, "https://api.anthropic.com/v1/messages");
  assert.equal(seenInit.headers["x-api-key"], "test-key");
  assert.equal(seenInit.headers["anthropic-beta"], "server-side-fallback-2026-07-01");

  const body = JSON.parse(seenInit.body);
  assert.equal(body.model, "claude-opus-5-5");
  assert.equal(body.fallbacks, "default");
  assert.match(body.system, /베트남/);
  assert.deepEqual(body.messages, [{ role: "user", content: "주제: 버스카드 환불" }]);
});

test("generateDraft: an author persona is threaded into the system prompt", async () => {
  let seenInit;
  const fakeFetch = async (url, init) => {
    seenInit = init;
    return {
      ok: true,
      json: async () => ({ content: [{ type: "text", text: '{"title": "제목", "body": "본문"}' }] }),
    };
  };

  await generateDraft({ country: "vn", topic: "t", author: "vn-q2" }, "test-key", fakeFetch);

  const body = JSON.parse(seenInit.body);
  assert.match(body.system, /당당하고 직설적인/);
});

test("generateDraft: throws with status and body text on a non-ok response", async () => {
  const fakeFetch = async () => ({ ok: false, status: 429, text: async () => "rate limited" });
  await assert.rejects(
    generateDraft({ country: "vn", topic: "t" }, "test-key", fakeFetch),
    /Anthropic API error 429: rate limited/,
  );
});
