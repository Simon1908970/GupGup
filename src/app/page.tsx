"use client";

import { useEffect, useState } from "react";
import {
  CATEGORIES,
  CATEGORY_ORDER,
  GRID_BOX_CATEGORIES,
  LARGE_BOX_CATEGORIES,
} from "@/lib/constants/categories";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import type { DictionaryKey } from "@/lib/i18n/dictionaries";
import { fetchLatestPosts } from "@/lib/supabase/posts";
import type { CategorySlug, Post } from "@/lib/types";
import { CategoryBox } from "@/components/board/CategoryBox";

export default function Home() {
  const { t } = useLanguage();
  const [postsByCategory, setPostsByCategory] = useState<Record<CategorySlug, Post[]>>(
    {} as Record<CategorySlug, Post[]>,
  );

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      CATEGORY_ORDER.map((slug) =>
        fetchLatestPosts(slug, CATEGORIES[slug].mainCount)
          .then((posts) => [slug, posts] as const)
          .catch(() => [slug, []] as const),
      ),
    ).then((entries) => {
      if (cancelled) return;
      setPostsByCategory(Object.fromEntries(entries) as Record<CategorySlug, Post[]>);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {LARGE_BOX_CATEGORIES.map((slug) => (
          <CategoryBox
            key={slug}
            slug={slug}
            label={t(CATEGORIES[slug].labelKey as DictionaryKey)}
            moreLabel={t("board.viewMore")}
            posts={postsByCategory[slug] ?? []}
          />
        ))}
      </section>

      <section className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {GRID_BOX_CATEGORIES.map((slug) => (
          <CategoryBox
            key={slug}
            slug={slug}
            label={t(CATEGORIES[slug].labelKey as DictionaryKey)}
            moreLabel={t("board.viewMore")}
            posts={postsByCategory[slug] ?? []}
          />
        ))}
      </section>
    </div>
  );
}
