// Generates one "answer comment" draft responding to an existing post --
// either the QnA "경험자 선배" persona (한국생활 QnA / 대학 QnA) or a casual
// "반응형" reaction persona (뉴스 / 자유게시판 / 여행맛집 / 연애 정보 / 한국대학),
// chosen by category/subCategory. See CLAUDE.md's "국가별 커뮤니티 봇" section.
//
// For a QnA answer, the --author's entry in reply-accounts.json supplies a
// distinct tone/personality (r1..r5 each have their own "persona" line) so
// five self-seeded threads don't all sound like the same AI voice. All five
// still share the same base rule: answer in whatever language the question
// was written in, never a fixed language.
//
// QnA answers also get Anthropic's web_search tool (see
// https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool)
// so cost/fee/procedure claims are grounded in an actual search instead of
// guessed -- a draft generated before this had a wrong 외국인등록증 재발급
// fee (3만원 vs the real ~35,000원) because nothing forced a lookup. Search
// results aren't published as part of the comment body; they're only logged
// to the console so a human can spot-check the sources before approving.
//
// Like generate-question.mjs, this only PRODUCES a draft -- it never reads
// the board or publishes. You give it the target post's title/body yourself
// (copy it from the site, or from a generate-question.mjs draft for a
// self-seeded Q&A), review the printed answer, then run
// bots/publish-comment.mjs on the --out file (its shape -- {postId, author,
// body} -- is already what that script expects).
//
// Only the categories below are supported; anything else (housing, life/*,
// marketplace, meeting, ...) is rejected -- see CLAUDE.md's "범용 정보성
// 질문에 자동으로 댓글을 다는 기능... 비자/법률/병원 등 민감 카테고리에는
// 절대 자동 댓글을 달지 않는다" caution.
//
// Usage:
//   node --env-file=.env.local bots/generate-answer.mjs \
//     --postId <uuid> --author r1 --category community --subCategory qna \
//     --title "질문 제목" --body "질문 본문" \
//     [--out bots/drafts/answer-1.json] [--dry-run]
//
// Required env: ANTHROPIC_API_KEY (add to .env.local)

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const MODEL = "claude-opus-5-5";
const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REPLY_ACCOUNTS_PATH = fileURLToPath(new URL("./reply-accounts.json", import.meta.url));

const QNA_TARGETS = new Set(["community/qna", "university/qna"]);
const REACTOR_TARGETS = new Set([
  "news",
  "community/free",
  "community/travel",
  "community/dating",
  "university/general",
]);
const ALLOWED_TARGETS = new Set([...QNA_TARGETS, ...REACTOR_TARGETS]);

function targetKey(category, subCategory) {
  return subCategory ? `${category}/${subCategory}` : category;
}

export function isAllowedTarget(category, subCategory) {
  return ALLOWED_TARGETS.has(targetKey(category, subCategory));
}

export function isQnaTarget(category, subCategory) {
  return QNA_TARGETS.has(targetKey(category, subCategory));
}

const DEFAULT_QNA_PERSONA = "너의 말투/성격: 담백하고 직설적인 보통의 선배.";

export function loadReplyPersona(authorKey) {
  try {
    const accounts = JSON.parse(readFileSync(REPLY_ACCOUNTS_PATH, "utf8"));
    return accounts[authorKey]?.persona ?? null;
  } catch {
    return null;
  }
}

const TONE_RULE = `실제 인터넷 댓글창처럼 써라 -- 서로 얼굴 안 보고 쓰는 공간이라 다들 무례하고
단답식이다. 번호 매겨 항목을 나열하거나, 여러 사실을 친절하게 순서대로 설명하는
"교과서적인" 답변은 절대 쓰지 않는다. 핵심 하나만 툭 던지고 끝낸다. (단, 위
페르소나가 원래 다정하거나 친절한 성격으로 적혀 있으면 그 톤은 그대로 유지한다 --
이 규칙은 그 페르소나에는 적용되지 않는다.)`;

function buildQnaSystemPrompt(author) {
  const persona = loadReplyPersona(author) ?? DEFAULT_QNA_PERSONA;
  return `너는 한국에 거주하는 이주민 커뮤니티의 경험 많은 선배야. 아래 후배의 질문에
답글을 하나 작성해.

${persona}

1. 질문에 쓰인 언어를 그대로 파악해서, 반드시 그 언어로만 답변을 작성한다. 검색은
   한국어로 해도 되지만(공식 정보가 대부분 한국어라서), 최종 답변은 검색 결과를
   질문과 같은 언어로 옮겨서 쓴다.
2. "도움이 되셨으면 좋겠습니다" 같은 AI스러운 인사나 뻔한 위로 없이 쓴다. ${TONE_RULE}
3. 수수료/기간/절차처럼 바뀔 수 있는 구체적인 사실은 기억에 의존해 추측하지 말고
   web_search로 하이코리아·출입국·외국인청·법무부 등 공식/신뢰도 높은 출처를 먼저
   찾아보고, 그 결과에 맞춰 답변한다. 검색해도 확실하지 않으면 지어내지 말고
   정확한 기관에 확인해보라고 솔직하게 안내한다. 단, 찾은 사실은 위 1번 톤 그대로
   짧게 녹여서 말하고, 여러 사실을 줄줄이 나열하지 않는다 -- 질문자가 가장 궁금해할
   핵심 한두 개만 골라 말한다.
4. <cite> 같은 인용 태그, 각주 번호, 출처 표시를 본문에 절대 넣지 않는다 -- 검색으로
   확인한 내용도 그냥 자연스러운 문장으로 녹여서 쓴다. 출처는 커뮤니티 댓글에
   안 어울린다.
5. 1~3문장, 커뮤니티 댓글 분량을 넘지 않는다. 다정한 페르소나가 아니라면 2문장을
   넘기지 않는 쪽을 기본으로 한다.
6. 검색을 했든 안 했든, 마지막 출력은 반드시 아래 JSON 객체 하나만 -- 다른 설명,
   마크다운, 코드블록 없이:
{"body": "<답변 본문>"}`;
}

