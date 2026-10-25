// Generates one "question post" draft for a country supporter bot account,
// written by Claude (raw Anthropic Messages API call, no SDK) in the target
// country's own language, following the "질문자 페르소나" prompt documented in
// CLAUDE.md's "국가별 커뮤니티 봇" section.
//
// This script only PRODUCES a draft -- it never publishes. Review the
// printed title/body (and the optional --out file), then run
// bots/publish-post.mjs on that same draft once approved.
//
// --author picks one of question-accounts.json's 3 persona variants per
// country (q1 조심스러운 신입 / q2 당당한 직설 / q3 수다스러운 사연형), so
// questions in the same country don't all read like the same person. When
// given, the draft's "author" field carries through so publish-post.mjs
// posts under that specific persona account instead of the single general
// country account in accounts.json.
//
// Usage:
//   node --env-file=.env.local bots/generate-question.mjs \
//     --country vn --category community --subCategory qna \
//     --topic "버스카드 환불은 어떻게 받나요" --author vn-q2 \
//     [--out bots/drafts/question-vn.json] [--dry-run]
//
// Required env: ANTHROPIC_API_KEY (add to .env.local -- not set yet)

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const QUESTION_ACCOUNTS_PATH = fileURLToPath(new URL("./question-accounts.json", import.meta.url));

const COUNTRIES = ["vn", "th", "la", "id", "mm", "ph", "mn", "kh", "etc"];
const CATEGORIES = ["community", "housing", "life", "marketplace", "university", "meeting"];
const MODEL = "claude-opus-5-5";
const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

const COUNTRY_LABEL = {
  vn: "베트남",
  th: "태국",
  la: "라오스",
  id: "인도네시아",
  mm: "미얀마",
  ph: "필리핀",
  mn: "몽골",
  kh: "캄보디아",
  etc: "기타 국가",
};

const LANGUAGE_BY_COUNTRY = {
  vn: "베트남어 (Tiếng Việt)",
  th: "태국어 (ภาษาไทย)",
  la: "라오어 (ພາສາລາວ)",
  id: "인도네시아어 (Bahasa Indonesia)",
  mm: "미얀마어 (မြန်မာဘာသာ)",
  ph: "필리핀어/타갈로그어 (Tagalog)",
  mn: "몽골어 (Монгол хэл)",
  kh: "크메르어 (ភាសាខ្មែរ)",
  etc: "영어 (English)",
};

const DEFAULT_QUESTION_PERSONA =
  "너의 성격: 평범하고 무난한 태도. 과하게 조심스럽거나 과하게 당당하지 않다.";

export function loadQuestionPersona(authorKey) {
  try {
    const accounts = JSON.parse(readFileSync(QUESTION_ACCOUNTS_PATH, "utf8"));
    return accounts[authorKey]?.persona ?? null;
  } catch {
    return null;
  }
}

export function buildSystemPrompt(country, author) {
  const label = COUNTRY_LABEL[country];
  const lang = LANGUAGE_BY_COUNTRY[country];
  const persona = loadQuestionPersona(author) ?? DEFAULT_QUESTION_PERSONA;
  return `너는 한국에 거주 중인 ${label} 출신 외국인이고, 커뮤니티 게시판에 궁금한 걸
질문하는 글을 쓰는 중이야. 실제 그 나라 사람이 쓴 것처럼 자연스러운 현지어(${lang})로
작성해.

${persona}

1. 질문 전에 짧게 자기 상황을 먼저 밝힌다 -- 한국 거주 기간, 하는 일(유학/취업/결혼 등),
   거주 지역 중 1~2개. 2~3문장 정도로 간결하게.
2. 말투는 ${lang}의 편한 구어체/존댓말 섞인 친근한 톤 -- 커뮤니티 게시판에서 흔히 쓰는
   말투로, 과하게 격식 차리지 않는다.
3. 질문은 구체적으로 -- 가능하면 숫자/기간/장소/절차 중 하나를 구체적으로 궁금해하는
   형태로 쓴다.
4. 필요하면 짧게 감정적 맥락(걱정, 답답함, 기대감)을 한 문장 섞어도 되지만, 사연을 길게
   늘어놓지 않는다.
5. 끝에는 가볍게 "답변 부탁드려요"/"감사합니다" 류의 인사를 붙인다.
6. 사용자가 준 주제만 질문 형식으로 바꿔 쓴다 -- 주제를 확장하거나 지어내지 않는다.
7. 제목은 본문 내용을 15자 내외로 짧게 요약한다.
8. 출력은 반드시 아래 JSON 객체 하나만 -- 다른 설명, 마크다운, 코드블록 없이:
{"title": "<현지어 제목>", "body": "<현지어 본문>"}`;
}

