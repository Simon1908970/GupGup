import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseArgs,
  validateArgs,
  isAllowedTarget,
  isQnaTarget,
  loadReplyPersona,
  buildSystemPrompt,
  parseModelResponse,
  generateAnswer,
} from "./generate-answer.mjs";

const POST_ID = "123e4567-e89b-12d3-a456-426614174000";

test("parseArgs: reads all flags", () => {
  assert.deepEqual(
    parseArgs([
      "node",
      "s",
      "--postId",
      POST_ID,
      "--author",
      "vn",
      "--category",
      "community",
      "--subCategory",
      "qna",
      "--title",
      "제목",
      "--body",
      "본문",
      "--out",
      "d.json",
      "--dry-run",
    ]),
    {
      postId: POST_ID,
      author: "vn",
      category: "community",
      subCategory: "qna",
      title: "제목",
      body: "본문",
      out: "d.json",
      dryRun: true,
    },
  );
});

test("parseArgs: dryRun defaults to false, subCategory/out undefined", () => {
  const a = parseArgs([
    "node",
    "s",
    "--postId",
    POST_ID,
    "--author",
    "vn",
    "--category",
    "news",
    "--title",
    "t",
    "--body",
    "b",
  ]);
  assert.equal(a.dryRun, false);
  assert.equal(a.subCategory, undefined);
  assert.equal(a.out, undefined);
});

test("isAllowedTarget: accepts the agreed reactor/qna targets", () => {
  assert.equal(isAllowedTarget("news", undefined), true);
  assert.equal(isAllowedTarget("community", "free"), true);
  assert.equal(isAllowedTarget("community", "travel"), true);
  assert.equal(isAllowedTarget("community", "dating"), true);
  assert.equal(isAllowedTarget("university", "general"), true);
  assert.equal(isAllowedTarget("community", "qna"), true);
  assert.equal(isAllowedTarget("university", "qna"), true);
});

test("isAllowedTarget: rejects sensitive/unlisted categories", () => {
  assert.equal(isAllowedTarget("life", "hospital"), false);
  assert.equal(isAllowedTarget("life", "admin"), false);
  assert.equal(isAllowedTarget("housing", undefined), false);
  assert.equal(isAllowedTarget("marketplace", undefined), false);
  assert.equal(isAllowedTarget("meeting", undefined), false);
});

test("isQnaTarget: true only for the two QnA sub-categories", () => {
  assert.equal(isQnaTarget("community", "qna"), true);
  assert.equal(isQnaTarget("university", "qna"), true);
  assert.equal(isQnaTarget("community", "free"), false);
  assert.equal(isQnaTarget("news", undefined), false);
});

test("validateArgs: a complete set is valid", () => {
  assert.equal(
    validateArgs({
      postId: POST_ID,
      author: "vn",
      category: "community",
      subCategory: "qna",
      title: "t",
      body: "b",
    }),
    null,
  );
});

test("validateArgs: rejects a malformed postId", () => {
  assert.equal(
    validateArgs({ postId: "not-a-uuid", author: "vn", category: "news", title: "t", body: "b" }),
    "invalid/missing: --postId",
  );
});

test("validateArgs: rejects a missing author", () => {
  assert.equal(
    validateArgs({ postId: POST_ID, author: "", category: "news", title: "t", body: "b" }),
    "missing: --author",
  );
});

test("validateArgs: rejects an unsupported category/subCategory", () => {
  assert.equal(
    validateArgs({
      postId: POST_ID,
      author: "vn",
      category: "life",
      subCategory: "hospital",
      title: "t",
      body: "b",
    }),
    "invalid/unsupported: --category/--subCategory",
  );
});

test("validateArgs: rejects missing title/body", () => {
  assert.equal(
    validateArgs({ postId: POST_ID, author: "vn", category: "news", title: "", body: "b" }),
    "missing: --title",
  );
  assert.equal(
    validateArgs({ postId: POST_ID, author: "vn", category: "news", title: "t", body: "  " }),
    "missing: --body",
  );
});

test("buildSystemPrompt: picks the QnA persona for qna sub-categories", () => {
  assert.match(buildSystemPrompt("community", "qna"), /경험 많은 선배/);
  assert.match(buildSystemPrompt("university", "qna"), /경험 많은 선배/);
});

test("buildSystemPrompt: picks the reactor persona otherwise", () => {
  assert.match(buildSystemPrompt("news", undefined), /평범한 유저/);
  assert.match(buildSystemPrompt("community", "free"), /평범한 유저/);
});

test("loadReplyPersona: returns each of the 5 reply accounts' distinct persona line", () => {
  assert.match(loadReplyPersona("r1"), /돌직구/);
  assert.match(loadReplyPersona("r2"), /맏언니\/형/);
  assert.match(loadReplyPersona("r3"), /유머와 드립/);
  assert.match(loadReplyPersona("r4"), /정보통 스타일/);
  assert.match(loadReplyPersona("r5"), /MZ 스타일/);
});

