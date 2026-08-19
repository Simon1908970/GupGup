"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Eye, MessageCircle } from "lucide-react";
import { CATEGORIES } from "@/lib/constants/categories";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { useAuth } from "@/lib/auth/AuthProvider";
import { fetchPostById, incrementViewCount } from "@/lib/supabase/posts";
import { createComment, fetchComments } from "@/lib/supabase/comments";
import type { CategorySlug, Comment, Post } from "@/lib/types";
import { formatCount, formatDate } from "@/lib/utils";
import { Avatar } from "@/components/common/Avatar";
import { CountryTag } from "@/components/common/CountryTag";
import { NicknamePopup } from "@/components/common/NicknamePopup";
import { CommentSection } from "@/components/board/CommentSection";

function isValidCategory(v: string): v is CategorySlug {
  return v in CATEGORIES;
}

export default function PostDetailPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const { user } = useAuth();
  const params = useParams<{ category: string; postId: string }>();
  const [showTranslation, setShowTranslation] = useState(false);
  const [post, setPost] = useState<Post | null | undefined>(undefined);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentDraft, setCommentDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const viewCounted = useRef(false);

  const categorySlug = params.category;
  const config = isValidCategory(categorySlug) ? CATEGORIES[categorySlug] : null;

  useEffect(() => {
    if (!config) return;
    let cancelled = false;
    fetchPostById(config.slug, params.postId).then((data) => {
      if (cancelled) return;
      setPost(data);
      if (data && !viewCounted.current) {
        viewCounted.current = true;
        incrementViewCount(data.id, data.viewCount);
      }
    });
    fetchComments(params.postId).then((data) => {
      if (!cancelled) setComments(data);
    });
    return () => {
      cancelled = true;
    };
  }, [config, params.postId]);

  if (!config || post === null) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center text-sm text-[var(--color-text-muted)]">
        게시글을 찾을 수 없습니다.
      </div>
    );
  }

  if (post === undefined) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center text-sm text-[var(--color-text-muted)]">
        {t("common.loading")}
      </div>
    );
  }

  // TODO: call a translation API here; showing a placeholder until wired up.
  const translatedBody = `[${t("post.translateView")}] ${post.body}`;

  async function handleCommentSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !commentDraft.trim() || !post) return;
    setPosting(true);
    try {
      await createComment(post.id, user.id, commentDraft.trim());
      const updated = await fetchComments(post.id);
      setComments(updated);
      setCommentDraft("");
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-3 flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
        {config.hasCountryTag && <CountryTag country={post.country} />}
        <span>{formatDate(post.createdAt)}</span>
        <span className="flex items-center gap-0.5">
          <Eye size={12} /> {formatCount(post.viewCount)}
        </span>
      </div>

      <h1 className="mb-4 text-lg font-bold leading-snug">{post.title}</h1>

      <div className="mb-5 flex items-center justify-between border-b border-[var(--color-border-gray-light)] pb-4">
        <div className="flex items-center gap-2">
          {config.hasAuthorAvatar && (
            <Avatar nickname={post.author.nickname} avatarUrl={post.author.avatarUrl} size={34} />
          )}
          {config.hasNicknamePopup ? (
            <NicknamePopup author={post.author} className="text-sm" />
          ) : (
            <span className="text-sm font-medium">{post.author.nickname}</span>
          )}
        </div>
        <button
          onClick={() => setShowTranslation((v) => !v)}
          className="rounded border border-[var(--color-border-gray)] px-2.5 py-1 text-xs text-[var(--color-text-muted)] hover:border-[var(--color-brand-red)] hover:text-[var(--color-brand-red)]"
        >
          {showTranslation ? t("post.originalView") : t("post.translateView")}
        </button>
      </div>

      <div className="min-h-32 whitespace-pre-wrap text-sm leading-relaxed">
        {showTranslation ? translatedBody : post.body}
      </div>

      {config.hasMessageButton && (
        <button
          onClick={() => router.push(`/messages/${post.author.id}`)}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-md bg-[var(--color-brand-red)] py-2.5 text-sm font-medium text-white"
        >
          <MessageCircle size={16} />
          {t("post.messageButton")}
        </button>
      )}

      <div className="mt-8 border-t border-[var(--color-border-gray-light)] pt-2">
        <h2 className="py-3 text-sm font-semibold">
          {t("board.comments")} {comments.length}
        </h2>
        <CommentSection comments={comments} />
        {user ? (
          <form
            onSubmit={handleCommentSubmit}
            className="mt-3 flex gap-2 border-t border-[var(--color-border-gray-light)] pt-3"
          >
            <input
              value={commentDraft}
              onChange={(e) => setCommentDraft(e.target.value)}
              placeholder="댓글을 입력하세요"
              className="h-9 flex-1 rounded-md border border-[var(--color-border-gray)] px-3 text-sm outline-none focus:border-[var(--color-brand-red)]"
            />
            <button
              disabled={posting}
              className="rounded-md bg-[var(--color-brand-red)] px-4 text-sm font-medium text-white disabled:opacity-50"
            >
              {t("common.submit")}
            </button>
          </form>
        ) : (
          <p className="mt-3 border-t border-[var(--color-border-gray-light)] pt-3 text-center text-xs text-[var(--color-text-muted)]">
            {t("auth.needVerification")}
          </p>
        )}
      </div>
    </div>
  );
}
