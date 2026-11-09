"use client";

import { useLanguage } from "@/lib/i18n/LanguageProvider";
import type { DictionaryKey } from "@/lib/i18n/dictionaries";
import type { LivingCostEntry, SalaryEntry } from "@/lib/types";
import {
  INDUSTRY_SUB_OPTIONS,
  VISA_OPTIONS,
  NIGHT_WORK_OPTIONS,
  LIVING_STATUS_OPTIONS,
  HOUSING_TYPE_OPTIONS,
  formatBaseMonth,
  type SelectOption,
} from "@/lib/constants/pinnedForms";
import { regionLabel } from "@/lib/constants/regions";

function useLabel() {
  const { t } = useLanguage();
  return (options: SelectOption[], value: string | null): string | null => {
    if (!value) return null;
    const key = options.find((o) => o.value === value)?.labelKey;
    return key ? t(key) : value;
  };
}

function OwnerActions({
  onEdit,
  onDelete,
}: {
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const { t } = useLanguage();
  if (!onEdit && !onDelete) return null;
  return (
    <div className="mt-2 flex gap-2 text-xs">
      {onEdit && (
        <button onClick={onEdit} className="text-[var(--color-text-muted)] hover:text-[var(--foreground)]">
          {t("common.edit")}
        </button>
      )}
      {onDelete && (
        <button onClick={onDelete} className="text-[var(--color-text-muted)] hover:text-[var(--color-brand-red)]">
          {t("common.delete")}
        </button>
      )}
    </div>
  );
}

export function SalaryEntryCard({
  entry,
  onEdit,
  onDelete,
}: {
  entry: SalaryEntry;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const { t } = useLanguage();
  const label = useLabel();
  const industryLabel = entry.industryMain
    ? label(INDUSTRY_SUB_OPTIONS[entry.industryMain] ?? [], entry.industrySub)
    : null;
  const visaLabel = label(VISA_OPTIONS, entry.visa);
  const nightWorkLabel = label(NIGHT_WORK_OPTIONS, entry.nightWork);
  const region = regionLabel(entry.regionProvince, entry.regionCity);

  // 전부 선택 입력이라, 입력 안 한 항목은 줄에서 통째로 빠진다 -- "0"으로
  // 지어내서 보여주지 않는다.
  const headLine = [industryLabel && `🏭 ${industryLabel}`, region && `📍${region}`, visaLabel && `🪪 ${visaLabel}`]
    .filter(Boolean)
    .join(" · ");

  const hoursLine = [
    entry.weeklyHours !== null && `${t("pinnedForm.weeklyHoursWeekPrefix")}${entry.weeklyHours}${t("pinnedForm.unitHours")}`,
    entry.monthlyDaysOff !== null && `${t("pinnedForm.monthlyDaysOff")} ${entry.monthlyDaysOff}${t("pinnedForm.unitDays")}`,
    entry.nightWork !== "none" && nightWorkLabel,
  ]
    .filter(Boolean)
    .join(" · ");

  const allDeductions: { labelKey: DictionaryKey; value: number | null }[] = [
    { labelKey: "pinnedForm.deductHousing", value: entry.deductHousing },
    { labelKey: "pinnedForm.deductFood", value: entry.deductFood },
    { labelKey: "pinnedForm.deductTaxInsurance", value: entry.deductTaxInsurance },
    { labelKey: "pinnedForm.deductOther", value: entry.deductOther },
  ];
  const deductions = allDeductions.filter((d): d is { labelKey: DictionaryKey; value: number } => Boolean(d.value));
  const payLine =
    entry.grossPay !== null
      ? `${t("pinnedForm.grossPay")} ${entry.grossPay}${t("pinnedForm.unitManwon")}${
          entry.overtimeIncluded ? `(${t("pinnedForm.overtimeIncluded")})` : ""
        }${
          deductions.length > 0
            ? " / " + deductions.map((d) => `${t(d.labelKey)} -${d.value}${t("pinnedForm.unitManwon")}`).join(" / ")
            : ""
        }`
      : null;

  const netLine = entry.netPay !== null ? `💰 ${t("pinnedForm.netPay")} ${entry.netPay}${t("pinnedForm.unitManwon")}` : null;

  return (
    <div className="mt-1 rounded-lg border border-[var(--color-border-gray)] bg-[var(--color-border-gray-light)]/40 p-3 text-sm">
      {headLine && <p className="text-xs text-[var(--color-text-muted)]">{headLine}</p>}
      {hoursLine && <p className="mt-1 text-xs text-[var(--color-text-muted)]">{hoursLine}</p>}
      {payLine && <p className="mt-1 text-xs text-[var(--color-text-muted)]">{payLine}</p>}
      <p className="mt-1.5 text-sm font-semibold text-[var(--color-brand-red)]">
        {netLine ?? t("pinnedForm.netPayUnknown")}
        <span className="ml-1.5 text-xs font-normal text-[var(--color-text-muted)]">
          ({formatBaseMonth(entry.baseMonth)})
        </span>
      </p>
      <OwnerActions onEdit={onEdit} onDelete={onDelete} />
    </div>
  );
}

export function LivingCostEntryCard({
  entry,
  onEdit,
  onDelete,
}: {
  entry: LivingCostEntry;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const { t } = useLanguage();
  const label = useLabel();
  const statusLabel = label(LIVING_STATUS_OPTIONS, entry.status);
  const housingLabel = label(HOUSING_TYPE_OPTIONS, entry.housingType);
  const region = regionLabel(entry.regionProvince, entry.regionCity);

  const headLine = [region && `📍${region}`, statusLabel && `🪪 ${statusLabel}`, housingLabel && `🏠 ${housingLabel}`]
    .filter(Boolean)
    .join(" · ");

  const allExpenses: { labelKey: DictionaryKey; value: number | null }[] = [
    { labelKey: "pinnedForm.rent", value: entry.rent },
    { labelKey: "pinnedForm.utilities", value: entry.utilities },
    { labelKey: "pinnedForm.phone", value: entry.phone },
    { labelKey: "pinnedForm.transport", value: entry.transport },
    { labelKey: "pinnedForm.groceries", value: entry.groceries },
    { labelKey: "pinnedForm.eatingOut", value: entry.eatingOut },
    { labelKey: "pinnedForm.shopping", value: entry.shopping },
    { labelKey: "pinnedForm.other", value: entry.other },
  ];
  const expenses = allExpenses.filter((e): e is { labelKey: DictionaryKey; value: number } => Boolean(e.value));

  const moneyLine = [
    entry.totalCost !== null && `🧾 ${t("pinnedForm.totalCost")} ${entry.totalCost}${t("pinnedForm.unitManwon")}`,
    entry.netPay !== null && `💰 ${t("pinnedForm.netPayInput")} ${entry.netPay}${t("pinnedForm.unitManwon")}`,
    entry.remaining !== null && `→ ${t("pinnedForm.remaining")} ${entry.remaining}${t("pinnedForm.unitManwon")}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="mt-1 rounded-lg border border-[var(--color-border-gray)] bg-[var(--color-border-gray-light)]/40 p-3 text-sm">
      {headLine && <p className="text-xs text-[var(--color-text-muted)]">{headLine}</p>}
      {expenses.length > 0 && (
        <p className="mt-1 text-xs text-[var(--color-text-muted)]">
          {expenses.map((e) => `${t(e.labelKey)} ${e.value}${t("pinnedForm.unitManwon")}`).join(" · ")}
        </p>
      )}
      <p className="mt-1.5 text-sm font-semibold text-[var(--color-brand-red)]">
        {moneyLine || t("pinnedForm.netPayUnknown")}
        <span className="ml-1.5 text-xs font-normal text-[var(--color-text-muted)]">
          ({formatBaseMonth(entry.baseMonth)})
        </span>
      </p>
      <OwnerActions onEdit={onEdit} onDelete={onDelete} />
    </div>
  );
}
