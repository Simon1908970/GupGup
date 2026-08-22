"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { CATEGORY_ORDER, CATEGORIES } from "@/lib/constants/categories";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import type { DictionaryKey } from "@/lib/i18n/dictionaries";
import { cn } from "@/lib/utils";

const MOBILE_VISIBLE_COUNT = 4;

export function CategoryNav() {
  const { t } = useLanguage();
  const pathname = usePathname();
  const [expanded, setExpanded] = useState(false);

  const visibleSlugs = CATEGORY_ORDER.slice(0, MOBILE_VISIBLE_COUNT);
  const hiddenSlugs = CATEGORY_ORDER.slice(MOBILE_VISIBLE_COUNT);

  function linkClass(active: boolean) {
    return cn(
      "flex h-11 items-center px-4 text-sm font-medium text-white/90 hover:bg-white/10",
      active && "bg-white/15 font-semibold text-white",
    );
  }

  return (
    <>
      {/* Desktop / tablet: unchanged, single scrollable row */}
      <nav className="relative hidden w-full overflow-x-auto bg-[var(--color-brand-red)] gg-glossy-bar sm:block">
        <ul className="mx-auto flex max-w-6xl min-w-max items-stretch px-2">
          {CATEGORY_ORDER.map((slug) => {
            const href = `/board/${slug}`;
            return (
              <li key={slug}>
                <Link href={href} className={linkClass(!!pathname?.startsWith(href))}>
                  {t(CATEGORIES[slug].labelKey as DictionaryKey)}
                </Link>
              </li>
            );
          })}
          <li>
            <Link href="/inquiries" className={linkClass(!!pathname?.startsWith("/inquiries"))}>
              {t("nav.inquiries")}
            </Link>
          </li>
        </ul>
      </nav>

      {/* Mobile: first few categories + a dropdown for the rest */}
      <nav className="relative w-full bg-[var(--color-brand-red)] gg-glossy-bar sm:hidden">
        <ul className="flex items-stretch px-2">
          {visibleSlugs.map((slug) => {
            const href = `/board/${slug}`;
            return (
              <li key={slug} className="min-w-0 flex-1">
                <Link href={href} className={cn(linkClass(!!pathname?.startsWith(href)), "justify-center truncate px-2")}>
                  {t(CATEGORIES[slug].labelKey as DictionaryKey)}
                </Link>
              </li>
            );
          })}
          <li className="shrink-0">
            <button
              type="button"
              aria-label="카테고리 더보기"
              onClick={() => setExpanded((v) => !v)}
              className={cn(
                "flex h-11 items-center px-3 text-white/90 hover:bg-white/10",
                expanded && "bg-white/15 text-white",
              )}
            >
              <ChevronDown size={18} className={cn("transition-transform", expanded && "rotate-180")} />
            </button>
          </li>
        </ul>
        {expanded && (
          <ul className="border-t border-white/15 bg-[var(--color-brand-red)]">
            {hiddenSlugs.map((slug) => {
              const href = `/board/${slug}`;
              return (
                <li key={slug}>
                  <Link
                    href={href}
                    onClick={() => setExpanded(false)}
                    className={linkClass(!!pathname?.startsWith(href))}
                  >
                    {t(CATEGORIES[slug].labelKey as DictionaryKey)}
                  </Link>
                </li>
              );
            })}
            <li>
              <Link
                href="/inquiries"
                onClick={() => setExpanded(false)}
                className={linkClass(!!pathname?.startsWith("/inquiries"))}
              >
                {t("nav.inquiries")}
              </Link>
            </li>
          </ul>
        )}
      </nav>
    </>
  );
}
