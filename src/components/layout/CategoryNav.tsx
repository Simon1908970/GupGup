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

  function linkClass(active: boolean) {
    return cn(
      "gg-nav-link flex h-11 shrink-0 items-center whitespace-nowrap px-3 text-xs font-medium text-white/90 hover:bg-white/10 sm:px-4 sm:text-sm",
      active && "bg-white/15 font-semibold text-white",
    );
  }

  return (
    <nav className="relative w-full overflow-x-auto bg-[var(--color-brand-red)] gg-glossy-bar">
      <ul className="mx-auto flex max-w-6xl min-w-max items-stretch px-2">
        <li>
          <Link href="/" className={linkClass(pathname === "/")}>
            <span className="gg-nav-label">{t("nav.home")}</span>
          </Link>
        </li>
        {CATEGORY_ORDER.map((slug) => {
          const href = `/board/${slug}`;
          return (
            <li key={slug}>
              <Link href={href} className={linkClass(!!pathname?.startsWith(href))}>
                <span className="gg-nav-label">{t(CATEGORIES[slug].labelKey as DictionaryKey)}</span>
              </Link>
            </li>
          );
        })}
        <li>
          <Link href="/map" className={linkClass(!!pathname?.startsWith("/map"))}>
            <span className="gg-nav-label">{t("nav.map")}</span>
          </Link>
        </li>
        <li>
          <Link href="/inquiries" className={linkClass(!!pathname?.startsWith("/inquiries"))}>
            <span className="gg-nav-label">{t("nav.inquiries")}</span>
          </Link>
        </li>
      </ul>
    </nav>
  );
}
