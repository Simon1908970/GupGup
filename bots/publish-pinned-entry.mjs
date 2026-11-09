// Publishes one "내 월급"/"내 생활비" card (see CLAUDE.md pinned-form-posts
// memory) under a supporter bot account -- same idea as publish-comment.mjs,
// but this also writes the structured salary_entries/living_cost_entries row
// and auto-computes net_pay/total_cost/remaining the same way the web form
// does (see src/lib/constants/pinnedForms.ts calcNetPay/calcTotalCost/
// calcRemaining -- kept in sync by hand since this is a plain .mjs script).
//
// All detail fields are optional (migration 0035) -- omit anything the
// source data doesn't give; this script never invents a number to fill a
// gap.
//
// Usage:
//   node --env-file=.env.local bots/publish-pinned-entry.mjs <draft.json> [--dry-run]
//   node --env-file=.env.local bots/publish-pinned-entry.mjs <batch.json> --batch [--dry-run]
//
// draft.json (one entry):
//   {
//     postId, pinnedFormType: "salary" | "living_cost", author,
//     isAnonymous?: boolean (default true),
//     baseMonth: "YYYY-MM-01",
//     // salary fields (all optional): regionProvince, regionCity,
//     // industryMain, industrySub, visa, weeklyHours, monthlyDaysOff,
//     // nightWork, grossPay, overtimeIncluded, deductHousing, deductFood,
//     // deductTaxInsurance, deductOther, netPay (auto-computed from
//     // grossPay/deductions if omitted)
//     // living_cost fields (all optional): regionProvince, regionCity,
//     // status, household, housingType, netPay, rent, utilities, phone,
//     // transport, groceries, eatingOut, shopping, other
//     source?: "<URL this entry's numbers came from, for our own records>"
//   }
// batch.json: an array of the above.

import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { loadCommentAuthors } from "./publish-comment.mjs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function sum(...values) {
  const present = values.filter((v) => v !== null && v !== undefined);
  if (present.length === 0) return null;
  return present.reduce((a, b) => a + b, 0);
}

function calcNetPay(d) {
  if (d.grossPay == null) return d.netPay ?? null;
  const deductions = sum(d.deductHousing, d.deductFood, d.deductTaxInsurance, d.deductOther) ?? 0;
  return d.grossPay - deductions;
}

function calcTotalCost(d) {
  return sum(d.rent, d.utilities, d.phone, d.transport, d.groceries, d.eatingOut, d.shopping, d.other);
}

function calcRemaining(netPay, totalCost) {
  if (netPay == null) return null;
  return netPay - (totalCost ?? 0);
}

// 한국어 라벨 -- src/lib/constants/pinnedForms.ts의 OPTIONS 배열 + ko 사전과
// 같은 값으로 맞춰둔다(둘이 따로 노는 걸 막기 위해 둘 다 고치면 여기도 고칠 것).
const INDUSTRY_MAIN_LABELS = {
  manufacturing: "제조", agriculture: "농업", fishery: "어업",
  construction: "건설", service: "서비스", etc: "기타",
};
const INDUSTRY_SUB_LABELS = {
  metal: "금속가공", autoparts: "자동차부품", shipbuilding: "조선", food: "식품",
  electronics: "전자·전기", plastic_rubber: "플라스틱·고무", textile: "섬유·의류",
  chemical: "화학", livestock: "축산", vegetable_greenhouse: "채소·시설원예",
  orchard: "과수", mushroom: "버섯", aquaculture: "양식", fishing_boat: "어선",
  seafood_processing: "수산가공", construction: "건설", restaurant: "음식점",
  lodging: "숙박", logistics_delivery: "물류·택배", etc: "기타",
};
const VISA_LABELS = {
  e9: "E-9", e7: "E-7", h2: "H-2", f2_f5_f6: "F-2·F-5·F-6", f4: "F-4",
  d2_d4: "D-2·D-4(유학)", etc: "기타",
};
const STATUS_LABELS = { student: "유학생", worker: "노동자(E-9 등)", marriage_migrant: "결혼이민", etc: "기타" };
const HOUSING_TYPE_LABELS = {
  dorm: "기숙사", studio: "원룸", share_room: "쉐어룸", goshiwon: "고시원",
  with_family: "가족과 함께", etc: "기타",
};

const REGION_LABELS = {
  seoul: "서울", busan: "부산", daegu: "대구", incheon: "인천", gwangju: "광주",
  daejeon: "대전", ulsan: "울산", sejong: "세종", gyeonggi: "경기", gangwon: "강원",
  chungbuk: "충북", chungnam: "충남", jeonbuk: "전북", jeonnam: "전남",
  gyeongbuk: "경북", gyeongnam: "경남", jeju: "제주",
};

