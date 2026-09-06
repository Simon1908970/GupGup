"use client";

import { Minus, TrendingDown, TrendingUp, X } from "lucide-react";
import { COUNTRIES } from "@/lib/constants/countries";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import type { DictionaryKey } from "@/lib/i18n/dictionaries";
import { formatDate } from "@/lib/utils";
import { CountryFlag } from "@/components/common/CountryFlag";
import type { RateItem } from "@/components/board/ExchangeRateTicker";
import { displayUnit } from "@/components/board/ExchangeRateTicker";

export function ExchangeRateModal({
  rates,
  updatedAt,
  onClose,
}: {
  rates: RateItem[];
  updatedAt: string | null;
  onClose: () => void;
}) {
  const { t } = useLanguage();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-lg bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold">{t("exchange.title")}</h2>
          <button onClick={onClose} aria-label={t("common.close")}>
            <X size={18} />
          </button>
        </div>
        <ul className="divide-y divide-[var(--color-border-gray-light)]">
          {rates.map((r) => {
            const countryOption = COUNTRIES.find((c) => c.code === r.country);
            const unit = displayUnit(r.rate);
            return (
              <li key={r.code} className="flex items-center justify-between gap-2 py-2 text-sm">
                <span className="flex items-center gap-1.5">
                  {countryOption && <CountryFlag code={countryOption.code} size={14} />}
                  <span>{countryOption && t(countryOption.labelKey as DictionaryKey)}</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="text-xs text-[var(--color-text-muted)]">
                    {unit.toLocaleString()} ₩ =
                  </span>
                  <span className="font-bold text-[var(--color-brand-red)]">
                    {(r.rate * unit).toLocaleString(undefined, { maximumFractionDigits: 2 })} {r.code}
                  </span>
                  {r.trend === "up" && <TrendingUp size={14} className="text-green-600" />}
                  {r.trend === "down" && <TrendingDown size={14} className="text-[var(--color-brand-red)]" />}
                  {r.trend === "flat" && <Minus size={14} className="text-[var(--color-text-muted)]" />}
                </span>
              </li>
            );
          })}
        </ul>
        {updatedAt && (
          <p className="mt-3 text-right text-[11px] text-[var(--color-text-muted)]">
            {t("exchange.asOf")} {formatDate(updatedAt)}
          </p>
        )}
      </div>
    </div>
  );
}
