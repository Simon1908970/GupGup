"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { useAuth } from "@/lib/auth/AuthProvider";
import { blockUser } from "@/lib/supabase/blocks";
import type { Author } from "@/lib/types";
import { cn } from "@/lib/utils";
import { COUNTRIES } from "@/lib/constants/countries";
import { ReportModal } from "@/components/common/ReportModal";

function flagEmoji(code?: Author["flagCountry"]): string | null {
  if (!code) return null;
  return COUNTRIES.find((c) => c.code === code)?.flag ?? null;
}

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
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const isSelf = user?.id === author.id;

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

  // 익명으로 올린 "내 월급"/"내 생활비" 카드 -- author.id가 실제 회원 id가
  // 아니라서 프로필 보기/쪽지/차단 중 아무것도 동작할 수 없다. 클릭해도 아무
  // 일도 일어나지 않는 평범한 텍스트로 보여준다(탈퇴 회원과 같은 처리).
  if (author.isAnonymousCard) {
    return (
      <span className={cn("text-[var(--color-text-muted)]", className)}>
        {flagEmoji(author.flagCountry) && <span className="mr-1">{flagEmoji(author.flagCountry)}</span>}
        {t("pinnedForm.anonymousNickname")}
      </span>
    );
  }

  return (
    <div className="relative inline-block" ref={rootRef}>
      <button
        type="button"
        onClick={() => (isSelf ? router.push("/profile") : setOpen((v) => !v))}
        className={cn("font-medium hover:underline", className)}
      >
        {flagEmoji(author.flagCountry) && <span className="mr-1">{flagEmoji(author.flagCountry)}</span>}
        {children ?? author.nickname}
      </button>

      {open && !isSelf && (
        <div className="absolute left-0 top-full z-40 mt-1 w-40 overflow-hidden rounded-md border border-[var(--color-border-gray)] bg-white shadow-lg gg-glossy">
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
            onClick={async () => {
              setOpen(false);
              if (!user) return;
              try {
                await blockUser(user.id, author.id);
                setBlocked(true);
              } catch {
                // already blocked or request failed; no UI change
              }
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
