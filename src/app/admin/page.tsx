import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";

// Google Cloud Translation API free tier: 500,000 characters/month before billing starts.
const TRANSLATION_FREE_LIMIT = 500_000;

export default async function AdminDashboardPage() {
  const admin = createAdminClient();
  const currentMonth = new Date().toISOString().slice(0, 7); // 'YYYY-MM' (UTC-ish, matches the DB's to_char(now() at time zone 'utc', ...))
  const [{ count: pendingReports }, { count: pendingInquiries }, { data: translationUsage }] =
    await Promise.all([
      admin.from("reports").select("id", { count: "exact", head: true }).eq("status", "pending"),
      admin.from("inquiries").select("id", { count: "exact", head: true }).eq("status", "pending"),
      admin
        .from("translation_usage")
        .select("char_count")
        .eq("month", currentMonth)
        .maybeSingle(),
    ]);

  const charCount = translationUsage?.char_count ?? 0;
  const usageRatio = charCount / TRANSLATION_FREE_LIMIT;
  const usageColor =
    usageRatio >= 0.95
      ? "border-[var(--color-brand-red)] text-[var(--color-brand-red)]"
      : usageRatio >= 0.8
        ? "border-amber-500 text-amber-600"
        : "border-[var(--color-border-gray)]";

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-bold">관리자 대시보드</h1>
      <div className="grid grid-cols-2 gap-4">
        <Link
          href="/admin/reports"
          className="rounded-lg border border-[var(--color-border-gray)] p-4 hover:border-[var(--color-brand-red)]"
        >
          <p className="text-xs text-[var(--color-text-muted)]">대기 중인 신고</p>
          <p className="text-2xl font-bold">{pendingReports ?? 0}</p>
        </Link>
        <Link
          href="/admin/inquiries"
          className="rounded-lg border border-[var(--color-border-gray)] p-4 hover:border-[var(--color-brand-red)]"
        >
          <p className="text-xs text-[var(--color-text-muted)]">대기 중인 문의</p>
          <p className="text-2xl font-bold">{pendingInquiries ?? 0}</p>
        </Link>
        <div className={`col-span-2 rounded-lg border p-4 ${usageColor}`}>
          <p className="text-xs text-[var(--color-text-muted)]">
            이번 달 번역 API 사용량 (무료 한도 {TRANSLATION_FREE_LIMIT.toLocaleString()}자)
          </p>
          <p className="text-2xl font-bold">
            {charCount.toLocaleString()}자{" "}
            <span className="text-sm font-normal text-[var(--color-text-muted)]">
              ({(usageRatio * 100).toFixed(1)}%)
            </span>
          </p>
          {usageRatio >= 0.8 && (
            <p className="mt-1 text-xs">
              {usageRatio >= 0.95
                ? "무료 한도에 거의 도달했습니다. 초과 시 과금이 시작됩니다."
                : "무료 한도의 80%를 넘었습니다."}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
