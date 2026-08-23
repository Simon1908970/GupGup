"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ConfirmModal } from "@/components/common/ConfirmModal";
import { formatDate } from "@/lib/utils";

const REASON_LABEL: Record<string, string> = {
  spam: "스팸/광고",
  abuse: "욕설/비방",
  obscene: "음란물",
  fraud: "사기 의심",
  personal_info: "개인정보 노출",
  etc: "기타",
};

interface ReportDetail {
  id: string;
  target_type: "post" | "comment" | "user";
  target_id: string;
  reason: string;
  detail: string | null;
  status: "pending" | "resolved";
  created_at: string;
  reporter: { nickname: string } | null;
}

interface PostTarget {
  id: string;
  title: string;
  body: string;
  category: string;
  author: { nickname: string } | null;
}

interface CommentTarget {
  id: string;
  body: string;
  post_id: string;
  is_deleted: boolean;
  author: { nickname: string } | null;
}

interface UserTarget {
  id: string;
  nickname: string;
  country: string;
  is_withdrawn: boolean;
}

export default function AdminReportDetailPage() {
  const params = useParams<{ id: string }>();
  const [report, setReport] = useState<ReportDetail | null>(null);
  const [target, setTarget] = useState<PostTarget | CommentTarget | UserTarget | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  function load() {
    fetch(`/api/admin/reports/${params.id}`)
      .then((r) => r.json())
      .then((data) => {
        setReport(data.report ?? null);
        setTarget(data.target ?? null);
      });
  }

  useEffect(load, [params.id]);

  async function handleResolve() {
    await fetch(`/api/admin/reports/${params.id}/resolve`, { method: "POST" });
    load();
  }

  async function handleDelete() {
    if (!report) return;
    if (report.target_type === "post") {
      await fetch(`/api/admin/posts/${report.target_id}`, { method: "DELETE" });
    } else if (report.target_type === "comment") {
      await fetch(`/api/admin/comments/${report.target_id}`, { method: "PATCH" });
    }
    setConfirmDelete(false);
    load();
  }

  if (!report) {
    return <p className="text-sm text-[var(--color-text-muted)]">불러오는 중...</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <Link href="/admin/reports" className="text-xs text-[var(--color-text-muted)]">
        ← 목록으로
      </Link>
      <h1 className="text-lg font-bold">신고 상세</h1>

      <div className="rounded-lg border border-[var(--color-border-gray)] p-4 text-sm">
        <p>사유: {REASON_LABEL[report.reason] ?? report.reason}</p>
        <p>신고자: {report.reporter?.nickname ?? "알 수 없음"}</p>
        <p>일시: {formatDate(report.created_at)}</p>
        <p>상태: {report.status === "pending" ? "대기" : "처리 완료"}</p>
        {report.detail && <p className="mt-2 whitespace-pre-line">상세: {report.detail}</p>}
      </div>

      <div className="rounded-lg border border-[var(--color-border-gray)] p-4 text-sm">
        <p className="mb-2 font-semibold">신고된 대상</p>
        {!target ? (
          <p className="text-[var(--color-text-muted)]">대상을 찾을 수 없습니다 (이미 삭제됨).</p>
        ) : report.target_type === "post" ? (
          <>
            <p className="font-medium">{(target as PostTarget).title}</p>
            <p className="mt-1 whitespace-pre-line text-[var(--color-text-muted)]">
              {(target as PostTarget).body}
            </p>
            <p className="mt-2 text-xs text-[var(--color-text-muted)]">
              작성자: {(target as PostTarget).author?.nickname ?? "알 수 없음"}
            </p>
          </>
        ) : report.target_type === "comment" ? (
          <>
            <p className="whitespace-pre-line">{(target as CommentTarget).body}</p>
            <p className="mt-2 text-xs text-[var(--color-text-muted)]">
              작성자: {(target as CommentTarget).author?.nickname ?? "알 수 없음"}
              {(target as CommentTarget).is_deleted && " (이미 삭제됨)"}
            </p>
          </>
        ) : (
          <Link href={`/admin/users?q=${(target as UserTarget).nickname}`} className="text-[var(--color-brand-red)]">
            {(target as UserTarget).nickname} 회원 관리로 이동 →
          </Link>
        )}
      </div>

      <div className="flex gap-2">
        {target && report.target_type !== "user" && (
          <button
            onClick={() => setConfirmDelete(true)}
            className="h-10 flex-1 rounded-md border border-[var(--color-brand-red)] text-sm font-medium text-[var(--color-brand-red)]"
          >
            대상 삭제
          </button>
        )}
        {report.status === "pending" && (
          <button
            onClick={handleResolve}
            className="relative h-10 flex-1 rounded-md bg-[var(--color-brand-red)] text-sm font-medium text-white gg-glossy-btn"
          >
            처리 완료로 표시
          </button>
        )}
      </div>

      {confirmDelete && (
        <ConfirmModal
          message="이 대상을 삭제하시겠습니까?"
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </div>
  );
}
