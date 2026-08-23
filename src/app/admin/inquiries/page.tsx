"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatDate } from "@/lib/utils";

interface InquiryListItem {
  id: string;
  title: string;
  status: "pending" | "answered";
  created_at: string;
  user: { nickname: string } | null;
}

export default function AdminInquiriesPage() {
  const [inquiries, setInquiries] = useState<InquiryListItem[]>([]);
  const [status, setStatus] = useState<"pending" | "all">("pending");

  useEffect(() => {
    fetch(`/api/admin/inquiries?status=${status}`)
      .then((r) => r.json())
      .then((data) => setInquiries(data.inquiries ?? []));
  }, [status]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">문의사항</h1>
        <div className="flex gap-1.5 text-xs">
          <button
            onClick={() => setStatus("pending")}
            className={status === "pending" ? "font-semibold text-[var(--color-brand-red)]" : "text-[var(--color-text-muted)]"}
          >
            답변대기
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

      {inquiries.length === 0 ? (
        <p className="rounded-lg border border-[var(--color-border-gray)] py-10 text-center text-sm text-[var(--color-text-muted)]">
          문의가 없습니다.
        </p>
      ) : (
        <ul className="divide-y divide-[var(--color-border-gray-light)] rounded-lg border border-[var(--color-border-gray)]">
          {inquiries.map((i) => (
            <li key={i.id}>
              <Link
                href={`/admin/inquiries/${i.id}`}
                className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-[var(--color-border-gray-light)]"
              >
                <span className="flex-1 truncate">{i.title}</span>
                <span className="shrink-0 text-xs text-[var(--color-text-muted)]">
                  {i.user?.nickname ?? "알 수 없음"}
                </span>
                <span className="shrink-0 text-xs text-[var(--color-text-muted)]">
                  {formatDate(i.created_at)}
                </span>
                <span
                  className={
                    i.status === "pending"
                      ? "shrink-0 text-xs font-semibold text-[var(--color-brand-red)]"
                      : "shrink-0 text-xs text-[var(--color-text-muted)]"
                  }
                >
                  {i.status === "pending" ? "답변대기" : "답변완료"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
