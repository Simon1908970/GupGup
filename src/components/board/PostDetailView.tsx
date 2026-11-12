"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Eye, Lock, MessageCircle } from "lucide-react";
import { CATEGORIES } from "@/lib/constants/categories";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { useAuth } from "@/lib/auth/AuthProvider";
import { fetchPostById, incrementViewCount } from "@/lib/supabase/posts";
import { fetchLikedPostIds } from "@/lib/supabase/likes";
import { createComment, fetchComments } from "@/lib/supabase/comments";
import { fetchBlockedIds } from "@/lib/supabase/blocks";
import { isHttpUrl } from "@/lib/news/newsInput";
import { useProfanityCheck } from "@/lib/moderation/useProfanityCheck";
import type { CategorySlug, Comment, Post } from "@/lib/types";
import { formatCount, formatDate } from "@/lib/utils";
import { Avatar } from "@/components/common/Avatar";
import { CountryTag } from "@/components/common/CountryTag";
import { NicknamePopup } from "@/components/common/NicknamePopup";
import { CommentSection } from "@/components/board/CommentSection";
import { PostBody } from "@/components/board/PostBody";
import { TranslateToggle } from "@/components/common/TranslateToggle";
import { LikeButton } from "@/components/common/LikeButton";
import { FirstPostPointsModal } from "@/components/common/FirstPostPointsModal";
import { PinnedFormSection } from "@/components/board/PinnedFormSection";

function isValidCategory(v: string): v is CategorySlug {
  return v in CATEGORIES;
}

interface PostDetailViewProps {
  category: string;
  postId: string;
  // 서버(page.tsx)가 미리 가져온 글/댓글. 로그인 게이트가 걸린 카테고리나
  // 잘못된 카테고리, 서버 쪽 조회가 실패한 경우에는 넘어오지 않는다 --
  // 그때는 종전처럼 클라이언트가 직접 가져온다. initialPost가 null이면
  // "존재하지 않는 글"이 서버에서 이미 확인된 것이다.
  initialPost?: Post | null;
  initialComments?: Comment[];
}

