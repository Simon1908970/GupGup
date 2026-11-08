"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Pin } from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import type { DictionaryKey } from "@/lib/i18n/dictionaries";
import type { Post } from "@/lib/types";
import { fetchEntryParticipantCount } from "@/lib/supabase/pinnedFormEntries";

const COPY: Record<
  "salary" | "living_cost",
  { emoji: string; titleKey: DictionaryKey; descriptionKey: DictionaryKey }
> = {
  salary: {
    emoji: "💰",
    titleKey: "pinnedForm.salaryTitle",
    descriptionKey: "pinnedForm.salaryDescription",
  },
  living_cost: {
    emoji: "🧾",
    titleKey: "pinnedForm.livingCostTitle",
    descriptionKey: "pinnedForm.livingCostDescription",
  },
};

export function PinnedFormCard({ post }: { post: Post }) {
  const { t } = useLanguage();
  const [count, setCount] = useState<number | null>(null);
  const formType = post.pinnedFormType;

  useEffect(() => {
    if (!formType) return;
    let cancelled = false;
    fetchEntryParticipantCount(post.id, formType).then((c) => {
      if (!cancelled) setCount(c);
    });
    return () => {
      cancelled = true;
    };
  }, [post.id, formType]);

  if (!formType) return null;
  const copy = COPY[formType];

  return (
    <li className="border-b border-[var(--color-border-gray-light)] px-1 py-2.5 last:border-b-0">
      <Link
        href={`/board/${post.category}/${post.id}`}
        className="gg-pinned-form-card relative flex items-center gap-3 rounded-lg border-2 border-[var(--color-brand-red)] bg-white p-3"
      >
        <span className="gg-pinned-form-emoji shrink-0 text-3xl" aria-hidden>
          {copy.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <Pin
              size={13}
              aria-hidden
              className="shrink-0 rotate-45 fill-[var(--color-brand-red)] text-[var(--color-brand-red)]"
            />
            <p className="truncate text-sm font-bold">{t(copy.titleKey)}</p>
            <span className="shrink-0 rounded bg-[var(--color-badge-yellow)] px-1.5 py-0.5 text-[10px] font-bold text-black">
              {t("pinnedForm.ctaBadge")}
            </span>
          </div>
          <p className="mt-0.5 truncate text-xs text-[var(--color-text-muted)]">{t(copy.descriptionKey)}</p>
          {count !== null && (
            <p className="mt-0.5 text-[11px] font-medium text-[var(--color-brand-red)]">
              {count}
              {t("pinnedForm.participantCountSuffix")}
            </p>
          )}
        </div>
      </Link>
    </li>
  );
}
