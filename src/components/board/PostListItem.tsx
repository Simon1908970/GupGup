"use client";

import Link from "next/link";
import { CATEGORIES } from "@/lib/constants/categories";
import type { Post } from "@/lib/types";
import { formatCount, formatDate } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { Avatar } from "@/components/common/Avatar";
import { CountryTag } from "@/components/common/CountryTag";
import { MessageSquare, Eye } from "lucide-react";

export function PostListItem({
  post,
  onDelete,
  titleOverride,
}: {
  post: Post;
  onDelete?: () => void;
  titleOverride?: string;
}) {
  const { t } = useLanguage();
  const config = CATEGORIES[post.category];

  return (
    <li className="flex items-center border-b border-[var(--color-border-gray-light)] last:border-b-0">
      <Link
        href={`/board/${post.category}/${post.id}`}
        className="flex min-w-0 flex-1 items-center gap-3 px-1 py-3 hover:bg-[var(--color-border-gray-light)]/60"
      >
        {config.hasAuthorAvatar && (
          <Avatar
            nickname={post.author.nickname}
            avatarUrl={post.author.avatarUrl}
            size={36}
            className="mt-0.5"
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {config.hasCountryTag && <CountryTag country={post.country} />}
            <p className="truncate text-sm font-medium text-[var(--foreground)]">
              {titleOverride ?? post.title}
            </p>
            {post.commentCount > 0 && (
              <span className="shrink-0 text-xs font-semibold text-[var(--color-brand-red)]">
                {post.commentCount}
              </span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[var(--color-text-muted)]">
            <span>{post.author.nickname}</span>
            <span>·</span>
            <span>{formatDate(post.createdAt)}</span>
            <span className="flex items-center gap-0.5">
              <Eye size={12} /> {formatCount(post.viewCount)}
            </span>
            <span className="flex items-center gap-0.5">
              <MessageSquare size={12} /> {formatCount(post.commentCount)}
            </span>
          </div>
        </div>
        {post.thumbnailUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.thumbnailUrl}
            alt=""
            className="h-14 w-14 shrink-0 rounded object-cover"
          />
        )}
      </Link>
      {onDelete && (
        <button
          onClick={onDelete}
          className="shrink-0 px-3 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-brand-red)]"
        >
          {t("common.delete")}
        </button>
      )}
    </li>
  );
}
