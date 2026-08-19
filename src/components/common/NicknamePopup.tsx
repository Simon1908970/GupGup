"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import type { Author } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ReportModal } from "@/components/common/ReportModal";

export function NicknamePopup({
  author,
  className,
  children,
}: {
  author: Author;
  className?: string;
  children?: React.ReactNode;
}) {
  const { t } = useLanguage();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  if (author.isWithdrawn) {
    return (
      <span className={cn("text-[var(--color-text-muted)]", className)}>
        {t("post.withdrawnUser")}
      </span>
    );
  }

  return (
    <div className="relative inline-block" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn("font-medium hover:underline", className)}
      >
        {children ?? author.nickname}
      </button>

      {open && (
        <div className="absolute left-0 top-full z-40 mt-1 w-40 overflow-hidden rounded-md border border-[var(--color-border-gray)] bg-white shadow-lg">
          <Link
            href={`/profile/${author.id}`}
            className="block px-4 py-2 text-sm hover:bg-[var(--color-border-gray-light)]"
            onClick={() => setOpen(false)}
          >
            {t("post.viewProfile")}
          </Link>
          <button
            className="block w-full px-4 py-2 text-left text-sm hover:bg-[var(--color-border-gray-light)]"
            onClick={() => {
              setOpen(false);
              router.push(`/messages/${author.id}`);
            }}
          >
            {t("post.sendMessage")}
          </button>
          <button
            className="block w-full px-4 py-2 text-left text-sm hover:bg-[var(--color-border-gray-light)]"
            onClick={() => {
              setBlocked(true);
              setOpen(false);
              // TODO: insert into `blocks` table via Supabase once wired up.
            }}
          >
            {t("post.block")}
          </button>
          <button
            className="block w-full px-4 py-2 text-left text-sm text-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-light)]"
            onClick={() => {
              setOpen(false);
              setReportOpen(true);
            }}
          >
            {t("post.report")}
          </button>
        </div>
      )}

      {blocked && (
        <div className="absolute left-0 top-full z-40 mt-1 whitespace-nowrap rounded bg-[color:var(--foreground)] px-3 py-1.5 text-xs text-white">
          {author.nickname}
          {t("post.blockedSuffix")}
        </div>
      )}

      {reportOpen && (
        <ReportModal
          target={{ type: "user", id: author.id }}
          onClose={() => setReportOpen(false)}
        />
      )}
    </div>
  );
}
