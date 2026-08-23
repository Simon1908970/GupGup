"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatDate } from "@/lib/utils";

const REASON_LABEL: Record<string, string> = {
  spam: "스팸/광고",
  abuse: "욕설/비방",
  obscene: "음란물",
  fraud: "사기 의심",
  personal_info: "개인정보 노출",
  etc: "기타",
};

const TARGET_LABEL: Record<string, string> = {
  post: "게시글",
  comment: "댓글",
  user: "회원",
};

interface ReportListItem {
  id: string;
  target_type: "post" | "comment" | "user";
  reason: string;
  status: "pending" | "resolved";
  created_at: string;
  reporter: { nickname: string } | null;
}

export default function AdminReportsPage() {
  const [reports, setReports] = useState<ReportListItem[]>([]);
  const [status, setStatus] = useState<"pending" | "all">("pending");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/reports?status=${status}`)
      .then((r) => r.json())
      .then((data) => setReports(data.reports ?? []))
      .finally(() => setLoading(false));
  }, [status]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">신고 관리</h1>
        <div className="flex gap-1.5 text-xs">
          <button
            onClick={() => setStatus("pending")}
            className={status === "pending" ? "font-semibold text-[var(--color-brand-red)]" : "text-[var(--color-text-muted)]"}
          >
            대기 중
          </button>
          <span className="text-[var(--color-border-gray)]">|</span>
          <button
            onClick={() => setStatus("all")}
            className={status === "all" ? "font-semibold text-[var(--color-brand-red)]" : "text-[var(--color-text-muted)]"}
          >
            전체
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-[var(--color-text-muted)]">불러오는 중...</p>
      ) : reports.length === 0 ? (
        <p className="rounded-lg border border-[var(--color-border-gray)] py-10 text-center text-sm text-[var(--color-text-muted)]">
          신고가 없습니다.
        </p>
      ) : (
        <ul className="divide-y divide-[var(--color-border-gray-light)] rounded-lg border border-[var(--color-border-gray)]">
          {reports.map((r) => (
            <li key={r.id}>
              <Link
                href={`/admin/reports/${r.id}`}
                className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-[var(--color-border-gray-light)]"
              >
                <span className="shrink-0 rounded border border-[var(--color-border-gray)] px-1.5 py-0.5 text-xs">
                  {TARGET_LABEL[r.target_type]}
                </span>
                <span className="flex-1 truncate">{REASON_LABEL[r.reason] ?? r.reason}</span>
                <span className="shrink-0 text-xs text-[var(--color-text-muted)]">
                  {r.reporter?.nickname ?? "알 수 없음"}
                </span>
                <span className="shrink-0 text-xs text-[var(--color-text-muted)]">
                  {formatDate(r.created_at)}
                </span>
                <span
                  className={
                    r.status === "pending"
                      ? "shrink-0 text-xs font-semibold text-[var(--color-brand-red)]"
                      : "shrink-0 text-xs text-[var(--color-text-muted)]"
                  }
                >
                  {r.status === "pending" ? "대기" : "완료"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
