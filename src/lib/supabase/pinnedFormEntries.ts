import { createClient } from "@/lib/supabase/client";
import type { Author, CountryCode, LivingCostEntry, SalaryEntry } from "@/lib/types";
import {
  INDUSTRY_SUB_OPTIONS,
  VISA_OPTIONS,
  HOUSING_TYPE_OPTIONS,
  LIVING_STATUS_OPTIONS,
  LOCALE_TO_COUNTRY,
  formatBaseMonth,
  calcNetPay,
  calcTotalCost,
  calcRemaining,
  type SelectOption,
} from "@/lib/constants/pinnedForms";
import { regionLabel } from "@/lib/constants/regions";
import { PINNED_FORM_CARD_REWARD } from "@/lib/constants/points";
import { DICTIONARIES } from "@/lib/i18n/dictionaries";

// 요약 문구는 "댓글"로도 쓰이는 평문 텍스트(예: 내 댓글 목록, 검색)라 항상
// 한국어로 고정한다 -- "탈퇴한 회원입니다" 같은 다른 고정 운영 문구와 같은
// 취급이고, 보는 화면에서는 어차피 구조화 카드(PinnedFormEntryCard)가 이
// 텍스트를 대신 그려서 보여준다.
function labelFor(options: SelectOption[], value: string | null): string | null {
  if (!value) return null;
  const key = options.find((o) => o.value === value)?.labelKey;
  return key ? DICTIONARIES.ko[key] : value;
}

// 23505 = Postgres unique_violation. (post_id, user_id, base_month) 유니크
// 제약(0034)에 걸렸다는 뜻 -- 같은 달 기록이 이미 있다는 신호라서, 호출 쪽이
// "수정하시겠어요?" 확인창으로 넘어갈 수 있게 구분된 에러로 다시 던진다.
export class DuplicateMonthError extends Error {
  constructor() {
    super("DUPLICATE_MONTH_ENTRY");
    this.name = "DuplicateMonthError";
  }
}

interface EntryPublicRow {
  id: string;
  post_id: string;
  comment_id: string;
  is_deleted: boolean;
  is_anonymous: boolean;
  user_id: string | null;
  nickname: string | null;
  avatar_url: string | null;
  country: CountryCode | null;
  is_withdrawn: boolean;
  is_supporter: boolean;
  region_province: string | null;
  region_city: string | null;
  base_month: string;
  created_at: string;
  author_locale: string | null;
}

// 익명 여부와 무관하게 쓸 수 있는 국기 -- profiles.country(실제 신원)가 아닌
// 제출 시점 시스템 언어로 추정한 값이라 안전하다.
function flagCountry(row: EntryPublicRow): CountryCode | undefined {
  const locale = row.author_locale as keyof typeof LOCALE_TO_COUNTRY | null;
  return locale ? LOCALE_TO_COUNTRY[locale] : undefined;
}

function mapAuthor(row: EntryPublicRow): Author {
  if (row.is_anonymous || !row.user_id) {
    return {
      id: `anon-${row.id}`,
      nickname: "익명",
      country: "etc",
      isAnonymousCard: true,
      flagCountry: flagCountry(row),
    };
  }
  return {
    id: row.user_id,
    nickname: row.nickname ?? "알 수 없음",
    country: row.country ?? "etc",
    avatarUrl: row.avatar_url ?? undefined,
    isWithdrawn: row.is_withdrawn,
    isSupporter: row.is_supporter,
    flagCountry: flagCountry(row),
  };
}

interface SalaryEntryRow extends EntryPublicRow {
  industry_main: string | null;
  industry_sub: string | null;
  visa: string | null;
  weekly_hours: number | null;
  monthly_days_off: number | null;
  night_work: "none" | "sometimes" | "shift";
  gross_pay: number | null;
  overtime_included: boolean;
  deduct_housing: number | null;
  deduct_food: number | null;
  deduct_tax_insurance: number | null;
  deduct_other: number | null;
  net_pay: number | null;
}

