"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { CATEGORIES } from "@/lib/constants/categories";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import type { DictionaryKey } from "@/lib/i18n/dictionaries";
import { getPostsForCategory } from "@/lib/mock/posts";
import type { CategorySlug, CountryCode, SortOrder } from "@/lib/types";
import { CategoryBadge } from "@/components/common/CategoryBadge";
import { CountryFilterChips } from "@/components/board/CountryFilterChips";
import { PostListItem } from "@/components/board/PostListItem";
import { Pagination } from "@/components/board/Pagination";
import { BoardSearchBar, type SearchScope } from "@/components/board/BoardSearchBar";
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

  const filtered = useMemo(() => {
    if (!config) return [];
    let posts = getPostsForCategory(config.slug);

    if (subCategory !== "all") {
      posts = posts.filter((p) => p.subCategory === subCategory);
    }
    if (config.hasCountryTag && country !== "all") {
      posts = posts.filter((p) => p.country === country);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      posts = posts.filter((p) => {
        if (searchScope === "author") return p.author.nickname.toLowerCase().includes(q);
        if (searchScope === "title") return p.title.toLowerCase().includes(q);
        return (
          p.title.toLowerCase().includes(q) || p.body.toLowerCase().includes(q)
        );
      });
    }

    posts = [...posts].sort((a, b) => {
      if (sort === "popular") {
        return b.viewCount + b.commentCount * 3 - (a.viewCount + a.commentCount * 3);
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return posts;
  }, [config, subCategory, country, sort, searchQuery, searchScope]);

  if (!config) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-16 text-center text-sm text-[var(--color-text-muted)]">
        존재하지 않는 카테고리입니다.
      </div>
    );
  }

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CategoryBadge>{t(config.labelKey as DictionaryKey)}</CategoryBadge>
        </div>
        {config.slug !== "news" && (
          <Link
            href={`/board/${config.slug}/write`}
            className="rounded-md bg-[var(--color-brand-red)] px-4 py-1.5 text-sm font-medium text-white"
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

      <div className="mb-2 flex items-center gap-1.5 text-xs">
        <button
          onClick={() => setSort("latest")}
          className={cn(
            "rounded px-2 py-1 font-medium",
            sort === "latest" ? "text-[var(--color-brand-red)]" : "text-[var(--color-text-muted)]",
          )}
        >
          {t("sort.latest")}
        </button>
        <span className="text-[var(--color-border-gray)]">|</span>
        <button
          onClick={() => setSort("popular")}
          className={cn(
            "rounded px-2 py-1 font-medium",
            sort === "popular" ? "text-[var(--color-brand-red)]" : "text-[var(--color-text-muted)]",
          )}
        >
          {t("sort.popular")}
        </button>
      </div>

      <ul className="rounded-lg border border-[var(--color-border-gray)] px-3">
        {paged.length === 0 && (
          <li className="py-12 text-center text-sm text-[var(--color-text-muted)]">
            {t("board.noPosts")}
          </li>
        )}
        {paged.map((post) => (
          <PostListItem key={post.id} post={post} />
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