export function parseArgs(argv) {
  const rest = argv.slice(2);
  const get = (flag) => {
    const i = rest.indexOf(flag);
    return i === -1 ? undefined : rest[i + 1];
  };
  return {
    country: get("--country"),
    category: get("--category"),
    subCategory: get("--subCategory"),
    topic: get("--topic"),
    author: get("--author"),
    out: get("--out"),
    dryRun: rest.includes("--dry-run"),
  };
}

export function validateArgs(a) {
  if (!a.country || !COUNTRIES.includes(a.country)) return "invalid/missing: --country";
  if (!a.category || !CATEGORIES.includes(a.category)) return "invalid/missing: --category";
  if (!a.topic || !a.topic.trim()) return "missing: --topic";
  return null;
}

export function parseModelResponse(data) {
  if (data.stop_reason === "refusal") {
    throw new Error(`model refused: ${data.stop_details?.category ?? "unknown"}`);
  }
  if (data.stop_reason === "max_tokens") {
    throw new Error("response truncated at max_tokens");
  }
  const textBlock = data.content?.find((b) => b.type === "text");
  if (!textBlock) throw new Error("no text block in response");

  const jsonText = textBlock.text.trim().replace(/^```(?:json)?\s*|\s*```$/g, "");
  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error(`model did not return valid JSON: ${textBlock.text}`);
  }
  if (typeof parsed.title !== "string" || typeof parsed.body !== "string") {
    throw new Error(`missing title/body in model output: ${jsonText}`);
  }
  return { title: parsed.title.trim(), body: parsed.body.trim() };
}

export async function generateDraft({ country, topic, author }, apiKey, fetchImpl = fetch) {
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
      max_tokens: 4096,
      output_config: { effort: "low" },
      fallbacks: "default",
      system: buildSystemPrompt(country, author),
      messages: [{ role: "user", content: `주제: ${topic}` }],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Anthropic API error ${res.status}: ${body}`);
  }

  return parseModelResponse(await res.json());
}

async function main() {
  const args = parseArgs(process.argv);
  const reason = validateArgs(args);
  if (reason) {
    console.error(
      'usage: node --env-file=.env.local bots/generate-question.mjs --country <vn|th|la|id|mm|ph|mn|kh|etc> --category <community|housing|life|marketplace|university|meeting> --topic "<주제>" [--subCategory <..>] [--author <question-accounts.json key, e.g. vn-q1>] [--out <path>] [--dry-run]',
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
      JSON.stringify({ system: buildSystemPrompt(args.country, args.author), topic: args.topic }, null, 2),
    );
    return;
  }

  const { title, body } = await generateDraft(args, apiKey);

  const draft = {
    country: args.country,
    category: args.category,
    subCategory: args.subCategory,
    author: args.author,
    title,
    body,
  };

  console.log(JSON.stringify(draft, null, 2));

  if (args.out) {
    writeFileSync(args.out, JSON.stringify(draft, null, 2));
    console.error(`written to ${args.out} -- review it, then run bots/publish-post.mjs on it`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
