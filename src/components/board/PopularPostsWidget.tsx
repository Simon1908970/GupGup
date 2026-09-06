"use client";

import Link from "next/link";
import { Flame, Heart, MessageSquare } from "lucide-react";
import { CATEGORIES } from "@/lib/constants/categories";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import type { DictionaryKey } from "@/lib/i18n/dictionaries";
import type { Post } from "@/lib/types";
import { formatCount, formatDate, getPostThumbnail } from "@/lib/utils";
import { CategoryBadge } from "@/components/common/CategoryBadge";

export function PopularPostsWidget({ posts }: { posts: Post[] }) {
  const { t } = useLanguage();

  if (posts.length === 0) return null;

  return (
    <div className="relative mb-4 rounded-lg border border-[var(--color-border-gray)] bg-white gg-glossy-interactive">
      <div className="flex items-center justify-between border-b border-[var(--color-border-gray-light)] px-4 py-3">
        <span className="flex items-center gap-1.5 text-sm font-bold">
          <Flame size={16} className="text-[var(--color-brand-red)]" />
          {t("popular.title")}
        </span>
        <span className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
          {t("popular.period30d")}
          <Link href="/popular" className="font-medium hover:text-[var(--color-brand-red)]">
            {t("board.viewMore")}
          </Link>
        </span>
      </div>
      {/* Mobile: horizontal scroll cards */}
      <ul className="flex snap-x gap-3 overflow-x-auto px-4 py-3 sm:hidden">
        {posts.map((post, i) => {
          const thumbnail = getPostThumbnail(post);
          return (
            <li key={post.id} className="w-32 shrink-0 snap-start">
              <Link href={`/board/${post.category}/${post.id}`} className="block">
                <div className="relative h-20 w-32 overflow-hidden rounded-md bg-[var(--color-border-gray-light)]">
                  {thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumbnail} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <CategoryBadge>{t(CATEGORIES[post.category].labelKey as DictionaryKey)}</CategoryBadge>
                    </div>
                  )}
                  <span className="absolute left-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--foreground)] text-[11px] font-bold text-white">
                    {i + 1}
                  </span>
                </div>
                <p className="mt-1.5 line-clamp-2 text-xs font-medium leading-snug">{post.title}</p>
                <div className="mt-1 flex items-center gap-2 text-[10px] text-[var(--color-text-muted)]">
                  <span className="flex items-center gap-0.5">
                    <MessageSquare size={10} /> {formatCount(post.commentCount)}
                  </span>
                  <span className="flex items-center gap-0.5">
                    <Heart size={10} /> {formatCount(post.likeCount)}
                  </span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>

      {/* Desktop / tablet: ranked list */}
      <ul className="hidden divide-y divide-[var(--color-border-gray-light)] px-4 sm:block">
        {posts.map((post, i) => {
          const thumbnail = getPostThumbnail(post);
          return (
            <li key={post.id}>
              <Link
                href={`/board/${post.category}/${post.id}`}
                className="flex items-center gap-3 py-2.5 hover:bg-[var(--color-border-gray-light)]/60"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--foreground)] text-xs font-bold text-white">
                  {i + 1}
                </span>
                {thumbnail && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={thumbnail}
                    alt=""
                    className="h-10 w-10 shrink-0 rounded object-cover"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <CategoryBadge className="shrink-0">
                      {t(CATEGORIES[post.category].labelKey as DictionaryKey)}
                    </CategoryBadge>
                    <span className="min-w-0 flex-1 truncate text-sm">{post.title}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-xs text-[var(--color-text-muted)]">
                    <span className="flex items-center gap-0.5">
                      <MessageSquare size={12} /> {formatCount(post.commentCount)}
                    </span>
                    <span className="flex items-center gap-0.5">
                      <Heart size={12} /> {formatCount(post.likeCount)}
                    </span>
                    <span>{formatDate(post.createdAt)}</span>
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
