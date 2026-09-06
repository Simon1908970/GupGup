"use client";

import { useEffect, useState } from "react";
import { COUNTRIES } from "@/lib/constants/countries";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import type { DictionaryKey } from "@/lib/i18n/dictionaries";
import { cn, formatDate } from "@/lib/utils";
import type { CountryCode } from "@/lib/types";

interface RateItem {
  country: CountryCode;
  code: string;
  rate: number;
}

const ROTATE_MS = 3500;

// Some target currencies (THB, PHP) are worth close to or more than 1 KRW,
// so "1 ₩ = 0.02 THB" reads as basically zero. Scale the KRW side up to the
// smallest power of 10 that keeps the converted amount readable (>= ~1).
function displayUnit(rate: number): number {
  if (rate >= 1) return 1;
  if (rate >= 0.1) return 10;
  if (rate >= 0.01) return 100;
  return 1000;
}

export function ExchangeRateTicker() {
  const { t } = useLanguage();
  const [rates, setRates] = useState<RateItem[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/exchange-rates")
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        setRates(Array.isArray(data.rates) ? data.rates : []);
        setUpdatedAt(data.updatedAt ?? null);
      })
      .catch(() => {
        if (!cancelled) setRates([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (rates.length <= 1) return;
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % rates.length);
    }, ROTATE_MS);
    return () => clearInterval(timer);
  }, [rates.length]);

  if (rates.length === 0) return null;

  const current = rates[index];
  const countryOption = COUNTRIES.find((c) => c.code === current.country);
  const unit = displayUnit(current.rate);

  return (
    <div className="relative mb-4 flex items-center gap-3 overflow-hidden rounded-lg border border-[var(--color-border-gray)] bg-white px-4 py-2.5 gg-glossy-interactive">
      <span className="shrink-0 text-xs font-bold text-[var(--color-text-muted)]">
        {t("exchange.title")}
      </span>

      <div key={current.code} className="gg-fade-in flex flex-1 items-center justify-center gap-2 text-sm">
        <span>{countryOption?.flag}</span>
        <span className="hidden font-medium sm:inline">
          {countryOption && t(countryOption.labelKey as DictionaryKey)}
        </span>
        <span className="text-[var(--color-text-muted)]">{unit.toLocaleString()} ₩ =</span>
        <span className="font-bold text-[var(--color-brand-red)]">
          {(current.rate * unit).toLocaleString(undefined, { maximumFractionDigits: 2 })}{" "}
          {current.code}
        </span>
      </div>

      <div className="hidden shrink-0 items-center gap-2 sm:flex">
        {updatedAt && (
          <span className="text-[10px] text-[var(--color-text-muted)]">
            {t("exchange.asOf")} {formatDate(updatedAt)}
          </span>
        )}
        <div className="flex gap-1">
          {rates.map((r, i) => (
            <span
              key={r.code}
              className={cn(
                "h-1.5 w-1.5 rounded-full transition-colors",
                i === index ? "bg-[var(--color-brand-red)]" : "bg-[var(--color-border-gray)]",
              )}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
