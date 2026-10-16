"use client";

import Link from "next/link";
import { CATEGORIES } from "@/lib/constants/categories";
import type { Post } from "@/lib/types";
import { formatCount, formatDate } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { Avatar } from "@/components/common/Avatar";
import { CountryTag } from "@/components/common/CountryTag";
import { SupporterBadge } from "@/components/common/SupporterBadge";
import { DeleteButton } from "@/components/common/DeleteButton";
import { MessageSquare, Eye, Pin } from "lucide-react";

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
  const thumbnail =
    post.thumbnailUrl ?? post.attachments.find((a) => a.type === "image")?.url;

  return (
    <li
      className={
        "flex items-center border-b border-[var(--color-border-gray-light)] last:border-b-0" +
        (post.isNotice ? " bg-[var(--color-brand-red-light)]" : "")
      }
    >
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
            {post.isNotice && (
              <Pin
                size={14}
                aria-label={t("board.pinnedLabel")}
                className="shrink-0 rotate-45 fill-[var(--color-brand-red)] text-[var(--color-brand-red)]"
              />
            )}
            <p
              className={
                "truncate text-sm text-[var(--foreground)] " + (post.isNotice ? "font-bold" : "font-medium")
              }
            >
              {titleOverride ?? post.title}
            </p>
            {post.commentCount > 0 && (
              <span className="shrink-0 text-xs font-semibold text-[var(--color-brand-red)]">
                {post.commentCount}
              </span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[var(--color-text-muted)]">
            <span>
              {post.category === "news" ? t("news.byline") : post.author.nickname}
              {post.category !== "news" && post.author.isSupporter && <SupporterBadge />}
            </span>
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
        {thumbnail && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbnail}
            alt=""
            className="h-14 w-14 shrink-0 rounded object-cover"
          />
        )}
      </Link>
      {onDelete && (
        <div className="mr-2 flex shrink-0 items-center gap-1.5">
          <Link
            href={`/board/${post.category}/${post.id}/edit`}
            className="rounded border border-[var(--color-border-gray)] px-2 py-1 text-xs font-medium text-[var(--color-text-muted)] hover:border-[var(--foreground)] hover:text-[var(--foreground)]"
          >
            {t("common.edit")}
          </Link>
          <DeleteButton onClick={onDelete} />
        </div>
      )}
    </li>
  );
}
