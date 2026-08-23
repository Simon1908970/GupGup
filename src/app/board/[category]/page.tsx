"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { CATEGORIES } from "@/lib/constants/categories";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import type { DictionaryKey } from "@/lib/i18n/dictionaries";
import { fetchPosts } from "@/lib/supabase/posts";
import type { CategorySlug, CountryCode, Post, SortOrder } from "@/lib/types";
import { CategoryBadge } from "@/components/common/CategoryBadge";
import { CountryFilterChips } from "@/components/board/CountryFilterChips";
import { PostListItem } from "@/components/board/PostListItem";
import { Pagination } from "@/components/board/Pagination";
import { BoardSearchBar, type SearchScope } from "@/components/board/BoardSearchBar";
import { TranslateToggle } from "@/components/common/TranslateToggle";
import { useTitleTranslation } from "@/lib/hooks/useTitleTranslation";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;

function isValidCategory(v: string): v is CategorySlug {
  return v in CATEGORIES;
}

export default function BoardListPage() {
  const { t } = useLanguage();
  const params = useParams<{ category: string }>();
  const searchParams = useSearchParams();
  const categorySlug = params.category;

  const [subCategory, setSubCategory] = useState<string>("all");
  const [country, setCountry] = useState<CountryCode>("all");
  const [sort, setSort] = useState<SortOrder>("latest");
  const [page, setPage] = useState(1);
  const [searchScope, setSearchScope] = useState<SearchScope>("titleContent");
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") ?? "");

  const valid = isValidCategory(categorySlug);
  const config = valid ? CATEGORIES[categorySlug] : null;

  const [posts, setPosts] = useState<Post[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const { showTranslation, translating, translatedTitles, toggle } = useTitleTranslation(
    posts.map((p) => p.title),
  );

  useEffect(() => {
    if (!config) return;
    let cancelled = false;
    // Marks the in-flight fetch below as loading; setting this outside the
    // effect would require duplicating the same filter/sort/page deps.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    fetchPosts({
      category: config.slug,
      subCategory: subCategory === "all" ? undefined : subCategory,
      country: config.hasCountryTag ? country : undefined,
      sort,
      search: searchQuery.trim() || undefined,
      searchScope,
      page,
      pageSize: PAGE_SIZE,
    })
      .then(({ posts: rows, total: count }) => {
        if (cancelled) return;
        setPosts(rows);
        setTotal(count);
      })
      .catch(() => {
        if (!cancelled) {
          setPosts([]);
          setTotal(0);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [config, subCategory, country, sort, searchQuery, searchScope, page]);

  if (!config) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-16 text-center text-sm text-[var(--color-text-muted)]">
        {t("error.categoryNotFound")}
      </div>
    );
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CategoryBadge>{t(config.labelKey as DictionaryKey)}</CategoryBadge>
        </div>
        {config.slug !== "news" && (
          <Link
            href={`/board/${config.slug}/write`}
            className="gg-write-btn relative rounded-md bg-[var(--color-brand-red)] px-3 py-1 text-sm font-medium text-white gg-glossy-btn"
          >
            {t("board.write")}
          </Link>
        )}
      </div>

      {config.subCategories && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          <button
            onClick={() => {
              setSubCategory("all");
              setPage(1);
            }}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium",
              subCategory === "all"
                ? "border-[var(--foreground)] bg-[var(--foreground)] text-white"
                : "border-[var(--color-border-gray)]",
            )}
          >
            {t("common.all")}
          </button>
          {config.subCategories.map((sub) => (
            <button
              key={sub.slug}
              onClick={() => {
                setSubCategory(sub.slug);
                setPage(1);
              }}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium",
                subCategory === sub.slug
                  ? "border-[var(--foreground)] bg-[var(--foreground)] text-white"
                  : "border-[var(--color-border-gray)]",
              )}
            >
              {t(sub.labelKey as DictionaryKey)}
            </button>
          ))}
        </div>
      )}

      {config.subCategories && config.hasCountryTag && (
        <div className="mb-3 border-t border-[var(--color-border-gray-light)]" />
      )}

      {config.hasCountryTag && (
        <div className="mb-3">
          <CountryFilterChips
            value={country}
            onChange={(c) => {
              setCountry(c);
              setPage(1);
            }}
          />
        </div>
      )}

      <div className="mb-2 flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setSort("latest")}
            className={cn(
              "gg-sort-text rounded px-2 py-1 font-medium",
              sort === "latest" ? "text-[var(--color-brand-red)]" : "text-[var(--color-text-muted)]",
            )}
          >
            {t("sort.latest")}
          </button>
          <span className="text-[var(--color-border-gray)]">|</span>
          <button
            onClick={() => setSort("popular")}
            className={cn(
              "gg-sort-text rounded px-2 py-1 font-medium",
              sort === "popular" ? "text-[var(--color-brand-red)]" : "text-[var(--color-text-muted)]",
            )}
          >
            {t("sort.popular")}
          </button>
        </div>
        {posts.length > 0 && (
          <TranslateToggle showTranslation={showTranslation} translating={translating} onClick={toggle} />
        )}
      </div>

      <ul className="relative rounded-lg border border-[var(--color-border-gray)] px-3 gg-glossy">
        {config.slug === "housing" && (
          <li className="flex items-start gap-2 border-b border-[var(--color-border-gray-light)] bg-[var(--color-border-gray-light)]/40 px-1 py-3">
            <span className="mt-0.5 shrink-0 rounded bg-[var(--color-brand-red)] px-1.5 py-0.5 text-[10px] font-bold text-white">
              {t("housing.noticeLabel")}
            </span>
            <p className="text-xs leading-relaxed text-[var(--color-text-muted)]">
              {t("housing.noticeText")}
            </p>
          </li>
        )}
        {loading && (
          <li className="py-12 text-center text-sm text-[var(--color-text-muted)]">
            {t("common.loading")}
          </li>
        )}
        {!loading && posts.length === 0 && (
          <li className="py-12 text-center text-sm text-[var(--color-text-muted)]">
            {t("board.noPosts")}
          </li>
        )}
        {!loading &&
          posts.map((post, i) => (
            <PostListItem
              key={post.id}
              post={post}
              titleOverride={showTranslation && translatedTitles ? translatedTitles[i] : undefined}
            />
          ))}
      </ul>

      <div className="mt-5 flex flex-col items-center gap-4">
        <Pagination page={page} totalPages={totalPages} onChange={setPage} />
        <BoardSearchBar
          scope={searchScope}
          query={searchQuery}
          onSubmit={(scope, q) => {
            setSearchScope(scope);
            setSearchQuery(q);
            setPage(1);
          }}
        />
      </div>
    </div>
  );
}
