import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function AdminDashboardPage() {
  const admin = createAdminClient();
  const [{ count: pendingReports }, { count: pendingInquiries }] = await Promise.all([
    admin.from("reports").select("id", { count: "exact", head: true }).eq("status", "pending"),
    admin.from("inquiries").select("id", { count: "exact", head: true }).eq("status", "pending"),
  ]);

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
      </div>
    </div>
  );
}
