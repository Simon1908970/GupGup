"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { fetchInquiries, type InquiryRow } from "@/lib/supabase/inquiries";
import { cn } from "@/lib/utils";

export default function InquiriesPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const { user, loading } = useAuth();
  const [inquiries, setInquiries] = useState<InquiryRow[]>([]);
  const [loadingInquiries, setLoadingInquiries] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    fetchInquiries(user.id)
      .then(setInquiries)
      .finally(() => setLoadingInquiries(false));
  }, [user]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-bold">{t("inquiries.title")}</h1>
        <Link
          href="/inquiries/new"
          className="relative rounded-md bg-[var(--color-brand-red)] px-4 py-1.5 text-sm font-medium text-white gg-glossy-btn"
        >
          {t("inquiries.new")}
        </Link>
      </div>

      {loadingInquiries ? (
        <p className="py-16 text-center text-sm text-[var(--color-text-muted)]">
          {t("common.loading")}
        </p>
      ) : inquiries.length === 0 ? (
        <p className="py-16 text-center text-sm text-[var(--color-text-muted)]">
          {t("inquiries.empty")}
        </p>
      ) : (
        <ul className="relative divide-y divide-[var(--color-border-gray-light)] rounded-lg border border-[var(--color-border-gray)] gg-glossy">
          {inquiries.map((inq) => (
            <li key={inq.id}>
              <Link
                href={`/inquiries/${inq.id}`}
                className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-[var(--color-border-gray-light)]/60"
              >
                <span className="truncate text-sm font-medium">{inq.title}</span>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
                    inq.status === "answered"
                      ? "bg-[var(--color-badge-yellow)] text-black"
                      : "bg-[var(--color-border-gray-light)] text-[var(--color-text-muted)]",
                  )}
                >
                  {inq.status === "answered" ? t("inquiries.answered") : t("inquiries.pending")}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