export function buildReactorSystemPrompt(author) {
  const persona = loadReplyPersona(author);
  const personaBlock = persona ? `\n${persona}\n` : "";
  return `너는 이 커뮤니티의 평범한 유저야. 아래 올라온 글에 짧은 반응 댓글을 하나 남겨.
${personaBlock}
1. 글에 쓰인 언어를 그대로 파악해서, 반드시 그 언어로만 댓글을 작성한다.
2. ${TONE_RULE}
3. 1~2문장을 넘지 않는다.
4. 출력은 반드시 아래 JSON 객체 하나만 -- 다른 설명, 마크다운, 코드블록 없이:
{"body": "<댓글 본문>"}`;
}

export function buildSystemPrompt(category, subCategory, author) {
  return isQnaTarget(category, subCategory)
    ? buildQnaSystemPrompt(author)
    : buildReactorSystemPrompt(author);
}

export function parseArgs(argv) {
  const rest = argv.slice(2);
  const get = (flag) => {
    const i = rest.indexOf(flag);
    return i === -1 ? undefined : rest[i + 1];
  };
  return {
    postId: get("--postId"),
    author: get("--author"),
    category: get("--category"),
    subCategory: get("--subCategory"),
    title: get("--title"),
    body: get("--body"),
    out: get("--out"),
    dryRun: rest.includes("--dry-run"),
  };
}

export function validateArgs(a) {
  if (!a.postId || !UUID_RE.test(a.postId)) return "invalid/missing: --postId";
  if (!a.author || !a.author.trim()) return "missing: --author";
  if (!a.category || !isAllowedTarget(a.category, a.subCategory)) {
    return "invalid/unsupported: --category/--subCategory";
  }
  if (!a.title || !a.title.trim()) return "missing: --title";
  if (!a.body || !a.body.trim()) return "missing: --body";
  return null;
}

function extractSources(content) {
  const sources = [];
  for (const block of content ?? []) {
    if (block.type !== "web_search_tool_result" || !Array.isArray(block.content)) continue;
    for (const result of block.content) {
      if (result.type === "web_search_result") {
        sources.push({ url: result.url, title: result.title });
      }
    }
  }
  return sources;
}

export function parseModelResponse(data) {
  if (data.stop_reason === "refusal") {
    throw new Error(`model refused: ${data.stop_details?.category ?? "unknown"}`);
  }
  if (data.stop_reason === "max_tokens") {
    throw new Error("response truncated at max_tokens");
  }
  // With web_search enabled, Claude may emit an earlier "I'll search for..."
  // text block before the tool call -- the final JSON answer is always the
  // LAST text block, after any search result blocks.
  const textBlocks = (data.content ?? []).filter((b) => b.type === "text");
  const textBlock = textBlocks[textBlocks.length - 1];
  if (!textBlock) throw new Error("no text block in response");

  const jsonText = textBlock.text.trim().replace(/^```(?:json)?\s*|\s*```$/g, "");
  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error(`model did not return valid JSON: ${textBlock.text}`);
  }
  if (typeof parsed.body !== "string") {
    throw new Error(`missing body in model output: ${jsonText}`);
  }
  return { body: parsed.body.trim(), sources: extractSources(data.content) };
}

export async function generateAnswer(
  { category, subCategory, author, title, body },
  apiKey,
  fetchImpl = fetch,
) {
  const isQna = isQnaTarget(category, subCategory);
  const res = await fetchImpl(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "server-side-fallback-2026-07-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: isQna ? 2048 : 400,
      output_config: { effort: "low" },
      fallbacks: "default",
      system: buildSystemPrompt(category, subCategory, author),
      messages: [{ role: "user", content: `제목: ${title}\n본문: ${body}` }],
      ...(isQna ? { tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 3 }] } : {}),
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Anthropic API error ${res.status}: ${text}`);
  }

  return parseModelResponse(await res.json());
}

async function main() {
  const args = parseArgs(process.argv);
  const reason = validateArgs(args);
  if (reason) {
    console.error(
      'usage: node --env-file=.env.local bots/generate-answer.mjs --postId <uuid> --author <accounts.json/reply-accounts.json key> --category <news|community|university> [--subCategory <free|travel|dating|qna|general>] --title "<...>" --body "<...>" [--out <path>] [--dry-run]',
    );
    console.error(reason);
    process.exit(1);
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("missing env: ANTHROPIC_API_KEY");
    process.exit(1);
  }

  if (args.dryRun) {
    console.log(
      JSON.stringify(
        { system: buildSystemPrompt(args.category, args.subCategory, args.author), title: args.title },
        null,
        2,
      ),
    );
    return;
  }

  const { body, sources } = await generateAnswer(args, apiKey);

  const draft = { postId: args.postId, author: args.author, body };
  console.log(JSON.stringify(draft, null, 2));
  if (sources?.length) {
    console.error("검색 출처 (발행되는 본문엔 포함 안 됨, 사실관계 확인용):");
    for (const s of sources) console.error(`  - ${s.title}: ${s.url}`);
  }

  if (args.out) {
    writeFileSync(args.out, JSON.stringify(draft, null, 2));
    console.error(`written to ${args.out} -- review it, then run bots/publish-comment.mjs on it`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
