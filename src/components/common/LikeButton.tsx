"use client";

import { useState } from "react";
import { Heart } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { likePost, unlikePost } from "@/lib/supabase/likes";
import { cn, formatCount } from "@/lib/utils";

export function LikeButton({
  postId,
  initialLiked,
  initialCount,
}: {
  postId: string;
  initialLiked: boolean;
  initialCount: number;
}) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [pending, setPending] = useState(false);

  async function handleClick() {
    if (!user || pending) return;
    setPending(true);
    const next = !liked;
    setLiked(next);
    setCount((c) => c + (next ? 1 : -1));
    try {
      if (next) await likePost(postId, user.id);
      else await unlikePost(postId, user.id);
    } catch {
      setLiked(!next);
      setCount((c) => c + (next ? -1 : 1));
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={!user || pending}
      aria-label={t("post.like")}
      title={!user ? t("auth.needVerification") : undefined}
      className={cn(
        "relative flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
        liked
          ? "border-[var(--color-brand-red)] bg-[var(--color-brand-red-light)] text-[var(--color-brand-red)]"
          : "border-[var(--color-border-gray)] text-[var(--color-text-muted)] hover:border-[var(--color-brand-red)] hover:text-[var(--color-brand-red)]",
        !user && "cursor-not-allowed opacity-60",
      )}
    >
      <Heart size={16} fill={liked ? "currentColor" : "none"} />
      {formatCount(count)}
    </button>
  );
}
