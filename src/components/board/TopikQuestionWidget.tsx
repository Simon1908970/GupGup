"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import type { DictionaryKey } from "@/lib/i18n/dictionaries";
import { fetchTodayTopikQuestion } from "@/lib/supabase/topik";
import type { TopikQuestion } from "@/lib/types";
import { cn } from "@/lib/utils";

export function TopikQuestionWidget() {
  const { t } = useLanguage();
  const [question, setQuestion] = useState<TopikQuestion | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchTodayTopikQuestion()
      .then((q) => {
        if (!cancelled) setQuestion(q);
      })
      .catch(() => {
        if (!cancelled) setQuestion(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // 답을 고르고 2분 뒤에는 다시 처음(미선택) 상태로 돌아간다.
  useEffect(() => {
    if (selected === null) return;
    const timer = setTimeout(() => setSelected(null), 2 * 60 * 1000);
    return () => clearTimeout(timer);
  }, [selected]);

  if (loading || !question) return null;

  return (
    <div className="relative mb-4 overflow-hidden rounded-lg border border-[var(--color-brand-red)]/40 p-4 gg-glossy gg-decorative-card gg-no-sheen">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-base font-extrabold text-[var(--color-brand-red)]">{t("topik.title")}</span>
        <span className="flex gap-0.5">
          <span className="rounded border border-[var(--color-brand-red)] bg-white px-[3px] py-[1px] text-[8px] font-medium text-[var(--color-brand-red)]">
            {t(`topik.level.${question.level}` as DictionaryKey)}
          </span>
          <span className="rounded border border-[var(--color-border-gray)] bg-white px-[3px] py-[1px] text-[8px] font-medium text-[var(--color-text-muted)]">
            {t(`topik.type.${question.type}` as DictionaryKey)}
          </span>
        </span>
      </div>

      {question.passage && (
        <p className="mb-2 rounded-md bg-white/70 p-2 text-sm whitespace-pre-wrap">{question.passage}</p>
      )}
      <p className="mb-3 text-sm font-medium">{question.question}</p>

      <div className="flex flex-col gap-1.5">
        {question.choices.map((choice, i) => {
          const isCorrect = i === question.answerIndex;
          const isSelected = i === selected;
          return (
            <button
              key={i}
              type="button"
              onClick={() => setSelected(i)}
              disabled={selected !== null}
              className={cn(
                "rounded-md border px-3 py-1.5 text-left text-sm transition-colors",
                selected === null &&
                  "border-[var(--color-border-gray)] bg-white hover:border-[var(--color-brand-red)]",
                selected !== null && isCorrect && "border-green-800 bg-green-600 text-white",
                selected !== null &&
                  isSelected &&
                  !isCorrect &&
                  "border-[var(--color-brand-red)] bg-[var(--color-brand-red-light)] text-[var(--color-brand-red)]",
                selected !== null &&
                  !isSelected &&
                  !isCorrect &&
                  "border-[var(--color-border-gray-light)] bg-white text-[var(--color-text-muted)]",
              )}
            >
              {i + 1}. {choice}
            </button>
          );
        })}
      </div>

      {selected !== null && (
        <p className="mt-3 rounded-md bg-white/70 p-2 text-xs text-[var(--color-text-muted)]">
          {question.explanation}
        </p>
      )}
    </div>
  );
}
