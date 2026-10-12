import { test } from "node:test";
import assert from "node:assert/strict";
import { parseArgs, validateQuestion, buildRow } from "./publish-questions.mjs";

test("parseArgs: file plus --dry-run in any order", () => {
  assert.deepEqual(parseArgs(["node", "script", "q.json", "--dry-run"]), {
    file: "q.json",
    dryRun: true,
  });
  assert.deepEqual(parseArgs(["node", "script", "--dry-run", "q.json"]), {
    file: "q.json",
    dryRun: true,
  });
  assert.deepEqual(parseArgs(["node", "script", "q.json"]), { file: "q.json", dryRun: false });
});

test("parseArgs: rejects an unknown flag", () => {
  assert.throws(() => parseArgs(["node", "script", "q.json", "--force"]), /unknown flag/);
});

const VALID_QUESTION = {
  displayDate: "2026-11-01",
  level: "beginner",
  type: "vocab",
  question: "다음 중 '학교'의 뜻으로 알맞은 것은?",
  choices: ["공부하는 곳", "밥 먹는 곳", "잠자는 곳", "운동만 하는 곳"],
  answerIndex: 0,
  explanation: "'학교'는 학생들이 공부하는 곳을 뜻합니다.",
};

test("validateQuestion: a complete question is valid", () => {
  assert.equal(validateQuestion(VALID_QUESTION), null);
});

test("validateQuestion: rejects malformed displayDate", () => {
  assert.match(
    validateQuestion({ ...VALID_QUESTION, displayDate: "2026/11/01" }),
    /displayDate/,
  );
});

test("validateQuestion: rejects unknown level/type", () => {
  assert.match(validateQuestion({ ...VALID_QUESTION, level: "expert" }), /level/);
  assert.match(validateQuestion({ ...VALID_QUESTION, type: "listening" }), /type/);
});

test("validateQuestion: requires exactly 4 non-empty choices", () => {
  assert.match(validateQuestion({ ...VALID_QUESTION, choices: ["a", "b", "c"] }), /choices/);
  assert.match(
    validateQuestion({ ...VALID_QUESTION, choices: ["a", "b", "c", ""] }),
    /choices/,
  );
});

test("validateQuestion: answerIndex must be an integer 0-3", () => {
  assert.match(validateQuestion({ ...VALID_QUESTION, answerIndex: 4 }), /answerIndex/);
  assert.match(validateQuestion({ ...VALID_QUESTION, answerIndex: -1 }), /answerIndex/);
  assert.match(validateQuestion({ ...VALID_QUESTION, answerIndex: 1.5 }), /answerIndex/);
});

test("validateQuestion: missing explanation is rejected", () => {
  assert.match(validateQuestion({ ...VALID_QUESTION, explanation: "" }), /explanation/);
});

test("buildRow: maps camelCase question to snake_case row, passage omitted when absent", () => {
  assert.deepEqual(buildRow(VALID_QUESTION), {
    display_date: "2026-11-01",
    level: "beginner",
    type: "vocab",
    passage: null,
    question: "다음 중 '학교'의 뜻으로 알맞은 것은?",
    choices: ["공부하는 곳", "밥 먹는 곳", "잠자는 곳", "운동만 하는 곳"],
    answer_index: 0,
    explanation: "'학교'는 학생들이 공부하는 곳을 뜻합니다.",
  });
});

test("buildRow: includes trimmed passage when present (reading type)", () => {
  const row = buildRow({
    ...VALID_QUESTION,
    type: "reading",
    passage: "  저는 매일 아침 7시에 일어납니다.  ",
  });
  assert.equal(row.passage, "저는 매일 아침 7시에 일어납니다.");
});
