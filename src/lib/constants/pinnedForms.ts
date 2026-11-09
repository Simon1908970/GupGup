import type { DictionaryKey, Locale } from "@/lib/i18n/dictionaries";
import type { CountryCode } from "@/lib/types";

// "내 월급" / "내 생활비" 고정 글의 입력 양식 설정. 두 양식은 구조가 같아서
// (지역 + 선택형 항목 몇 개 + 금액 항목 여러 개 + 자동계산 + 기준월 + 익명
// 체크박스) 공용 컴포넌트(PinnedFormEntryForm/PinnedFormEntryCard)가 이 설정을
// 읽어서 그린다. 비슷한 고정 폼 글을 나중에 추가할 땐 여기에 새 PinnedFormType
// 하나만 더 정의하면 된다.

export type PinnedFormType = "salary" | "living_cost";

// 작성자의 국적 표시(2026-11-09 결정): 익명 여부와 무관하게 "익명"/닉네임
// 옆에 국기 이모지를 보여준다. 단 profiles.country(회원가입 때 고른 국가)가
// 아니라, 제출 시점의 "시스템 언어"(사이트 UI 언어 -- 보통 기기 언어로
// 자동 감지됨)로 추정한다 -- 신원을 특정하는 값이 아니라서 익명 글에도
// 안전하게 보여줄 수 있다. 1:1로 안 맞는 언어(한국어·영어·러시아어)는
// 국가를 특정할 수 없어 "기타" 깃발로 둔다.
export const LOCALE_TO_COUNTRY: Record<Locale, CountryCode> = {
  ko: "kr",
  en: "etc",
  vi: "vn",
  th: "th",
  id: "id",
  tl: "ph",
  lo: "la",
  my: "mm",
  mn: "mn",
  km: "kh",
  ru: "etc",
};

export const PINNED_FORM_LIMITS = {
  weeklyHoursMax: 100,
  monthlyDaysOffMax: 31,
  amountMax: 2000, // 만 원 단위 -- 2,000만 원
} as const;

export interface SelectOption {
  value: string;
  labelKey: DictionaryKey;
}

export const INDUSTRY_MAIN_OPTIONS: SelectOption[] = [
  { value: "manufacturing", labelKey: "pinnedForm.industryMain.manufacturing" },
  { value: "agriculture", labelKey: "pinnedForm.industryMain.agriculture" },
  { value: "fishery", labelKey: "pinnedForm.industryMain.fishery" },
  { value: "construction", labelKey: "pinnedForm.industryMain.construction" },
  { value: "service", labelKey: "pinnedForm.industryMain.service" },
  { value: "etc", labelKey: "pinnedForm.industryMain.etc" },
];

export const INDUSTRY_SUB_OPTIONS: Record<string, SelectOption[]> = {
  manufacturing: [
    { value: "metal", labelKey: "pinnedForm.industrySub.metal" },
    { value: "autoparts", labelKey: "pinnedForm.industrySub.autoparts" },
    { value: "shipbuilding", labelKey: "pinnedForm.industrySub.shipbuilding" },
    { value: "food", labelKey: "pinnedForm.industrySub.food" },
    { value: "electronics", labelKey: "pinnedForm.industrySub.electronics" },
    { value: "plastic_rubber", labelKey: "pinnedForm.industrySub.plasticRubber" },
    { value: "textile", labelKey: "pinnedForm.industrySub.textile" },
    { value: "chemical", labelKey: "pinnedForm.industrySub.chemical" },
    { value: "etc", labelKey: "pinnedForm.industrySub.etc" },
  ],
  agriculture: [
    { value: "livestock", labelKey: "pinnedForm.industrySub.livestock" },
    { value: "vegetable_greenhouse", labelKey: "pinnedForm.industrySub.vegetableGreenhouse" },
    { value: "orchard", labelKey: "pinnedForm.industrySub.orchard" },
    { value: "mushroom", labelKey: "pinnedForm.industrySub.mushroom" },
    { value: "etc", labelKey: "pinnedForm.industrySub.etc" },
  ],
  fishery: [
    { value: "aquaculture", labelKey: "pinnedForm.industrySub.aquaculture" },
    { value: "fishing_boat", labelKey: "pinnedForm.industrySub.fishingBoat" },
    { value: "seafood_processing", labelKey: "pinnedForm.industrySub.seafoodProcessing" },
  ],
  construction: [{ value: "construction", labelKey: "pinnedForm.industrySub.construction" }],
  service: [
    { value: "restaurant", labelKey: "pinnedForm.industrySub.restaurant" },
    { value: "lodging", labelKey: "pinnedForm.industrySub.lodging" },
    { value: "logistics_delivery", labelKey: "pinnedForm.industrySub.logisticsDelivery" },
    { value: "etc", labelKey: "pinnedForm.industrySub.etc" },
  ],
  etc: [{ value: "etc", labelKey: "pinnedForm.industrySub.etc" }],
};

