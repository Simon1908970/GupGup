"use client";

import { useState } from "react";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import type { DictionaryKey } from "@/lib/i18n/dictionaries";
import type { LivingCostEntry, SalaryEntry } from "@/lib/types";
import {
  INDUSTRY_MAIN_OPTIONS,
  INDUSTRY_SUB_OPTIONS,
  VISA_OPTIONS,
  NIGHT_WORK_OPTIONS,
  LIVING_STATUS_OPTIONS,
  HOUSEHOLD_OPTIONS,
  HOUSING_TYPE_OPTIONS,
  PINNED_FORM_LIMITS,
  calcNetPay,
  calcTotalCost,
  calcRemaining,
  defaultBaseMonth,
  type SelectOption,
} from "@/lib/constants/pinnedForms";
import { REGIONS, findProvince } from "@/lib/constants/regions";
import type { SalaryEntryInput, LivingCostEntryInput } from "@/lib/supabase/pinnedFormEntries";
import { cn } from "@/lib/utils";

function toInt(v: string): number {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : 0;
}

function SelectField({
  labelKey,
  value,
  onChange,
  options,
  required,
}: {
  labelKey: DictionaryKey;
  value: string;
  onChange: (v: string) => void;
  options: SelectOption[];
  required?: boolean;
}) {
  const { t } = useLanguage();
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="font-medium text-[var(--foreground)]">
        {t(labelKey)}
        {required && <span className="text-[var(--color-brand-red)]"> *</span>}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 rounded-md border border-[var(--color-border-gray)] px-2 text-sm outline-none focus:border-[var(--color-brand-red)]"
      >
        <option value="" disabled>
          {t("pinnedForm.selectPlaceholder")}
        </option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {t(o.labelKey)}
          </option>
        ))}
      </select>
    </label>
  );
}

function NumberField({
  labelKey,
  value,
  onChange,
  unitKey,
  required,
  max,
  readOnly,
}: {
  labelKey: DictionaryKey;
  value: string;
  onChange?: (v: string) => void;
  unitKey?: DictionaryKey;
  required?: boolean;
  max?: number;
  readOnly?: boolean;
}) {
  const { t } = useLanguage();
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="font-medium text-[var(--foreground)]">
        {t(labelKey)}
        {required && <span className="text-[var(--color-brand-red)]"> *</span>}
      </span>
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          min={0}
          max={max}
          inputMode="numeric"
          value={value}
          readOnly={readOnly}
          onChange={(e) => onChange?.(e.target.value)}
          className={cn(
            "h-9 w-full rounded-md border border-[var(--color-border-gray)] px-2 text-sm outline-none focus:border-[var(--color-brand-red)]",
            readOnly && "bg-[var(--color-border-gray-light)]",
          )}
        />
        {unitKey && <span className="shrink-0 text-xs text-[var(--color-text-muted)]">{t(unitKey)}</span>}
      </div>
    </label>
  );
}

