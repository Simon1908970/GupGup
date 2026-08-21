"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import type { DictionaryKey } from "@/lib/i18n/dictionaries";
import {
  commentHasReplies,
  deleteComment,
  fetchCommentsByAuthor,
  type CommentWithPost,
} from "@/lib/supabase/comments";
import { CATEGORIES } from "@/lib/constants/categories";
import { COMMENT_REWARD } from "@/lib/constants/points";
import { formatDate } from "@/lib/utils";
import { ConfirmModal } from "@/components/common/ConfirmModal";

export default function MyCommentsPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const { user, loading, refreshProfile } = useAuth();
  const [comments, setComments] = useState<CommentWithPost[] | null>(null);
  const [pendingDelete, setPendingDelete] = useState<CommentWithPost | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    fetchCommentsByAuthor(user.id).then(setComments);
  }, [user]);

  async function handleConfirmDelete() {
    if (!user || !pendingDelete) return;
    const comment = pendingDelete;
    setPendingDelete(null);
    const hasReplies = await commentHasReplies(comment.id);
    await deleteComment(comment.id, user.id, hasReplies);
    setComments((prev) =>
      hasReplies
        ? prev?.map((c) => (c.id === comment.id ? { ...c, isDeleted: true } : c)) ?? null
        : prev?.filter((c) => c.id !== comment.id) ?? null,
    );
    await refreshProfile();
  }

  if (loading || !user || comments === null) {
    return <div className="px-4 py-16 text-center text-sm text-[var(--color-text-muted)]">{t("common.loading")}</div>;
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-4 text-lg font-bold">{t("profile.myComments")}</h1>
      <ul className="rounded-lg border border-[var(--color-border-gray)] px-3">
        {comments.length === 0 && (
          <li className="py-8 text-center text-sm text-[var(--color-text-muted)]">
            {t("board.noComments")}
          </li>
        )}
        {comments.map((c) => (
          <li
            key={c.id}
            className="flex items-center gap-3 border-b border-[var(--color-border-gray-light)] py-3 last:border-b-0"
          >
            <Link href={`/board/${c.postCategory}/${c.postId}`} className="min-w-0 flex-1">
              <p className="truncate text-xs text-[var(--color-text-muted)]">
                {t(CATEGORIES[c.postCategory].labelKey as DictionaryKey)} · {c.postTitle}
              </p>
              <p className="mt-0.5 truncate text-sm">
                {c.isDeleted ? t("board.commentDeleted") : c.body}
              </p>
              <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">{formatDate(c.createdAt)}</p>
            </Link>
            {!c.isDeleted && (
              <button
                onClick={() => setPendingDelete(c)}
                className="shrink-0 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-brand-red)]"
              >
                {t("common.delete")}
              </button>
            )}
          </li>
        ))}
      </ul>
      {pendingDelete && (
        <ConfirmModal
          message={`${t("points.deleteConfirmMessage")} (-${COMMENT_REWARD}P)\n${t("post.deleteConfirm")}`}
          onConfirm={handleConfirmDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
}
