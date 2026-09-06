"use client";

import { useEffect, useState } from "react";
import { Coins, Minus, TrendingDown, TrendingUp } from "lucide-react";
import { COUNTRIES } from "@/lib/constants/countries";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import type { DictionaryKey } from "@/lib/i18n/dictionaries";
import { cn } from "@/lib/utils";
import type { CountryCode } from "@/lib/types";
import { ExchangeRateModal } from "@/components/board/ExchangeRateModal";

export interface RateItem {
  country: CountryCode;
  code: string;
  rate: number;
  trend?: "up" | "down" | "flat" | null;
}

const ROTATE_MS = 3500;

// Some target currencies (THB, PHP) are worth close to or more than 1 KRW,
// so "1 ₩ = 0.02 THB" reads as basically zero. Scale the KRW side up to the
// smallest power of 10 that keeps the converted amount readable (>= ~1).
export function displayUnit(rate: number): number {
  if (rate >= 1) return 1;
  if (rate >= 0.1) return 10;
  if (rate >= 0.01) return 100;
  return 1000;
}

function TrendIcon({ trend }: { trend: RateItem["trend"] }) {
  if (trend === "up") return <TrendingUp size={14} className="text-green-600" />;
  if (trend === "down") return <TrendingDown size={14} className="text-[var(--color-brand-red)]" />;
  if (trend === "flat") return <Minus size={14} className="text-[var(--color-text-muted)]" />;
  return null;
}

export function ExchangeRateTicker() {
  const { t } = useLanguage();
  const [rates, setRates] = useState<RateItem[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);

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
    <>
      <div
        onClick={() => setModalOpen(true)}
        className="relative mb-4 flex w-full cursor-pointer flex-col gap-2 overflow-hidden rounded-lg border border-[var(--color-brand-red)]/20 px-4 py-2.5 gg-glossy-interactive gg-decorative-card"
      >
        <Coins size={88} className="gg-card-watermark text-[var(--color-brand-red)]" />
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-[var(--color-text-muted)]">
            {t("exchange.title")}
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setModalOpen(true);
            }}
            className="text-xs font-medium text-[var(--color-text-muted)] hover:text-[var(--color-brand-red)]"
          >
            {t("board.viewMore")}
          </button>
        </div>

        <div key={current.code} className="gg-fade-in flex items-center justify-center gap-2 text-sm">
          <span className="text-base">{countryOption?.flag}</span>
          <span className="hidden font-medium sm:inline">
            {countryOption && t(countryOption.labelKey as DictionaryKey)}
          </span>
          <span className="text-[var(--color-text-muted)]">{unit.toLocaleString()} ₩ =</span>
          <span className="font-bold text-[var(--color-brand-red)]">
            {(current.rate * unit).toLocaleString(undefined, { maximumFractionDigits: 2 })}{" "}
            {current.code}
          </span>
          <TrendIcon trend={current.trend} />
        </div>

        <div className="flex items-center justify-center gap-1.5">
          {rates.map((r, i) => (
            <button
              key={r.code}
              type="button"
              aria-label={r.code}
              onClick={(e) => {
                e.stopPropagation();
                setIndex(i);
              }}
              className={cn(
                "flex h-5 w-5 items-center justify-center rounded-full text-xs transition-all",
                i === index ? "scale-125 ring-2 ring-[var(--color-brand-red)]" : "opacity-50",
              )}
            >
              {COUNTRIES.find((c) => c.code === r.country)?.flag}
            </button>
          ))}
        </div>
      </div>

      {modalOpen && (
        <ExchangeRateModal rates={rates} updatedAt={updatedAt} onClose={() => setModalOpen(false)} />
      )}
    </>
  );
}
