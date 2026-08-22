"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Star, User } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { Avatar } from "@/components/common/Avatar";
import { PointsInfo } from "@/components/common/PointsInfo";

export function UserMenu() {
  const { t } = useLanguage();
  const { user, profile, unreadCount, signOut } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
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

  if (!user) {
    return (
      <>
        <Link
          href="/login"
          aria-label={t("header.login")}
          className="flex shrink-0 items-center p-1 text-[var(--foreground)] sm:hidden"
        >
          <User size={22} />
        </Link>
        <Link
          href="/login"
          className="relative hidden h-10 shrink-0 items-center rounded-md bg-[var(--color-brand-red)] px-4 text-sm font-medium text-white gg-glossy-btn sm:flex"
        >
          {t("header.login")}
        </Link>
      </>
    );
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-10 shrink-0 items-center gap-2 rounded-md px-2 hover:bg-[var(--color-border-gray-light)]"
      >
        <Avatar nickname={profile?.nickname ?? "?"} avatarUrl={profile?.avatar_url ?? undefined} size={26} />
        <span className="max-w-[6rem] truncate text-sm font-medium">
          {profile?.nickname ?? t("header.myInfo")}
        </span>
        {unreadCount > 0 && (
          <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--color-badge-yellow)] px-1 text-[10px] font-bold text-black">
            {unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-40 mt-1 w-44 rounded-md border border-[var(--color-border-gray)] bg-white shadow-lg gg-glossy">
          <div className="flex items-center gap-1.5 border-b border-[var(--color-border-gray-light)] px-4 py-2 text-sm">
            <Star size={14} className="fill-[var(--color-badge-yellow)] text-[var(--color-badge-yellow)]" />
            <span className="text-[var(--color-text-muted)]">{t("profile.points")}</span>
            <PointsInfo align="right" />
            <span className="ml-auto font-semibold">{profile?.points ?? 0}</span>
          </div>
          <Link
            href="/profile"
            className="block px-4 py-2 text-sm hover:bg-[var(--color-border-gray-light)]"
            onClick={() => setOpen(false)}
          >
            {t("header.myProfile")}
          </Link>
          <Link
            href="/messages"
            className="block px-4 py-2 text-sm hover:bg-[var(--color-border-gray-light)]"
            onClick={() => setOpen(false)}
          >
            {t("header.messages")}
          </Link>
          <Link
            href="/inquiries"
            className="block px-4 py-2 text-sm hover:bg-[var(--color-border-gray-light)]"
            onClick={() => setOpen(false)}
          >
            {t("header.inquiries")}
          </Link>
          <button
            onClick={async () => {
              setOpen(false);
              await signOut();
              router.push("/");
              router.refresh();
            }}
            className="block w-full rounded-b-md border-t border-[var(--color-border-gray-light)] px-4 py-2 text-left text-sm text-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-light)]"
          >
            {t("header.logout")}
          </button>
        </div>
      )}
    </div>
  );
}