function mapSalaryEntry(row: SalaryEntryRow): SalaryEntry {
  return {
    id: row.id,
    postId: row.post_id,
    commentId: row.comment_id,
    isDeleted: row.is_deleted,
    isAnonymous: row.is_anonymous,
    author: mapAuthor(row),
    regionProvince: row.region_province,
    regionCity: row.region_city,
    industryMain: row.industry_main,
    industrySub: row.industry_sub,
    visa: row.visa,
    weeklyHours: row.weekly_hours,
    monthlyDaysOff: row.monthly_days_off,
    nightWork: row.night_work,
    grossPay: row.gross_pay,
    overtimeIncluded: row.overtime_included,
    deductHousing: row.deduct_housing,
    deductFood: row.deduct_food,
    deductTaxInsurance: row.deduct_tax_insurance,
    deductOther: row.deduct_other,
    netPay: row.net_pay,
    baseMonth: row.base_month,
    createdAt: row.created_at,
    authorLocale: row.author_locale,
  };
}

interface LivingCostEntryRow extends EntryPublicRow {
  status: string | null;
  household: string | null;
  housing_type: string | null;
  net_pay: number | null;
  rent: number | null;
  utilities: number | null;
  phone: number | null;
  transport: number | null;
  groceries: number | null;
  eating_out: number | null;
  shopping: number | null;
  other: number | null;
  total_cost: number | null;
  remaining: number | null;
}

function mapLivingCostEntry(row: LivingCostEntryRow): LivingCostEntry {
  return {
    id: row.id,
    postId: row.post_id,
    commentId: row.comment_id,
    isDeleted: row.is_deleted,
    isAnonymous: row.is_anonymous,
    author: mapAuthor(row),
    regionProvince: row.region_province,
    regionCity: row.region_city,
    status: row.status,
    household: row.household,
    housingType: row.housing_type,
    netPay: row.net_pay,
    rent: row.rent,
    utilities: row.utilities,
    phone: row.phone,
    transport: row.transport,
    groceries: row.groceries,
    eatingOut: row.eating_out,
    shopping: row.shopping,
    other: row.other,
    totalCost: row.total_cost,
    remaining: row.remaining,
    baseMonth: row.base_month,
    createdAt: row.created_at,
    authorLocale: row.author_locale,
  };
}

const SALARY_PUBLIC_SELECT =
  "id, post_id, comment_id, is_deleted, is_anonymous, user_id, nickname, avatar_url, country, is_withdrawn, is_supporter, author_locale, region_province, region_city, industry_main, industry_sub, visa, weekly_hours, monthly_days_off, night_work, gross_pay, overtime_included, deduct_housing, deduct_food, deduct_tax_insurance, deduct_other, net_pay, base_month, created_at";

const LIVING_COST_PUBLIC_SELECT =
  "id, post_id, comment_id, is_deleted, is_anonymous, user_id, nickname, avatar_url, country, is_withdrawn, is_supporter, author_locale, region_province, region_city, status, household, housing_type, net_pay, rent, utilities, phone, transport, groceries, eating_out, shopping, other, total_cost, remaining, base_month, created_at";

export async function fetchSalaryEntries(postId: string): Promise<SalaryEntry[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("salary_entries_public")
    .select(SALARY_PUBLIC_SELECT)
    .eq("post_id", postId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as unknown as SalaryEntryRow[]).map(mapSalaryEntry);
}

export async function fetchLivingCostEntries(postId: string): Promise<LivingCostEntry[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("living_cost_entries_public")
    .select(LIVING_COST_PUBLIC_SELECT)
    .eq("post_id", postId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as unknown as LivingCostEntryRow[]).map(mapLivingCostEntry);
}

