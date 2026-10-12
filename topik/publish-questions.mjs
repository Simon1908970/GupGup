// 오늘의 한국어 연습문제를 한 달치(또는 원하는 기간)씩 한 번에 Supabase에 올린다.
// 날짜별로 미리 다 올려두면 위젯이 그날 날짜 문제만 조회하는 구조라 별도
// 스케줄 작업 없이도 매일 자동으로 문제가 바뀐다.
//
// Usage:
//   node --env-file=.env.local topik/publish-questions.mjs <questions.json> [--dry-run]
//
// questions.json: 아래 형태의 객체 배열
//   { displayDate: "YYYY-MM-DD", level: "beginner"|"intermediate"|"advanced",
//     type: "vocab"|"grammar"|"reading", passage?: string, question: string,
//     choices: [string, string, string, string], answerIndex: 0-3, explanation: string }

import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";

const LEVELS = ["beginner", "intermediate", "advanced"];
const TYPES = ["vocab", "grammar", "reading"];

export function parseArgs(argv) {
  const rest = argv.slice(2);
  const unknown = rest.filter((a) => a.startsWith("-") && a !== "--dry-run");
  if (unknown.length) {
    throw new Error(`unknown flag(s): ${unknown.join(", ")}`);
  }
  return {
    file: rest.find((a) => !a.startsWith("-")),
    dryRun: rest.includes("--dry-run"),
  };
}

export function validateQuestion(q) {
  if (!q || typeof q !== "object") return "question must be an object";
  if (typeof q.displayDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(q.displayDate)) {
    return "invalid: displayDate (expected YYYY-MM-DD)";
  }
  if (!LEVELS.includes(q.level)) return `invalid: level (expected ${LEVELS.join("/")})`;
  if (!TYPES.includes(q.type)) return `invalid: type (expected ${TYPES.join("/")})`;
  if (typeof q.question !== "string" || !q.question.trim()) return "missing: question";
  if (
    !Array.isArray(q.choices) ||
    q.choices.length !== 4 ||
    q.choices.some((c) => typeof c !== "string" || !c.trim())
  ) {
    return "invalid: choices (expected 4 non-empty strings)";
  }
  if (!Number.isInteger(q.answerIndex) || q.answerIndex < 0 || q.answerIndex > 3) {
    return "invalid: answerIndex (expected an integer 0-3)";
  }
  if (typeof q.explanation !== "string" || !q.explanation.trim()) return "missing: explanation";
  if (q.passage != null && (typeof q.passage !== "string" || !q.passage.trim())) {
    return "invalid: passage";
  }
  return null;
}

export function buildRow(q) {
  return {
    display_date: q.displayDate,
    level: q.level,
    type: q.type,
    passage: q.passage ? q.passage.trim() : null,
    question: q.question.trim(),
    choices: q.choices.map((c) => c.trim()),
    answer_index: q.answerIndex,
    explanation: q.explanation.trim(),
  };
}

async function main() {
  const { file, dryRun } = parseArgs(process.argv);
  if (!file) {
    console.error(
      "usage: node --env-file=.env.local topik/publish-questions.mjs <questions.json> [--dry-run]",
    );
    process.exit(1);
  }

  let questions;
  try {
    questions = JSON.parse(readFileSync(file, "utf8"));
  } catch (err) {
    console.error(`cannot read file: ${err.message}`);
    process.exit(1);
  }
  if (!Array.isArray(questions) || questions.length === 0) {
    console.error("invalid: file must contain a non-empty array of questions");
    process.exit(1);
  }

  for (const [i, q] of questions.entries()) {
    const reason = validateQuestion(q);
    if (reason) {
      console.error(`invalid question at index ${i} (${q?.displayDate ?? "?"}): ${reason}`);
      process.exit(1);
    }
  }

  const rows = questions.map(buildRow);

  if (dryRun) {
    console.log(JSON.stringify(rows, null, 2));
    return;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("missing env: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const { error } = await supabase.from("topik_questions").upsert(rows, { onConflict: "display_date" });
  if (error) {
    console.error(`upsert failed: ${error.message}`);
    process.exit(1);
  }

  const dates = rows.map((r) => r.display_date).sort();
  console.log(`완료: ${rows.length}건 upsert (${dates[0]} ~ ${dates[dates.length - 1]})`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
