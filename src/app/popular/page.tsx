"use client";

import { useEffect, useState } from "react";
import { Flame } from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { fetchPopularPosts } from "@/lib/supabase/posts";
import type { Post } from "@/lib/types";
import { PostListItem } from "@/components/board/PostListItem";

const LIMIT = 30;

export default function PopularPostsPage() {
  const { t } = useLanguage();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchPopularPosts(LIMIT, 30)
      .then((data) => {
        if (!cancelled) setPosts(data);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="mb-4 flex items-center gap-1.5 text-lg font-bold">
        <Flame size={18} className="text-[var(--color-brand-red)]" />
        {t("popular.title")}
        <span className="text-xs font-normal text-[var(--color-text-muted)]">
          ({t("popular.period30d")})
        </span>
      </h1>
      <ul className="rounded-lg border border-[var(--color-border-gray)] px-3">
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
        {!loading && posts.map((post) => <PostListItem key={post.id} post={post} />)}
      </ul>
    </div>
  );
}