// 내가 이 글에 이 기준월로 이미 올린 기록이 있는지 (중복 제출 확인 + 수정용
// 초깃값). 익명으로 올렸어도 본인 조회는 base table RLS("owner reads own
// rows")로 그대로 보인다.
export async function fetchMySalaryEntryForMonth(
  postId: string,
  userId: string,
  baseMonth: string,
): Promise<SalaryEntry | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("salary_entries")
    .select(
      "id, post_id, comment_id, is_anonymous, region_province, region_city, industry_main, industry_sub, visa, weekly_hours, monthly_days_off, night_work, gross_pay, overtime_included, deduct_housing, deduct_food, deduct_tax_insurance, deduct_other, net_pay, base_month, created_at",
    )
    .eq("post_id", postId)
    .eq("user_id", userId)
    .eq("base_month", baseMonth)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return mapSalaryEntry({
    ...data,
    is_deleted: false,
    user_id: userId,
    nickname: null,
    avatar_url: null,
    country: null,
    is_withdrawn: false,
    is_supporter: false,
    author_locale: null,
  } as SalaryEntryRow);
}

export async function fetchMyLivingCostEntryForMonth(
  postId: string,
  userId: string,
  baseMonth: string,
): Promise<LivingCostEntry | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("living_cost_entries")
    .select(
      "id, post_id, comment_id, is_anonymous, region_province, region_city, status, household, housing_type, net_pay, rent, utilities, phone, transport, groceries, eating_out, shopping, other, total_cost, remaining, base_month, created_at",
    )
    .eq("post_id", postId)
    .eq("user_id", userId)
    .eq("base_month", baseMonth)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return mapLivingCostEntry({
    ...data,
    is_deleted: false,
    user_id: userId,
    nickname: null,
    avatar_url: null,
    country: null,
    is_withdrawn: false,
    is_supporter: false,
    author_locale: null,
  } as LivingCostEntryRow);
}

// 카드 목록에서 "이게 내 카드인가"를 판단하기 위한, 이 글에 내가 올린 모든
// comment_id 집합(모든 기준월 포함). 익명 카드라도 내 눈에는 수정/삭제
// 버튼이 보여야 하므로 author.id 비교 대신 이 집합으로 판단한다.
export async function fetchMyEntryCommentIds(
  postId: string,
  userId: string,
  formType: "salary" | "living_cost",
): Promise<Set<string>> {
  const supabase = createClient();
  const table = formType === "salary" ? "salary_entries" : "living_cost_entries";
  const { data, error } = await supabase
    .from(table)
    .select("comment_id")
    .eq("post_id", postId)
    .eq("user_id", userId);
  if (error) throw error;
  return new Set((data ?? []).map((r) => r.comment_id as string));
}

