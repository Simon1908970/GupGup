"use client";

import { CATEGORIES, GRID_BOX_CATEGORIES, LARGE_BOX_CATEGORIES } from "@/lib/constants/categories";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import type { DictionaryKey } from "@/lib/i18n/dictionaries";
import { getPostsForCategory } from "@/lib/mock/posts";
import { CategoryBox } from "@/components/board/CategoryBox";

export default function Home() {
  const { t } = useLanguage();

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {LARGE_BOX_CATEGORIES.map((slug) => (
          <CategoryBox
            key={slug}
            slug={slug}
            label={t(CATEGORIES[slug].labelKey as DictionaryKey)}
            moreLabel={t("board.viewMore")}
            posts={getPostsForCategory(slug)}
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
            posts={getPostsForCategory(slug)}
          />
        ))}
      </section>
    </div>
  );
}