function regionText(d) {
  const parts = [];
  if (d.regionProvince) parts.push(REGION_LABELS[d.regionProvince] ?? d.regionProvince);
  if (d.regionCity) parts.push(d.regionCity);
  return parts.join(" ");
}

function formatBaseMonth(iso) {
  const [y, m] = iso.split("-");
  return `${y}.${m}`;
}

function summarizeSalary(d) {
  const net = calcNetPay(d);
  const industryLabel = d.industrySub
    ? (INDUSTRY_SUB_LABELS[d.industrySub] ?? d.industrySub)
    : d.industryMain
      ? (INDUSTRY_MAIN_LABELS[d.industryMain] ?? d.industryMain)
      : null;
  const head = [industryLabel, regionText(d), d.visa && (VISA_LABELS[d.visa] ?? d.visa)].filter(Boolean).join(" / ");
  const hours = [
    d.weeklyHours != null && `주 ${d.weeklyHours}시간`,
    d.monthlyDaysOff != null && `월 휴무 ${d.monthlyDaysOff}일`,
  ].filter(Boolean).join(" · ");
  const pay = d.grossPay != null
    ? `세전 ${d.grossPay}만원${net != null ? ` → 실수령 ${net}만원` : ""}`
    : net != null ? `실수령 ${net}만원` : null;
  return [head, hours, [pay, `(${formatBaseMonth(d.baseMonth)})`].filter(Boolean).join(" ")]
    .filter(Boolean).join("\n");
}

function summarizeLivingCost(d) {
  const total = calcTotalCost(d);
  const net = d.netPay ?? null;
  const remaining = calcRemaining(net, total);
  const head = [
    regionText(d),
    d.status && (STATUS_LABELS[d.status] ?? d.status),
    d.housingType && (HOUSING_TYPE_LABELS[d.housingType] ?? d.housingType),
  ].filter(Boolean).join(" / ");
  const money = [
    total != null && `생활비 ${total}만원`,
    net != null && `실수령 ${net}만원`,
    remaining != null && `→ 남는 돈 ${remaining}만원`,
  ].filter(Boolean).join(" · ");
  return [head, [money, `(${formatBaseMonth(d.baseMonth)})`].filter(Boolean).join(" ")]
    .filter(Boolean).join("\n");
}

// 이 스크립트로 올리는 카드는 실제 브라우저 세션이 없어서 "시스템 언어"를
// 감지할 수 없다 -- draft의 author 계정 country로 대신 추정한다(제보 출처
// 국가와 같음). reply-accounts.json/accounts.json의 키 접두사 규칙: 베트남만
// 접두사 없이 "r1".."r47", 나머지는 "<국가코드>-r1" 식.
const AUTHOR_PREFIX_TO_LOCALE = {
  th: "th", la: "lo", id: "id", mm: "my", ph: "tl", mn: "mn", kh: "km",
};
function inferAuthorLocale(authorKey) {
  const prefix = authorKey.split("-")[0];
  if (AUTHOR_PREFIX_TO_LOCALE[prefix]) return AUTHOR_PREFIX_TO_LOCALE[prefix];
  if (/^r\d+$/.test(authorKey) || /^vn/.test(authorKey)) return "vi";
  return null;
}

export function buildEntryRow(d, postId, userId) {
  if (d.pinnedFormType === "salary") {
    return {
      post_id: postId,
      user_id: userId,
      is_anonymous: d.isAnonymous !== false,
      region_province: d.regionProvince ?? null,
      region_city: d.regionCity ?? null,
      industry_main: d.industryMain ?? null,
      industry_sub: d.industrySub ?? null,
      visa: d.visa ?? null,
      weekly_hours: d.weeklyHours ?? null,
      monthly_days_off: d.monthlyDaysOff ?? null,
      night_work: d.nightWork ?? "none",
      gross_pay: d.grossPay ?? null,
      overtime_included: d.overtimeIncluded ?? false,
      deduct_housing: d.deductHousing ?? null,
      deduct_food: d.deductFood ?? null,
      deduct_tax_insurance: d.deductTaxInsurance ?? null,
      deduct_other: d.deductOther ?? null,
      net_pay: d.netPay ?? calcNetPay(d),
      base_month: d.baseMonth,
      author_locale: d.authorLocale ?? inferAuthorLocale(d.author),
    };
  }
  const totalCost = calcTotalCost(d);
  return {
    post_id: postId,
    user_id: userId,
    is_anonymous: d.isAnonymous !== false,
    region_province: d.regionProvince ?? null,
    region_city: d.regionCity ?? null,
    status: d.status ?? null,
    household: d.household ?? null,
    housing_type: d.housingType ?? null,
    net_pay: d.netPay ?? null,
    rent: d.rent ?? null,
    utilities: d.utilities ?? null,
    phone: d.phone ?? null,
    transport: d.transport ?? null,
    groceries: d.groceries ?? null,
    eating_out: d.eatingOut ?? null,
    shopping: d.shopping ?? null,
    other: d.other ?? null,
    total_cost: totalCost,
    remaining: calcRemaining(d.netPay ?? null, totalCost),
    base_month: d.baseMonth,
    author_locale: d.authorLocale ?? inferAuthorLocale(d.author),
  };
}