// 선택 입력이라 빈 항목은 문장에서 그냥 뺀다(0으로 지어내지 않는다).
function summarizeSalary(input: SalaryEntryInput): string {
  const industryLabel = input.industryMain
    ? labelFor(INDUSTRY_SUB_OPTIONS[input.industryMain] ?? [], input.industrySub)
    : null;
  const visaLabel = labelFor(VISA_OPTIONS, input.visa);
  const region = regionLabel(input.regionProvince, input.regionCity);
  const net = calcNetPay(
    input.grossPay,
    input.deductHousing,
    input.deductFood,
    input.deductTaxInsurance,
    input.deductOther,
  );
  const headParts = [industryLabel && `[${industryLabel}]`, region, visaLabel && `/ ${visaLabel}`]
    .filter(Boolean)
    .join(" ");
  const hoursParts = [
    input.weeklyHours !== null && `주 ${input.weeklyHours}시간`,
    input.monthlyDaysOff !== null && `월 휴무 ${input.monthlyDaysOff}일`,
  ]
    .filter(Boolean)
    .join(" · ");
  const payLine =
    input.grossPay !== null
      ? `세전 ${input.grossPay}만원${input.overtimeIncluded ? "(잔업 포함)" : ""}${
          net !== null ? ` → 실수령 ${net}만원` : ""
        }`
      : net !== null
        ? `실수령 ${net}만원`
        : null;
  return [headParts, hoursParts, [payLine, `(${formatBaseMonth(input.baseMonth)})`].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join("\n");
}

function summarizeLivingCost(input: LivingCostEntryInput): string {
  const statusLabel = labelFor(LIVING_STATUS_OPTIONS, input.status);
  const housingLabel = labelFor(HOUSING_TYPE_OPTIONS, input.housingType);
  const region = regionLabel(input.regionProvince, input.regionCity);
  const total = calcTotalCost({
    rent: input.rent,
    utilities: input.utilities,
    phone: input.phone,
    transport: input.transport,
    groceries: input.groceries,
    eatingOut: input.eatingOut,
    shopping: input.shopping,
    other: input.other,
  });
  const remaining = calcRemaining(input.netPay, total);
  const headParts = [statusLabel && `[${statusLabel}]`, region, housingLabel && `/ ${housingLabel}`]
    .filter(Boolean)
    .join(" ");
  const moneyParts = [
    total !== null && `생활비 ${total}만원`,
    input.netPay !== null && `실수령 ${input.netPay}만원`,
    remaining !== null && `→ 남는 돈 ${remaining}만원`,
  ]
    .filter(Boolean)
    .join(" · ");
  return [headParts, [moneyParts, `(${formatBaseMonth(input.baseMonth)})`].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join("\n");
}

export interface SalaryEntryInput {
  regionProvince: string | null;
  regionCity: string | null;
  industryMain: string | null;
  industrySub: string | null;
  visa: string | null;
  weeklyHours: number | null;
  monthlyDaysOff: number | null;
  nightWork: "none" | "sometimes" | "shift";
  grossPay: number | null;
  overtimeIncluded: boolean;
  deductHousing: number | null;
  deductFood: number | null;
  deductTaxInsurance: number | null;
  deductOther: number | null;
  netPay: number | null;
  baseMonth: string;
  isAnonymous: boolean;
  // 제출 시점의 사이트 UI 언어(useLanguage().locale) -- "익명" 옆 국기
  // 표시용. profiles.country가 아니라 이 값으로 국기를 정한다.
  authorLocale: string;
}

export interface LivingCostEntryInput {
  regionProvince: string | null;
  regionCity: string | null;
  status: string | null;
  household: string | null;
  housingType: string | null;
  netPay: number | null;
  rent: number | null;
  utilities: number | null;
  phone: number | null;
  transport: number | null;
  groceries: number | null;
  eatingOut: number | null;
  shopping: number | null;
  other: number | null;
  totalCost: number | null;
  remaining: number | null;
  baseMonth: string;
  isAnonymous: boolean;
  authorLocale: string;
}

async function insertCardComment(postId: string, userId: string, body: string): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("comments")
    .insert({ post_id: postId, author_id: userId, body, points_awarded: PINNED_FORM_CARD_REWARD })
    .select("id")
    .single();
  if (error) throw error;
  await supabase.rpc("adjust_points", { delta: PINNED_FORM_CARD_REWARD });
  return data.id;
}

export async function submitSalaryEntry(
  postId: string,
  userId: string,
  input: SalaryEntryInput,
): Promise<void> {
  const supabase = createClient();
  const commentId = await insertCardComment(postId, userId, summarizeSalary(input));
  const { error } = await supabase.from("salary_entries").insert({
    post_id: postId,
    user_id: userId,
    comment_id: commentId,
    is_anonymous: input.isAnonymous,
    region_province: input.regionProvince,
    region_city: input.regionCity,
    industry_main: input.industryMain,
    industry_sub: input.industrySub,
    visa: input.visa,
    weekly_hours: input.weeklyHours,
    monthly_days_off: input.monthlyDaysOff,
    night_work: input.nightWork,
    gross_pay: input.grossPay,
    overtime_included: input.overtimeIncluded,
    deduct_housing: input.deductHousing,
    deduct_food: input.deductFood,
    deduct_tax_insurance: input.deductTaxInsurance,
    deduct_other: input.deductOther,
    net_pay: input.netPay,
    base_month: input.baseMonth,
    author_locale: input.authorLocale,
  });
  if (error) {
    // 댓글은 이미 만들어졌는데 구조화 데이터 insert가 실패한 경우 -- 특히
    // 유니크 제약(같은 달 중복) 위반이면 댓글만 남기지 않고 지운다.
    await supabase.from("comments").delete().eq("id", commentId);
    if (error.code === "23505") throw new DuplicateMonthError();
    throw error;
  }
}

export async function submitLivingCostEntry(
  postId: string,
  userId: string,
  input: LivingCostEntryInput,
): Promise<void> {
  const supabase = createClient();
  const commentId = await insertCardComment(postId, userId, summarizeLivingCost(input));
  const { error } = await supabase.from("living_cost_entries").insert({
    post_id: postId,
    user_id: userId,
    comment_id: commentId,
    is_anonymous: input.isAnonymous,
    region_province: input.regionProvince,
    region_city: input.regionCity,
    status: input.status,
    household: input.household,
    housing_type: input.housingType,
    net_pay: input.netPay,
    rent: input.rent,
    utilities: input.utilities,
    phone: input.phone,
    transport: input.transport,
    groceries: input.groceries,
    eating_out: input.eatingOut,
    shopping: input.shopping,
    other: input.other,
    total_cost: input.totalCost,
    remaining: input.remaining,
    base_month: input.baseMonth,
    author_locale: input.authorLocale,
  });
  if (error) {
    await supabase.from("comments").delete().eq("id", commentId);
    if (error.code === "23505") throw new DuplicateMonthError();
    throw error;
  }
}

export async function updateSalaryEntry(
  entryId: string,
  commentId: string,
  userId: string,
  input: SalaryEntryInput,
): Promise<void> {
  const supabase = createClient();
  const { error: commentError } = await supabase
    .from("comments")
    .update({ body: summarizeSalary(input) })
    .eq("id", commentId)
    .eq("author_id", userId);
  if (commentError) throw commentError;

  const { error } = await supabase
    .from("salary_entries")
    .update({
      is_anonymous: input.isAnonymous,
      region_province: input.regionProvince,
      region_city: input.regionCity,
      industry_main: input.industryMain,
      industry_sub: input.industrySub,
      visa: input.visa,
      weekly_hours: input.weeklyHours,
      monthly_days_off: input.monthlyDaysOff,
      night_work: input.nightWork,
      gross_pay: input.grossPay,
      overtime_included: input.overtimeIncluded,
      deduct_housing: input.deductHousing,
      deduct_food: input.deductFood,
      deduct_tax_insurance: input.deductTaxInsurance,
      deduct_other: input.deductOther,
      net_pay: input.netPay,
      base_month: input.baseMonth,
      author_locale: input.authorLocale,
      updated_at: new Date().toISOString(),
    })
    .eq("id", entryId)
    .eq("user_id", userId);
  if (error) {
    if (error.code === "23505") throw new DuplicateMonthError();
    throw error;
  }
}

export async function updateLivingCostEntry(
  entryId: string,
  commentId: string,
  userId: string,
  input: LivingCostEntryInput,
): Promise<void> {
  const supabase = createClient();
  const { error: commentError } = await supabase
    .from("comments")
    .update({ body: summarizeLivingCost(input) })
    .eq("id", commentId)
    .eq("author_id", userId);
  if (commentError) throw commentError;

  const { error } = await supabase
    .from("living_cost_entries")
    .update({
      is_anonymous: input.isAnonymous,
      region_province: input.regionProvince,
      region_city: input.regionCity,
      status: input.status,
      household: input.household,
      housing_type: input.housingType,
      net_pay: input.netPay,
      rent: input.rent,
      utilities: input.utilities,
      phone: input.phone,
      transport: input.transport,
      groceries: input.groceries,
      eating_out: input.eatingOut,
      shopping: input.shopping,
      other: input.other,
      total_cost: input.totalCost,
      remaining: input.remaining,
      base_month: input.baseMonth,
      author_locale: input.authorLocale,
      updated_at: new Date().toISOString(),
    })
    .eq("id", entryId)
    .eq("user_id", userId);
  if (error) {
    if (error.code === "23505") throw new DuplicateMonthError();
    throw error;
  }
}
