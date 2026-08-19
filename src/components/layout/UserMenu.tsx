"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { Avatar } from "@/components/common/Avatar";

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
      <Link
        href="/login"
        className="flex h-10 shrink-0 items-center rounded-md bg-[var(--color-brand-red)] px-4 text-sm font-medium text-white"
      >
        {t("header.login")}
      </Link>
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
        <div className="absolute right-0 top-full z-40 mt-1 w-44 overflow-hidden rounded-md border border-[var(--color-border-gray)] bg-white shadow-lg">
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
            className="block w-full border-t border-[var(--color-border-gray-light)] px-4 py-2 text-left text-sm text-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-light)]"
          >
            {t("header.logout")}
          </button>
        </div>
      )}
    </div>
  );
}