export function validateDraft(d) {
  if (!d || typeof d !== "object") return "draft must be an object";
  if (!UUID_RE.test(d.postId ?? "")) return "invalid: postId";
  if (!["salary", "living_cost"].includes(d.pinnedFormType)) return "invalid: pinnedFormType";
  if (typeof d.author !== "string" || !d.author.trim()) return "missing: author";
  if (typeof d.baseMonth !== "string" || !/^\d{4}-\d{2}-01$/.test(d.baseMonth)) {
    return "invalid: baseMonth (expected YYYY-MM-01)";
  }
  return null;
}

async function publishOne(supabase, authors, d, dryRun) {
  const reason = validateDraft(d);
  if (reason) return { ok: false, error: `invalid draft: ${reason}` };

  const account = authors[d.author];
  if (!account?.profileId) {
    return { ok: false, error: `no bot account set up for author "${d.author}"` };
  }
  const table = d.pinnedFormType === "salary" ? "salary_entries" : "living_cost_entries";
  const body = d.pinnedFormType === "salary" ? summarizeSalary(d) : summarizeLivingCost(d);

  if (dryRun) {
    return {
      ok: true,
      dryRun: true,
      comment: { post_id: d.postId, author_id: account.profileId, body },
      entry: buildEntryRow(d, d.postId, account.profileId),
    };
  }

  const { data: comment, error: commentError } = await supabase
    .from("comments")
    .insert({ post_id: d.postId, author_id: account.profileId, body, points_awarded: 0 })
    .select("id")
    .single();
  if (commentError) return { ok: false, error: `comment insert failed: ${commentError.message}` };

  const row = { ...buildEntryRow(d, d.postId, account.profileId), comment_id: comment.id };
  const { data: entry, error } = await supabase.from(table).insert(row).select("id").single();
  if (error) {
    await supabase.from("comments").delete().eq("id", comment.id);
    return { ok: false, error: `${table} insert failed: ${error.message}` };
  }
  return { ok: true, commentId: comment.id, entryId: entry.id, postId: d.postId, pinnedFormType: d.pinnedFormType };
}

export function parseArgs(argv) {
  const rest = argv.slice(2);
  const unknown = rest.filter((a) => a.startsWith("-") && a !== "--dry-run" && a !== "--batch");
  if (unknown.length) throw new Error(`unknown flag(s): ${unknown.join(", ")}`);
  return {
    file: rest.find((a) => !a.startsWith("-")),
    dryRun: rest.includes("--dry-run"),
    batch: rest.includes("--batch"),
  };
}

async function main() {
  const { file, dryRun, batch } = parseArgs(process.argv);
  if (!file) {
    console.error(
      "usage: node --env-file=.env.local bots/publish-pinned-entry.mjs <draft.json> [--batch] [--dry-run]",
    );
    process.exit(1);
  }

  let drafts;
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8"));
    drafts = batch ? parsed : [parsed];
    if (batch && !Array.isArray(drafts)) throw new Error("--batch expects a JSON array");
  } catch (err) {
    console.error(`cannot read draft: ${err.message}`);
    process.exit(1);
  }

  const authors = loadCommentAuthors();
  let supabase = null;
  if (!dryRun) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      console.error("missing env: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
      process.exit(1);
    }
    supabase = createClient(url, key, { auth: { persistSession: false } });
  }

  const results = [];
  for (const d of drafts) {
    results.push(await publishOne(supabase, authors, d, dryRun));
  }
  console.log(JSON.stringify(results, null, 2));
  if (results.some((r) => !r.ok)) process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
