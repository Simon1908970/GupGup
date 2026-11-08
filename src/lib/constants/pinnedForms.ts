import type { DictionaryKey } from "@/lib/i18n/dictionaries";

// "내 월급" / "내 생활비" 고정 글의 입력 양식 설정. 두 양식은 구조가 같아서
// (지역 + 선택형 항목 몇 개 + 금액 항목 여러 개 + 자동계산 + 기준월 + 익명
// 체크박스) 공용 컴포넌트(PinnedFormEntryForm/PinnedFormEntryCard)가 이 설정을
// 읽어서 그린다. 비슷한 고정 폼 글을 나중에 추가할 땐 여기에 새 PinnedFormType
// 하나만 더 정의하면 된다.

export type PinnedFormType = "salary" | "living_cost";

// 작성자의 국가 태그를 카드에 보여줄지 -- 아직 미정이라 기본 off로 두고
// 설정값만 빼놓는다(요청서 4번). true로 바꾸면 카드에 국가 플래그가 뜬다.
export const SHOW_AUTHOR_COUNTRY_TAG = false;

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

export function calcNetPay(
  grossPay: number,
  deductHousing: number,
  deductFood: number,
  deductTaxInsurance: number,
  deductOther: number,
): number {
  return grossPay - deductHousing - deductFood - deductTaxInsurance - deductOther;
}

export function calcTotalCost(expenses: {
  rent: number;
  utilities: number;
  phone: number;
  transport: number;
  groceries: number;
  eatingOut: number;
  shopping: number;
  other: number;
}): number {
  return (
    expenses.rent +
    expenses.utilities +
    expenses.phone +
    expenses.transport +
    expenses.groceries +
    expenses.eatingOut +
    expenses.shopping +
    expenses.other
  );
}

export function calcRemaining(netPay: number, totalCost: number): number {
  return netPay - totalCost;
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
