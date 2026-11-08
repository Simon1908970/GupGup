"use client";

import Link from "next/link";
import { CATEGORIES } from "@/lib/constants/categories";
import type { Post } from "@/lib/types";
import { formatCount, formatDate } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { Avatar } from "@/components/common/Avatar";
import { CountryFlag } from "@/components/common/CountryFlag";
import { DeleteButton } from "@/components/common/DeleteButton";
import { PinnedFormCard } from "@/components/board/PinnedFormCard";
import { MessageSquare, Eye, Pin, Lock } from "lucide-react";

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

  // "내 월급"/"내 생활비" 같은 고정 폼 글은 일반 글 줄이 아니라 눈에 띄는
  // 애니메이션 카드로 보여준다(요청서 2번) -- onDelete(글쓴이 본인 글 목록)
  // 쪽에서는 쓰이지 않으므로 신경 쓸 필요 없다.
  if (post.pinnedFormType) {
    return <PinnedFormCard post={post} />;
  }
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
            {config.hasCountryTag && <CountryFlag code={post.country} size={14} />}
            {post.isNotice && (
              <Pin
                size={14}
                aria-label={t("board.pinnedLabel")}
                className="shrink-0 rotate-45 fill-[var(--color-brand-red)] text-[var(--color-brand-red)]"
              />
            )}
            {post.membersOnly && (
              <Lock
                size={13}
                aria-label={t("board.membersOnlyLabel")}
                className="shrink-0 text-[var(--color-text-muted)]"
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
            <span>{post.category === "news" ? t("news.byline") : post.author.nickname}</span>
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
