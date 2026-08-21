"use client";

import Link from "next/link";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { cn } from "@/lib/utils";

export function AuthTabs({ active }: { active: "login" | "signup" }) {
  const { t } = useLanguage();

  return (
    <div className="flex rounded-md bg-[var(--color-border-gray-light)] p-1">
      <Link
        href="/login"
        className={cn(
          "flex-1 rounded-md py-2 text-center text-sm font-medium",
          active === "login"
            ? "bg-white text-[var(--foreground)] shadow-sm"
            : "text-[var(--color-text-muted)]",
        )}
      >
        {t("auth.login")}
      </Link>
      <Link
        href="/signup"
        className={cn(
          "flex-1 rounded-md py-2 text-center text-sm font-medium",
          active === "signup"
            ? "bg-white text-[var(--foreground)] shadow-sm"
            : "text-[var(--color-text-muted)]",
        )}
      >
        {t("auth.signup")}
      </Link>
    </div>
  );
}
