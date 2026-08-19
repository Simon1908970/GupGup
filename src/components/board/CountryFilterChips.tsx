"use client";

import { COUNTRIES } from "@/lib/constants/countries";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import type { DictionaryKey } from "@/lib/i18n/dictionaries";
import type { CountryCode } from "@/lib/types";
import { cn } from "@/lib/utils";

export function CountryFilterChips({
  value,
  onChange,
}: {
  value: CountryCode;
  onChange: (country: CountryCode) => void;
}) {
  const { t } = useLanguage();

  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup">
      {COUNTRIES.map((c) => (
        <button
          key={c.code}
          role="radio"
          aria-checked={value === c.code}
          onClick={() => onChange(c.code)}
          className={cn(
            "flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
            value === c.code
              ? "border-[var(--color-brand-red)] bg-[var(--color-brand-red)] text-white"
              : "border-[var(--color-border-gray)] text-[var(--foreground)] hover:bg-[var(--color-border-gray-light)]",
          )}
        >
          <span>{c.flag}</span>
          {t(c.labelKey as DictionaryKey)}
        </button>
      ))}
    </div>
  );
}