function RegionFields({
  province,
  city,
  onChangeProvince,
  onChangeCity,
}: {
  province: string;
  city: string;
  onChangeProvince: (v: string) => void;
  onChangeCity: (v: string) => void;
}) {
  const { t } = useLanguage();
  const selectedProvince = findProvince(province);
  return (
    <div className="grid grid-cols-2 gap-2">
      <label className="flex flex-col gap-1 text-xs">
        <span className="font-medium text-[var(--foreground)]">
          {t("pinnedForm.regionProvince")}
          <span className="text-[var(--color-brand-red)]"> *</span>
        </span>
        <select
          value={province}
          onChange={(e) => {
            onChangeProvince(e.target.value);
            onChangeCity("");
          }}
          className="h-9 rounded-md border border-[var(--color-border-gray)] px-2 text-sm outline-none focus:border-[var(--color-brand-red)]"
        >
          <option value="" disabled>
            {t("pinnedForm.selectPlaceholder")}
          </option>
          {REGIONS.map((p) => (
            <option key={p.code} value={p.code}>
              {p.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs">
        <span className="font-medium text-[var(--foreground)]">
          {t("pinnedForm.regionCity")}
          <span className="text-[var(--color-brand-red)]"> *</span>
        </span>
        <select
          value={city}
          disabled={!selectedProvince}
          onChange={(e) => onChangeCity(e.target.value)}
          className="h-9 rounded-md border border-[var(--color-border-gray)] px-2 text-sm outline-none focus:border-[var(--color-brand-red)] disabled:bg-[var(--color-border-gray-light)]"
        >
          <option value="" disabled>
            {t("pinnedForm.selectPlaceholder")}
          </option>
          {selectedProvince?.cities.map((c) => (
            <option key={c.code} value={c.code}>
              {c.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

function MonthAndAnonymousFields({
  baseMonth,
  onChangeBaseMonth,
  isAnonymous,
  onChangeAnonymous,
}: {
  baseMonth: string;
  onChangeBaseMonth: (v: string) => void;
  isAnonymous: boolean;
  onChangeAnonymous: (v: boolean) => void;
}) {
  const { t } = useLanguage();
  return (
    <div className="flex items-end justify-between gap-3">
      <label className="flex flex-col gap-1 text-xs">
        <span className="font-medium text-[var(--foreground)]">
          {t("pinnedForm.baseMonth")}
          <span className="text-[var(--color-brand-red)]"> *</span>
        </span>
        <input
          type="month"
          value={baseMonth.slice(0, 7)}
          onChange={(e) => onChangeBaseMonth(`${e.target.value}-01`)}
          className="h-9 rounded-md border border-[var(--color-border-gray)] px-2 text-sm outline-none focus:border-[var(--color-brand-red)]"
        />
      </label>
      <label className="flex items-center gap-1.5 pb-1.5 text-xs font-medium">
        <input
          type="checkbox"
          checked={isAnonymous}
          onChange={(e) => onChangeAnonymous(e.target.checked)}
          className="accent-[var(--color-brand-red)]"
        />
        {t("pinnedForm.postAnonymously")}
      </label>
    </div>
  );
}

interface SalaryFormState {
  regionProvince: string;
  regionCity: string;
  industryMain: string;
  industrySub: string;
  visa: string;
  weeklyHours: string;
  monthlyDaysOff: string;
  nightWork: "none" | "sometimes" | "shift";
  grossPay: string;
  overtimeIncluded: boolean;
  deductHousing: string;
  deductFood: string;
  deductTaxInsurance: string;
  deductOther: string;
  netPay: string;
  netPayTouched: boolean;
  baseMonth: string;
  isAnonymous: boolean;
}

function emptySalaryForm(): SalaryFormState {
  return {
    regionProvince: "",
    regionCity: "",
    industryMain: "",
    industrySub: "",
    visa: "",
    weeklyHours: "",
    monthlyDaysOff: "",
    nightWork: "none",
    grossPay: "",
    overtimeIncluded: false,
    deductHousing: "",
    deductFood: "",
    deductTaxInsurance: "",
    deductOther: "",
    netPay: "",
    netPayTouched: false,
    baseMonth: defaultBaseMonth(),
    isAnonymous: true,
  };
}

export function salaryFormFromEntry(entry: SalaryEntry): SalaryFormState {
  return {
    regionProvince: entry.regionProvince,
    regionCity: entry.regionCity,
    industryMain: entry.industryMain,
    industrySub: entry.industrySub,
    visa: entry.visa,
    weeklyHours: String(entry.weeklyHours),
    monthlyDaysOff: String(entry.monthlyDaysOff),
    nightWork: entry.nightWork,
    grossPay: String(entry.grossPay),
    overtimeIncluded: entry.overtimeIncluded,
    deductHousing: String(entry.deductHousing),
    deductFood: String(entry.deductFood),
    deductTaxInsurance: String(entry.deductTaxInsurance),
    deductOther: String(entry.deductOther),
    netPay: String(entry.netPay),
    netPayTouched: true,
    baseMonth: entry.baseMonth,
    isAnonymous: entry.isAnonymous,
  };
}

function salaryFormValid(f: SalaryFormState): boolean {
  return Boolean(
    f.regionProvince &&
      f.regionCity &&
      f.industryMain &&
      f.industrySub &&
      f.visa &&
      f.weeklyHours &&
      f.monthlyDaysOff &&
      f.grossPay &&
      f.netPay &&
      f.baseMonth,
  );
}

export function salaryFormToInput(f: SalaryFormState): SalaryEntryInput {
  return {
    regionProvince: f.regionProvince,
    regionCity: f.regionCity,
    industryMain: f.industryMain,
    industrySub: f.industrySub,
    visa: f.visa,
    weeklyHours: toInt(f.weeklyHours),
    monthlyDaysOff: toInt(f.monthlyDaysOff),
    nightWork: f.nightWork,
    grossPay: toInt(f.grossPay),
    overtimeIncluded: f.overtimeIncluded,
    deductHousing: toInt(f.deductHousing),
    deductFood: toInt(f.deductFood),
    deductTaxInsurance: toInt(f.deductTaxInsurance),
    deductOther: toInt(f.deductOther),
    netPay: toInt(f.netPay),
    baseMonth: f.baseMonth,
    isAnonymous: f.isAnonymous,
  };
}

export function SalaryEntryForm({
  initial,
  submitLabelKey,
  onSubmit,
  submitting,
}: {
  initial?: SalaryFormState;
  submitLabelKey: DictionaryKey;
  onSubmit: (input: SalaryEntryInput) => Promise<void>;
  submitting: boolean;
}) {
  const { t } = useLanguage();
  const [form, setForm] = useState<SalaryFormState>(initial ?? emptySalaryForm());
  const subOptions = INDUSTRY_SUB_OPTIONS[form.industryMain] ?? [];

  // 실수령액은 세전·공제 항목이 바뀔 때마다 자동으로 다시 계산되지만, 사용자가
  // 그 칸을 직접 고치면(netPayTouched) 그 뒤로는 자동 계산이 덮어쓰지 않는다
  // (요청서 3-1 "실수령액: 자동 계산, 직접 수정 가능").
  const NET_PAY_INPUTS: (keyof SalaryFormState)[] = [
    "grossPay",
    "deductHousing",
    "deductFood",
    "deductTaxInsurance",
    "deductOther",
  ];

  function update<K extends keyof SalaryFormState>(key: K, value: SalaryFormState[K]) {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "industryMain") next.industrySub = "";
      if (key === "netPay") {
        next.netPayTouched = true;
        return next;
      }
      if (NET_PAY_INPUTS.includes(key) && !prev.netPayTouched) {
        next.netPay = String(
          calcNetPay(
            toInt(next.grossPay),
            toInt(next.deductHousing),
            toInt(next.deductFood),
            toInt(next.deductTaxInsurance),
            toInt(next.deductOther),
          ),
        );
      }
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!salaryFormValid(form) || submitting) return;
    await onSubmit(salaryFormToInput(form));
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-lg border border-[var(--color-border-gray)] p-3">
      <RegionFields
        province={form.regionProvince}
        city={form.regionCity}
        onChangeProvince={(v) => update("regionProvince", v)}
        onChangeCity={(v) => update("regionCity", v)}
      />
      <div className="grid grid-cols-2 gap-2">
        <SelectField
          labelKey="pinnedForm.industryMain"
          value={form.industryMain}
          onChange={(v) => update("industryMain", v)}
          options={INDUSTRY_MAIN_OPTIONS}
          required
        />
        <SelectField
          labelKey="pinnedForm.industrySub"
          value={form.industrySub}
          onChange={(v) => update("industrySub", v)}
          options={subOptions}
          required
        />
      </div>
      <SelectField
        labelKey="pinnedForm.visa"
        value={form.visa}
        onChange={(v) => update("visa", v)}
        options={VISA_OPTIONS}
        required
      />
      <div className="grid grid-cols-2 gap-2">
        <NumberField
          labelKey="pinnedForm.weeklyHours"
          value={form.weeklyHours}
          onChange={(v) => update("weeklyHours", v)}
          unitKey="pinnedForm.unitHours"
          max={PINNED_FORM_LIMITS.weeklyHoursMax}
          required
        />
        <NumberField
          labelKey="pinnedForm.monthlyDaysOff"
          value={form.monthlyDaysOff}
          onChange={(v) => update("monthlyDaysOff", v)}
          unitKey="pinnedForm.unitDays"
          max={PINNED_FORM_LIMITS.monthlyDaysOffMax}
          required
        />
      </div>
      <SelectField
        labelKey="pinnedForm.nightWork"
        value={form.nightWork}
        onChange={(v) => update("nightWork", v as SalaryFormState["nightWork"])}
        options={NIGHT_WORK_OPTIONS}
      />
      <NumberField
        labelKey="pinnedForm.grossPay"
        value={form.grossPay}
        onChange={(v) => update("grossPay", v)}
        unitKey="pinnedForm.unitManwon"
        max={PINNED_FORM_LIMITS.amountMax}
        required
      />
      <label className="flex items-center gap-1.5 text-xs font-medium">
        <input
          type="checkbox"
          checked={form.overtimeIncluded}
          onChange={(e) => update("overtimeIncluded", e.target.checked)}
          className="accent-[var(--color-brand-red)]"
        />
        {t("pinnedForm.overtimeIncluded")}
      </label>
      <div className="grid grid-cols-2 gap-2">
        <NumberField
          labelKey="pinnedForm.deductHousing"
          value={form.deductHousing}
          onChange={(v) => update("deductHousing", v)}
          unitKey="pinnedForm.unitManwon"
        />
        <NumberField
          labelKey="pinnedForm.deductFood"
          value={form.deductFood}
          onChange={(v) => update("deductFood", v)}
          unitKey="pinnedForm.unitManwon"
        />
        <NumberField
          labelKey="pinnedForm.deductTaxInsurance"
          value={form.deductTaxInsurance}
          onChange={(v) => update("deductTaxInsurance", v)}
          unitKey="pinnedForm.unitManwon"
        />
        <NumberField
          labelKey="pinnedForm.deductOther"
          value={form.deductOther}
          onChange={(v) => update("deductOther", v)}
          unitKey="pinnedForm.unitManwon"
        />
      </div>
      <NumberField
        labelKey="pinnedForm.netPay"
        value={form.netPay}
        onChange={(v) => update("netPay", v)}
        unitKey="pinnedForm.unitManwon"
        required
      />
      <MonthAndAnonymousFields
        baseMonth={form.baseMonth}
        onChangeBaseMonth={(v) => update("baseMonth", v)}
        isAnonymous={form.isAnonymous}
        onChangeAnonymous={(v) => update("isAnonymous", v)}
      />
      <button
        disabled={!salaryFormValid(form) || submitting}
        className="relative h-10 rounded-md bg-[var(--color-brand-red)] text-sm font-medium text-white disabled:opacity-50 gg-glossy-btn"
      >
        {t(submitLabelKey)}
      </button>
    </form>
  );
}

interface LivingCostFormState {
  regionProvince: string;
  regionCity: string;
  status: string;
  household: string;
  housingType: string;
  netPay: string;
  rent: string;
  utilities: string;
  phone: string;
  transport: string;
  groceries: string;
  eatingOut: string;
  shopping: string;
  other: string;
  baseMonth: string;
  isAnonymous: boolean;
}

function emptyLivingCostForm(): LivingCostFormState {
  return {
    regionProvince: "",
    regionCity: "",
    status: "",
    household: "",
    housingType: "",
    netPay: "",
    rent: "",
    utilities: "",
    phone: "",
    transport: "",
    groceries: "",
    eatingOut: "",
    shopping: "",
    other: "",
    baseMonth: defaultBaseMonth(),
    isAnonymous: true,
  };
}

export function livingCostFormFromEntry(entry: LivingCostEntry): LivingCostFormState {
  return {
    regionProvince: entry.regionProvince,
    regionCity: entry.regionCity,
    status: entry.status,
    household: entry.household,
    housingType: entry.housingType,
    netPay: String(entry.netPay),
    rent: String(entry.rent),
    utilities: String(entry.utilities),
    phone: String(entry.phone),
    transport: String(entry.transport),
    groceries: String(entry.groceries),
    eatingOut: String(entry.eatingOut),
    shopping: String(entry.shopping),
    other: String(entry.other),
    baseMonth: entry.baseMonth,
    isAnonymous: entry.isAnonymous,
  };
}

function livingCostFormValid(f: LivingCostFormState): boolean {
  return Boolean(
    f.regionProvince && f.regionCity && f.status && f.household && f.housingType && f.netPay && f.baseMonth,
  );
}

export function livingCostFormToInput(f: LivingCostFormState): LivingCostEntryInput {
  const totalCost = calcTotalCost({
    rent: toInt(f.rent),
    utilities: toInt(f.utilities),
    phone: toInt(f.phone),
    transport: toInt(f.transport),
    groceries: toInt(f.groceries),
    eatingOut: toInt(f.eatingOut),
    shopping: toInt(f.shopping),
    other: toInt(f.other),
  });
  return {
    regionProvince: f.regionProvince,
    regionCity: f.regionCity,
    status: f.status,
    household: f.household,
    housingType: f.housingType,
    netPay: toInt(f.netPay),
    rent: toInt(f.rent),
    utilities: toInt(f.utilities),
    phone: toInt(f.phone),
    transport: toInt(f.transport),
    groceries: toInt(f.groceries),
    eatingOut: toInt(f.eatingOut),
    shopping: toInt(f.shopping),
    other: toInt(f.other),
    totalCost,
    remaining: calcRemaining(toInt(f.netPay), totalCost),
    baseMonth: f.baseMonth,
    isAnonymous: f.isAnonymous,
  };
}

export function LivingCostEntryForm({
  initial,
  submitLabelKey,
  onSubmit,
  submitting,
}: {
  initial?: LivingCostFormState;
  submitLabelKey: DictionaryKey;
  onSubmit: (input: LivingCostEntryInput) => Promise<void>;
  submitting: boolean;
}) {
  const { t } = useLanguage();
  const [form, setForm] = useState<LivingCostFormState>(initial ?? emptyLivingCostForm());

  function update<K extends keyof LivingCostFormState>(key: K, value: LivingCostFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const totalCost = calcTotalCost({
    rent: toInt(form.rent),
    utilities: toInt(form.utilities),
    phone: toInt(form.phone),
    transport: toInt(form.transport),
    groceries: toInt(form.groceries),
    eatingOut: toInt(form.eatingOut),
    shopping: toInt(form.shopping),
    other: toInt(form.other),
  });
  const remaining = calcRemaining(toInt(form.netPay), totalCost);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!livingCostFormValid(form) || submitting) return;
    await onSubmit(livingCostFormToInput(form));
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-lg border border-[var(--color-border-gray)] p-3">
      <RegionFields
        province={form.regionProvince}
        city={form.regionCity}
        onChangeProvince={(v) => update("regionProvince", v)}
        onChangeCity={(v) => update("regionCity", v)}
      />
      <div className="grid grid-cols-2 gap-2">
        <SelectField
          labelKey="pinnedForm.status"
          value={form.status}
          onChange={(v) => update("status", v)}
          options={LIVING_STATUS_OPTIONS}
          required
        />
        <SelectField
          labelKey="pinnedForm.household"
          value={form.household}
          onChange={(v) => update("household", v)}
          options={HOUSEHOLD_OPTIONS}
          required
        />
      </div>
      <SelectField
        labelKey="pinnedForm.housingType"
        value={form.housingType}
        onChange={(v) => update("housingType", v)}
        options={HOUSING_TYPE_OPTIONS}
        required
      />
      <NumberField
        labelKey="pinnedForm.netPayInput"
        value={form.netPay}
        onChange={(v) => update("netPay", v)}
        unitKey="pinnedForm.unitManwon"
        max={PINNED_FORM_LIMITS.amountMax}
        required
      />
      <div className="grid grid-cols-2 gap-2">
        <NumberField labelKey="pinnedForm.rent" value={form.rent} onChange={(v) => update("rent", v)} unitKey="pinnedForm.unitManwon" />
        <NumberField labelKey="pinnedForm.utilities" value={form.utilities} onChange={(v) => update("utilities", v)} unitKey="pinnedForm.unitManwon" />
        <NumberField labelKey="pinnedForm.phone" value={form.phone} onChange={(v) => update("phone", v)} unitKey="pinnedForm.unitManwon" />
        <NumberField labelKey="pinnedForm.transport" value={form.transport} onChange={(v) => update("transport", v)} unitKey="pinnedForm.unitManwon" />
        <NumberField labelKey="pinnedForm.groceries" value={form.groceries} onChange={(v) => update("groceries", v)} unitKey="pinnedForm.unitManwon" />
        <NumberField labelKey="pinnedForm.eatingOut" value={form.eatingOut} onChange={(v) => update("eatingOut", v)} unitKey="pinnedForm.unitManwon" />
        <NumberField labelKey="pinnedForm.shopping" value={form.shopping} onChange={(v) => update("shopping", v)} unitKey="pinnedForm.unitManwon" />
        <NumberField labelKey="pinnedForm.other" value={form.other} onChange={(v) => update("other", v)} unitKey="pinnedForm.unitManwon" />
      </div>
      <NumberField labelKey="pinnedForm.totalCost" value={String(totalCost)} unitKey="pinnedForm.unitManwon" readOnly />
      <NumberField labelKey="pinnedForm.remaining" value={String(remaining)} unitKey="pinnedForm.unitManwon" readOnly />
      <MonthAndAnonymousFields
        baseMonth={form.baseMonth}
        onChangeBaseMonth={(v) => update("baseMonth", v)}
        isAnonymous={form.isAnonymous}
        onChangeAnonymous={(v) => update("isAnonymous", v)}
      />
      <button
        disabled={!livingCostFormValid(form) || submitting}
        className="relative h-10 rounded-md bg-[var(--color-brand-red)] text-sm font-medium text-white disabled:opacity-50 gg-glossy-btn"
      >
        {t(submitLabelKey)}
      </button>
    </form>
  );
}