export const VISA_OPTIONS: SelectOption[] = [
  { value: "e9", labelKey: "pinnedForm.visa.e9" },
  { value: "e7", labelKey: "pinnedForm.visa.e7" },
  { value: "h2", labelKey: "pinnedForm.visa.h2" },
  { value: "f2_f5_f6", labelKey: "pinnedForm.visa.f2f5f6" },
  { value: "f4", labelKey: "pinnedForm.visa.f4" },
  { value: "d2_d4", labelKey: "pinnedForm.visa.d2d4" },
  { value: "etc", labelKey: "pinnedForm.visa.etc" },
];

export const NIGHT_WORK_OPTIONS: SelectOption[] = [
  { value: "none", labelKey: "pinnedForm.nightWork.none" },
  { value: "sometimes", labelKey: "pinnedForm.nightWork.sometimes" },
  { value: "shift", labelKey: "pinnedForm.nightWork.shift" },
];

export const LIVING_STATUS_OPTIONS: SelectOption[] = [
  { value: "student", labelKey: "pinnedForm.status.student" },
  { value: "worker", labelKey: "pinnedForm.status.worker" },
  { value: "marriage_migrant", labelKey: "pinnedForm.status.marriageMigrant" },
  { value: "etc", labelKey: "pinnedForm.status.etc" },
];

export const HOUSEHOLD_OPTIONS: SelectOption[] = [
  { value: "single", labelKey: "pinnedForm.household.single" },
  { value: "couple", labelKey: "pinnedForm.household.couple" },
  { value: "with_children", labelKey: "pinnedForm.household.withChildren" },
];

export const HOUSING_TYPE_OPTIONS: SelectOption[] = [
  { value: "dorm", labelKey: "pinnedForm.housingType.dorm" },
  { value: "studio", labelKey: "pinnedForm.housingType.studio" },
  { value: "share_room", labelKey: "pinnedForm.housingType.shareRoom" },
  { value: "goshiwon", labelKey: "pinnedForm.housingType.goshiwon" },
  { value: "with_family", labelKey: "pinnedForm.housingType.withFamily" },
  { value: "etc", labelKey: "pinnedForm.housingType.etc" },
];

// 모든 항목이 선택 입력이라, 값을 안 적은(null) 항목은 "0"이 아니라
// "모름"이다. 세전 월급 자체를 안 적었으면 실수령액도 계산할 수 없으니
// null을 돌려주고(= 자동계산 안 함), 공제 항목만 비어있으면 0으로 쳐서
// 계산한다.
export function calcNetPay(
  grossPay: number | null,
  deductHousing: number | null,
  deductFood: number | null,
  deductTaxInsurance: number | null,
  deductOther: number | null,
): number | null {
  if (grossPay === null) return null;
  return (
    grossPay - (deductHousing ?? 0) - (deductFood ?? 0) - (deductTaxInsurance ?? 0) - (deductOther ?? 0)
  );
}

// 지출 항목을 하나도 안 적었으면(전부 null) 총 생활비도 "0원"이 아니라
// "모름"이라 null을 돌려준다. 하나라도 적었으면 안 적은 항목은 0으로 쳐서
// 합산한다.
export function calcTotalCost(expenses: {
  rent: number | null;
  utilities: number | null;
  phone: number | null;
  transport: number | null;
  groceries: number | null;
  eatingOut: number | null;
  shopping: number | null;
  other: number | null;
}): number | null {
  const values = Object.values(expenses);
  if (values.every((v) => v === null)) return null;
  return values.reduce<number>((sum, v) => sum + (v ?? 0), 0);
}

export function calcRemaining(netPay: number | null, totalCost: number | null): number | null {
  if (netPay === null) return null;
  return netPay - (totalCost ?? 0);
}

// "기준 월" 기본값 -- 지난달(현재 로컬 시각 기준).
export function defaultBaseMonth(): string {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export function formatBaseMonth(isoDate: string): string {
  const [y, m] = isoDate.split("-");
  return `${y}.${m}`;
}
