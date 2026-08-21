"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CATEGORY_ORDER, CATEGORIES } from "@/lib/constants/categories";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import type { DictionaryKey } from "@/lib/i18n/dictionaries";
import { cn } from "@/lib/utils";

export function CategoryNav() {
  const { t } = useLanguage();
  const pathname = usePathname();

  return (
    <nav className="w-full overflow-x-auto bg-[var(--color-brand-red)]">
      <ul className="mx-auto flex max-w-6xl min-w-max items-stretch px-2">
        {CATEGORY_ORDER.map((slug) => {
          const href = `/board/${slug}`;
          const active = pathname?.startsWith(href);
          return (
            <li key={slug}>
              <Link
                href={href}
                className={cn(
                  "flex h-11 items-center px-4 text-sm font-medium text-white/90 hover:bg-white/10",
                  active && "bg-white/15 font-semibold text-white",
                )}
              >
                {t(CATEGORIES[slug].labelKey as DictionaryKey)}
              </Link>
            </li>
          );
        })}
        <li>
          <Link
            href="/inquiries"
            className={cn(
              "flex h-11 items-center px-4 text-sm font-medium text-white/90 hover:bg-white/10",
              pathname?.startsWith("/inquiries") && "bg-white/15 font-semibold text-white",
            )}
          >
            {t("nav.inquiries")}
          </Link>
        </li>
      </ul>
    </nav>
  );
}
