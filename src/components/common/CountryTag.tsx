"use client";

import { COUNTRIES } from "@/lib/constants/countries";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import type { DictionaryKey } from "@/lib/i18n/dictionaries";
import type { CountryCode } from "@/lib/types";
import { cn } from "@/lib/utils";

export function CountryTag({
  country,
  className,
}: {
  country: CountryCode;
  className?: string;
}) {
  const { t } = useLanguage();
  const option = COUNTRIES.find((c) => c.code === country);
  if (!option || option.code === "all") return null;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded border border-[var(--color-border-gray)] px-1.5 py-0.5 text-xs text-[var(--color-text-muted)]",
        className,
      )}
    >
      <span>{option.flag}</span>
      <span>{t(option.labelKey as DictionaryKey)}</span>
    </span>
  );
}
