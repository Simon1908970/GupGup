"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { CATEGORY_ORDER, CATEGORIES } from "@/lib/constants/categories";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import type { DictionaryKey } from "@/lib/i18n/dictionaries";
import { cn } from "@/lib/utils";

interface NavItem {
  key: string;
  href: string;
  labelKey: DictionaryKey;
  active: boolean;
}

// Below this many px from an edge, treat the scroller as "at" that edge and
// hide its shadow hint (avoids flicker from sub-pixel scroll rounding).
const EDGE_THRESHOLD = 4;

export function CategoryNav() {
  const { t } = useLanguage();
  const pathname = usePathname();
  const scrollRef = useRef<HTMLDivElement>(null);
  const linkRefs = useRef(new Map<string, HTMLAnchorElement>());
  const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(null);
  const [edgeShadow, setEdgeShadow] = useState({ left: false, right: false });

  const items: NavItem[] = useMemo(() => {
    const list: NavItem[] = [
      { key: "home", href: "/", labelKey: "nav.home", active: pathname === "/" },
    ];
    for (const slug of CATEGORY_ORDER) {
      const href = `/board/${slug}`;
      list.push({
        key: slug,
        href,
        labelKey: CATEGORIES[slug].labelKey as DictionaryKey,
        active: !!pathname?.startsWith(href),
      });
    }
    list.push({ key: "map", href: "/map", labelKey: "nav.map", active: !!pathname?.startsWith("/map") });
    list.push({
      key: "inquiries",
      href: "/inquiries",
      labelKey: "nav.inquiries",
      active: !!pathname?.startsWith("/inquiries"),
    });
    return list;
  }, [pathname]);

  const activeKey = items.find((item) => item.active)?.key ?? null;

  // Slide the underline to the active tab, and show/hide each edge's scroll
  // shadow, whenever the route (or the label text under it, via a language
  // switch) changes -- and keep both aligned on scroll and viewport resize.
  // Measuring in a layout effect means the indicator never visibly "flies
  // in" from 0 on first paint.
  useLayoutEffect(() => {
    const scrollEl = scrollRef.current;
    if (!scrollEl) return;

    function measureIndicator() {
      const el = activeKey ? linkRefs.current.get(activeKey) : null;
      setIndicator(el ? { left: el.offsetLeft, width: el.offsetWidth } : null);
    }

    // An arrow function expression (not a nested function declaration) so TS
    // keeps the non-null narrowing of scrollEl from the guard above.
    const measureEdges = () => {
      const maxScroll = scrollEl.scrollWidth - scrollEl.clientWidth;
      setEdgeShadow({
        left: scrollEl.scrollLeft > EDGE_THRESHOLD,
        right: scrollEl.scrollLeft < maxScroll - EDGE_THRESHOLD,
      });
    };

    measureIndicator();
    measureEdges();

    function handleResize() {
      measureIndicator();
      measureEdges();
    }

    scrollEl.addEventListener("scroll", measureEdges, { passive: true });
    window.addEventListener("resize", handleResize);
    return () => {
      scrollEl.removeEventListener("scroll", measureEdges);
      window.removeEventListener("resize", handleResize);
    };
  }, [activeKey, t]);

  function linkClass(active: boolean) {
    return cn(
      "flex h-11 shrink-0 items-center whitespace-nowrap px-3 text-xs font-medium text-white/90 transition-colors hover:bg-white/10 sm:px-4 sm:text-sm",
      active && "bg-white/15 font-semibold text-white",
    );
  }

  return (
    <nav className="gg-glossy-bar relative w-full bg-[var(--color-brand-red)]">
      <div ref={scrollRef} className="w-full overflow-x-auto">
        <ul className="relative mx-auto flex max-w-6xl min-w-max items-stretch px-2">
          {items.map((item) => (
            <li key={item.key}>
              <Link
                href={item.href}
                ref={(el) => {
                  if (el) linkRefs.current.set(item.key, el);
                  else linkRefs.current.delete(item.key);
                }}
                className={linkClass(item.active)}
              >
                {t(item.labelKey)}
              </Link>
            </li>
          ))}
          <span
            aria-hidden
            className="pointer-events-none absolute bottom-0 h-[3px] rounded-full bg-white transition-all duration-300 ease-out"
            style={{
              left: indicator?.left ?? 0,
              width: indicator?.width ?? 0,
              opacity: indicator ? 1 : 0,
            }}
          />
        </ul>
      </div>
      {/* Edge scroll-shadow hints: fade in/out to signal there are more
          tabs off-screen in that direction, and hide once fully scrolled
          to that edge. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-black/25 to-transparent transition-opacity duration-200"
        style={{ opacity: edgeShadow.left ? 1 : 0 }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-black/25 to-transparent transition-opacity duration-200"
        style={{ opacity: edgeShadow.right ? 1 : 0 }}
      />
    </nav>
  );
}
