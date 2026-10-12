import { createClient } from "@/lib/supabase/client";
import type { TopikLevel, TopikQuestion, TopikQuestionType } from "@/lib/types";

interface TopikQuestionRow {
  id: string;
  display_date: string;
  level: TopikLevel;
  type: TopikQuestionType;
  passage: string | null;
  question: string;
  choices: string[];
  answer_index: number;
  explanation: string;
}

const TOPIK_SELECT = "id, display_date, level, type, passage, question, choices, answer_index, explanation";

function mapTopikQuestion(row: TopikQuestionRow): TopikQuestion {
  return {
    id: row.id,
    displayDate: row.display_date,
    level: row.level,
    type: row.type,
    passage: row.passage ?? undefined,
    question: row.question,
    choices: row.choices,
    answerIndex: row.answer_index,
    explanation: row.explanation,
  };
}

function todayInSeoul(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
}

export async function fetchTodayTopikQuestion(): Promise<TopikQuestion | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("topik_questions")
    .select(TOPIK_SELECT)
    .eq("display_date", todayInSeoul())
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return mapTopikQuestion(data as unknown as TopikQuestionRow);
}
