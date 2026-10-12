import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { cn } from "@/lib/utils";

// 사이트 정책상 이메일/푸시 알림을 쓰지 않으므로(CLAUDE.md), 소진 임박 알림도
// 관리자가 이 대시보드를 열었을 때 보이는 카드로만 제공한다.
const TOPIK_LOW_THRESHOLD_DAYS = 7;

// Google Cloud Translation API free tier: 500,000 characters/month before billing starts.
const TRANSLATION_FREE_LIMIT = 500_000;

function todayInSeoul(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
}

function daysBetween(fromISODate: string, toISODate: string): number {
  const from = new Date(`${fromISODate}T00:00:00Z`);
  const to = new Date(`${toISODate}T00:00:00Z`);
  return Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}

export default async function AdminDashboardPage() {
  const admin = createAdminClient();
  const currentMonth = new Date().toISOString().slice(0, 7); // 'YYYY-MM' (UTC-ish, matches the DB's to_char(now() at time zone 'utc', ...))
  const [
    { count: pendingReports },
    { count: pendingInquiries },
    { data: translationUsage },
    { data: lastTopik },
  ] = await Promise.all([
    admin.from("reports").select("id", { count: "exact", head: true }).eq("status", "pending"),
    admin.from("inquiries").select("id", { count: "exact", head: true }).eq("status", "pending"),
    admin.from("translation_usage").select("char_count").eq("month", currentMonth).maybeSingle(),
    admin
      .from("topik_questions")
      .select("display_date")
      .order("display_date", { ascending: false })
      .limit(1)
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

  const topikDaysRemaining = lastTopik ? daysBetween(todayInSeoul(), lastTopik.display_date) : null;
  const topikLow = topikDaysRemaining === null || topikDaysRemaining <= TOPIK_LOW_THRESHOLD_DAYS;

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
        <div className={`rounded-lg border p-4 ${usageColor}`}>
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
        <div
          className={cn(
            "rounded-lg border p-4",
            topikLow
              ? "border-[var(--color-brand-red)] bg-[var(--color-brand-red-light)]"
              : "border-[var(--color-border-gray)]",
          )}
        >
          <p className="text-xs text-[var(--color-text-muted)]">토픽 문제 남은 일수</p>
          <p className={cn("text-2xl font-bold", topikLow && "text-[var(--color-brand-red)]")}>
            {topikDaysRemaining === null ? "없음" : `D-${Math.max(topikDaysRemaining, 0)}`}
          </p>
          {topikLow && (
            <p className="mt-1 text-[11px] text-[var(--color-brand-red)]">
              &quot;토픽문제를 만들어줘&quot;라고 요청하면 새로 만들어 올려드립니다.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