test("loadReplyPersona: returns null for an author with no persona entry", () => {
  assert.equal(loadReplyPersona("vn"), null);
  assert.equal(loadReplyPersona("not-a-real-author"), null);
});

test("buildSystemPrompt: QnA prompt carries the author's own persona line", () => {
  assert.match(buildSystemPrompt("community", "qna", "r1"), /돌직구/);
  assert.match(buildSystemPrompt("community", "qna", "r3"), /유머와 드립/);
});

test("buildSystemPrompt: QnA prompt falls back to a generic persona when the author has none", () => {
  assert.match(buildSystemPrompt("university", "qna", "vn"), /담백하고 직설적인 보통의 선배/);
  assert.match(buildSystemPrompt("university", "qna", undefined), /담백하고 직설적인 보통의 선배/);
});

test("buildSystemPrompt: every QnA variant still requires answering in the question's own language", () => {
  for (const author of ["r1", "r2", "r3", "r4", "r5", undefined]) {
    assert.match(buildSystemPrompt("community", "qna", author), /반드시 그 언어로만 답변을 작성한다/);
  }
});

test("parseModelResponse: extracts body from a plain JSON text block", () => {
  const data = { content: [{ type: "text", text: '{"body": "본문"}' }] };
  assert.deepEqual(parseModelResponse(data), { body: "본문", sources: [] });
});

test("parseModelResponse: strips a ```json fenced block", () => {
  const data = { content: [{ type: "text", text: '```json\n{"body": "본문"}\n```' }] };
  assert.deepEqual(parseModelResponse(data), { body: "본문", sources: [] });
});

test("parseModelResponse: uses the LAST text block when Claude narrates a search first", () => {
  const data = {
    content: [
      { type: "text", text: "검색해볼게요." },
      { type: "server_tool_use", id: "t1", name: "web_search", input: { query: "외국인등록증 재발급 수수료" } },
      {
        type: "web_search_tool_result",
        tool_use_id: "t1",
        content: [{ type: "web_search_result", url: "https://hikorea.go.kr/x", title: "하이코리아" }],
      },
      { type: "text", text: '{"body": "35,000원이에요"}' },
    ],
  };
  assert.deepEqual(parseModelResponse(data), {
    body: "35,000원이에요",
    sources: [{ url: "https://hikorea.go.kr/x", title: "하이코리아" }],
  });
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

test("parseModelResponse: throws when body is missing", () => {
  assert.throws(() => parseModelResponse({ content: [{ type: "text", text: "{}" }] }), /missing body/);
});

test("generateAnswer: sends the right model/headers/body and returns the parsed draft", async () => {
  let seenUrl, seenInit;
  const fakeFetch = async (url, init) => {
    seenUrl = url;
    seenInit = init;
    return { ok: true, json: async () => ({ content: [{ type: "text", text: '{"body": "답변"}' }] }) };
  };

  const draft = await generateAnswer(
    { category: "community", subCategory: "qna", author: "r2", title: "질문", body: "본문" },
    "test-key",
    fakeFetch,
  );

  assert.deepEqual(draft, { body: "답변", sources: [] });
  assert.equal(seenUrl, "https://api.anthropic.com/v1/messages");
  assert.equal(seenInit.headers["x-api-key"], "test-key");

  const body = JSON.parse(seenInit.body);
  assert.equal(body.model, "claude-opus-5-5");
  assert.match(body.system, /경험 많은 선배/);
  assert.match(body.system, /맏언니\/형/);
  assert.deepEqual(body.messages, [{ role: "user", content: "제목: 질문\n본문: 본문" }]);
});

test("generateAnswer: QnA targets get the web_search tool and a higher token budget", async () => {
  let seenInit;
  const fakeFetch = async (url, init) => {
    seenInit = init;
    return { ok: true, json: async () => ({ content: [{ type: "text", text: '{"body": "답변"}' }] }) };
  };

  await generateAnswer(
    { category: "university", subCategory: "qna", author: "r1", title: "t", body: "b" },
    "test-key",
    fakeFetch,
  );

  const body = JSON.parse(seenInit.body);
  assert.equal(body.max_tokens, 2048);
  assert.deepEqual(body.tools, [{ type: "web_search_20250305", name: "web_search", max_uses: 3 }]);
});

test("generateAnswer: reactor targets skip the web_search tool and use a smaller token budget", async () => {
  let seenInit;
  const fakeFetch = async (url, init) => {
    seenInit = init;
    return { ok: true, json: async () => ({ content: [{ type: "text", text: '{"body": "답변"}' }] }) };
  };

  await generateAnswer({ category: "news", title: "t", body: "b" }, "test-key", fakeFetch);

  const body = JSON.parse(seenInit.body);
  assert.equal(body.max_tokens, 400);
  assert.equal(body.tools, undefined);
});

test("generateAnswer: throws with status and body text on a non-ok response", async () => {
  const fakeFetch = async () => ({ ok: false, status: 429, text: async () => "rate limited" });
  await assert.rejects(
    generateAnswer({ category: "news", title: "t", body: "b" }, "test-key", fakeFetch),
    /Anthropic API error 429: rate limited/,
  );
});