export function PostDetailView({
  category: categorySlug,
  postId,
  initialPost,
  initialComments,
}: PostDetailViewProps) {
  const { t, locale } = useLanguage();
  const router = useRouter();
  const { user, loading: authLoading, refreshProfile } = useAuth();
  const hasServerData = initialPost !== undefined;
  const [post, setPost] = useState<Post | null | undefined>(initialPost);
  const [comments, setComments] = useState<Comment[]>(initialComments ?? []);
  const [commentDraft, setCommentDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const hasCommentProfanity = useProfanityCheck(commentDraft);
  const viewCounted = useRef(false);
  const [showTranslation, setShowTranslation] = useState(false);
  const [translated, setTranslated] = useState<{
    locale: string;
    title: string;
    body: string;
  } | null>(null);
  const [translating, setTranslating] = useState(false);

  const config = isValidCategory(categorySlug) ? CATEGORIES[categorySlug] : null;
  const gated = Boolean(config?.requiresAuth);

  useEffect(() => {
    if (gated && !authLoading && !user) router.replace("/login");
  }, [gated, authLoading, user, router]);

  useEffect(() => {
    if (!config || (gated && !user)) return;
    if (hasServerData) return;
    let cancelled = false;
    fetchPostById(config.slug, postId).then((data) => {
      if (cancelled) return;
      setPost(data);
      // "내 월급"/"내 생활비" 글의 카드는 익명일 수 있어서, 실제 작성자를
      // 그대로 조인하는 일반 fetchComments()를 이 글에는 아예 호출하지
      // 않는다(PinnedFormSection이 익명 처리된 뷰로 따로 가져간다) --
      // 안 그러면 네트워크 응답에 실제 닉네임이 그대로 찍혀 나간다.
      if (data?.pinnedFormType) return;
      fetchComments(postId).then((comments) => {
        if (!cancelled) setComments(comments);
      });
    });
    return () => {
      cancelled = true;
    };
  }, [config, gated, user, postId, hasServerData]);

  // 조회수는 데이터 출처(서버 선제공/클라이언트 조회)와 무관하게 실제로
  // 화면에 글이 뜬 세션마다 딱 한 번만 올린다.
  useEffect(() => {
    if (post && !viewCounted.current) {
      viewCounted.current = true;
      incrementViewCount(post.id);
    }
  }, [post]);

  // 좋아요 여부와 댓글 차단 필터링은 보는 사람마다 달라서 정적/ISR로 미리
  // 구운 기본 데이터에는 반영할 수 없다(항상 비로그인 기준). 로그인한
  // 사용자에 한해 마운트 후 보정한다.
  useEffect(() => {
    if (authLoading || !user || !post) return;
    let cancelled = false;
    Promise.all([
      fetchBlockedIds(user.id).catch(() => [] as string[]),
      fetchLikedPostIds(user.id, [post.id]).catch(() => new Set<string>()),
    ]).then(([blockedIds, likedIds]) => {
      if (cancelled) return;
      if (blockedIds.length > 0) {
        const blocked = new Set(blockedIds);
        setComments((prev) => prev.filter((c) => !blocked.has(c.author.id)));
      }
      if (likedIds.has(post.id)) {
        setPost((prev) => (prev ? { ...prev, likedByViewer: true } : prev));
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, post?.id]);

  if (!config || post === null) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center text-sm text-[var(--color-text-muted)]">
        {t("error.postNotFound")}
      </div>
    );
  }

  if (gated && !user) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center text-sm text-[var(--color-text-muted)]">
        {t("common.loading")}
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

  // A cached translation is only valid for the locale it was fetched in;
  // switching languages must force a re-fetch on the next toggle.
  const showTranslated = showTranslation && translated?.locale === locale;

  async function handleToggleTranslate() {
    if (!post) return;
    if (showTranslated) {
      setShowTranslation(false);
      return;
    }
    if (translated && translated.locale === locale) {
      setShowTranslation(true);
      return;
    }
    setTranslating(true);
    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texts: [post.title, post.body], target: locale }),
      });
      const data = await res.json();
      if (!res.ok || !data.translations) throw new Error(data.error ?? "translate failed");
      setTranslated({ locale, title: data.translations[0], body: data.translations[1] });
      setShowTranslation(true);
    } catch {
      // leave original text shown if translation fails
    } finally {
      setTranslating(false);
    }
  }

  async function handleCommentSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !commentDraft.trim() || !post || hasCommentProfanity) return;
    setPosting(true);
    try {
      await createComment(post.id, user.id, commentDraft.trim());
      const updated = await fetchComments(post.id);
      setComments(updated);
      setCommentDraft("");
      await refreshProfile();
    } finally {
      setPosting(false);
    }
  }

  async function handleReplySubmit(parentId: string, body: string) {
    if (!user || !post) return;
    await createComment(post.id, user.id, body, parentId);
    const updated = await fetchComments(post.id);
    setComments(updated);
    await refreshProfile();
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <FirstPostPointsModal post={post} />
      <div className="mb-3 flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
        {config.hasCountryTag && <CountryTag country={post.country} />}
        {post.membersOnly && (
          <span className="flex items-center gap-0.5">
            <Lock size={12} /> {t("board.membersOnlyLabel")}
          </span>
        )}
        <span>{formatDate(post.createdAt)}</span>
        <span className="flex items-center gap-0.5">
          <Eye size={12} /> {formatCount(post.viewCount)}
        </span>
      </div>

      <h1 className="mb-4 break-words text-lg font-bold leading-snug">
        {showTranslated && translated ? translated.title : post.title}
      </h1>

      <div className="mb-5 flex items-center justify-between border-b border-[var(--color-border-gray-light)] pb-4">
        <div className="flex items-center gap-2">
          {config.hasAuthorAvatar && (
            <Avatar nickname={post.author.nickname} avatarUrl={post.author.avatarUrl} size={34} />
          )}
          {config.hasNicknamePopup ? (
            <NicknamePopup author={post.author} className="text-sm" />
          ) : (
            <span className="text-sm font-medium">
              {config.slug === "news" ? t("news.byline") : post.author.nickname}
            </span>
          )}
        </div>
        <TranslateToggle
          showTranslation={showTranslated}
          translating={translating}
          onClick={handleToggleTranslate}
        />
      </div>

      {!post.pinnedFormType && post.attachments.length > 0 && (
        <ul className="mb-4 flex flex-col gap-3">
          {post.attachments.map((a) => (
            <li key={a.url}>
              {a.type === "image" ? (
                <a href={a.url} target="_blank" rel="noopener noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={a.url}
                    alt=""
                    className="max-h-[300px] w-auto max-w-full cursor-zoom-in rounded-lg border border-[var(--color-border-gray-light)] transition hover:opacity-90"
                  />
                </a>
              ) : (
                <video
                  src={a.url}
                  controls
                  preload="metadata"
                  className="max-h-[300px] w-full rounded-lg"
                />
              )}
            </li>
          ))}
        </ul>
      )}

      {post.pinnedFormType ? null : config.slug === "news" && post.originalBody ? (
        <div className="text-sm leading-relaxed text-gray-700">
          {post.thumbnailUrl && (
            <figure className="mb-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={post.thumbnailUrl}
                alt=""
                className="w-full rounded-lg object-cover"
              />
              {post.imageCredit && (
                <figcaption className="mt-1 text-[11px] text-[var(--color-text-muted)]">
                  {post.imageCredit}
                </figcaption>
              )}
            </figure>
          )}
          <p className="mb-1 text-xs font-semibold text-[var(--color-text-muted)]">
            {t("news.originalLabel")}
          </p>
          <div lang={post.originalLang} className="whitespace-pre-wrap break-words">
            {post.originalBody}
          </div>
          {post.sourceName && post.sourceUrl && isHttpUrl(post.sourceUrl) && (
            <p className="mt-2 text-xs text-[var(--color-text-muted)]">
              {t("news.sourceLabel")}:{" "}
              <a
                href={post.sourceUrl}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="underline hover:text-[var(--color-brand-red)]"
              >
                {post.sourceName}
              </a>
            </p>
          )}
          <div className="my-4 border-t border-[var(--color-border-gray-light)]" />
          <p className="mb-1 text-xs font-semibold text-[var(--color-text-muted)]">
            {t("news.summaryLabel")}
          </p>
          <div className="whitespace-pre-wrap break-words">
            {showTranslated && translated ? translated.body : post.body}
          </div>
        </div>
      ) : (
        <PostBody
          displayText={showTranslated && translated ? translated.body : post.body}
          rawBody={post.body}
        />
      )}

      {!post.pinnedFormType && (
        <div className="mt-5">
          <LikeButton
            key={`${post.id}-${post.likedByViewer}`}
            postId={post.id}
            initialLiked={post.likedByViewer}
            initialCount={post.likeCount}
          />
        </div>
      )}

      {!post.pinnedFormType && config.hasMessageButton && (
        <button
          onClick={() => router.push(`/messages/${post.author.id}`)}
          className="relative mt-6 flex w-full items-center justify-center gap-2 rounded-md bg-[var(--color-brand-red)] py-2.5 text-sm font-medium text-white gg-glossy-btn"
        >
          <MessageCircle size={16} />
          {t("post.messageButton")}
        </button>
      )}

      {post.pinnedFormType ? (
        <div className="mt-6">
          <PinnedFormSection post={post} />
        </div>
      ) : (
        <div className="mt-8 border-t border-[var(--color-border-gray-light)] pt-2">
          <h2 className="py-3 text-sm font-semibold">
            {t("board.comments")} {comments.length}
          </h2>
          <CommentSection comments={comments} onReply={handleReplySubmit} />
          {user ? (
            <div className="mt-3 border-t border-[var(--color-border-gray-light)] pt-3">
              {hasCommentProfanity && (
                <p className="mb-2 text-xs text-[var(--color-brand-red)]">
                  {t("moderation.profanityWarning")}
                </p>
              )}
              <form onSubmit={handleCommentSubmit} className="flex gap-2">
                <input
                  value={commentDraft}
                  onChange={(e) => setCommentDraft(e.target.value)}
                  placeholder={t("board.commentPlaceholder")}
                  className="h-9 flex-1 rounded-md border border-[var(--color-border-gray)] px-3 text-sm outline-none focus:border-[var(--color-brand-red)]"
                />
                <button
                  disabled={posting || hasCommentProfanity}
                  className="relative rounded-md bg-[var(--color-brand-red)] px-4 text-sm font-medium text-white disabled:opacity-50 gg-glossy-btn"
                >
                  {t("common.submit")}
                </button>
              </form>
            </div>
          ) : (
            <p className="mt-3 border-t border-[var(--color-border-gray-light)] pt-3 text-center text-xs text-[var(--color-text-muted)]">
              {t("auth.needVerification")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
