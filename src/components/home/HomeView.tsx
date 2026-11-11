"use client";

import { useEffect, useState } from "react";
import {
  CATEGORIES,
  CATEGORY_ORDER,
  GRID_BOX_CATEGORIES,
  LARGE_BOX_CATEGORIES,
} from "@/lib/constants/categories";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import type { DictionaryKey } from "@/lib/i18n/dictionaries";
import { fetchLatestPosts, fetchPopularPosts } from "@/lib/supabase/posts";
import { fetchBlockedIds } from "@/lib/supabase/blocks";
import type { CategorySlug, Post } from "@/lib/types";
import { CategoryBox } from "@/components/board/CategoryBox";
import { PopularPostsWidget } from "@/components/board/PopularPostsWidget";
import { ExchangeRateTicker } from "@/components/board/ExchangeRateTicker";
import { CountryMapWidget } from "@/components/map/CountryMapWidget";
import { WelcomeToast } from "@/components/common/WelcomeToast";

const AUTH_GATED_CATEGORIES = CATEGORY_ORDER.filter((slug) => CATEGORIES[slug].requiresAuth);

interface HomeViewProps {
  initialPostsByCategory: Record<CategorySlug, Post[]>;
}

export function HomeView({ initialPostsByCategory }: HomeViewProps) {
  const { t } = useLanguage();
  const { user, loading: authLoading } = useAuth();
  const [postsByCategory, setPostsByCategory] =
    useState<Record<CategorySlug, Post[]>>(initialPostsByCategory);
  const [popularPosts, setPopularPosts] = useState<Post[]>([]);

  // 로그인 전 기본값으로 캐시된 서버 데이터에는 requiresAuth 카테고리("만남")가
  // 항상 빈 배열이고 차단한 사용자의 글도 그대로 섞여 있다. 둘 다 로그인한
  // 사용자 본인에 한해서만 클라이언트에서 보정한다.
  useEffect(() => {
    if (authLoading || !user) return;
    let cancelled = false;

    if (AUTH_GATED_CATEGORIES.length > 0) {
      Promise.all(
        AUTH_GATED_CATEGORIES.map((slug) =>
          fetchLatestPosts(slug, CATEGORIES[slug].mainCount)
            .then((posts) => [slug, posts] as const)
            .catch(() => [slug, []] as const),
        ),
      ).then((entries) => {
        if (cancelled) return;
        setPostsByCategory((prev) => ({ ...prev, ...Object.fromEntries(entries) }));
      });
    }

    fetchBlockedIds(user.id)
      .then((blockedIds) => {
        if (cancelled || blockedIds.length === 0) return;
        const blocked = new Set(blockedIds);
        setPostsByCategory((prev) => {
          const next = { ...prev } as Record<CategorySlug, Post[]>;
          for (const slug of Object.keys(next) as CategorySlug[]) {
            next[slug] = next[slug].filter((post) => !blocked.has(post.author.id));
          }
          return next;
        });
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [authLoading, user]);

  useEffect(() => {
    let cancelled = false;
    fetchPopularPosts(6, 30)
      .then((posts) => {
        if (!cancelled) setPopularPosts(posts);
      })
      .catch(() => {
        if (!cancelled) setPopularPosts([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <WelcomeToast />
      <ExchangeRateTicker />
      <CountryMapWidget compact />
      <PopularPostsWidget posts={popularPosts} />

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {LARGE_BOX_CATEGORIES.map((slug) => (
          <CategoryBox
            key={slug}
            slug={slug}
            label={t(CATEGORIES[slug].labelKey as DictionaryKey)}
            moreLabel={t("board.viewMore")}
            posts={postsByCategory[slug] ?? []}
            locked={CATEGORIES[slug].requiresAuth && !user}
            lockedLabel={t("board.loginRequired")}
          />
        ))}
      </section>

      <section className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {GRID_BOX_CATEGORIES.map((slug) => (
          <CategoryBox
            key={slug}
            slug={slug}
            label={t(CATEGORIES[slug].labelKey as DictionaryKey)}
            moreLabel={t("board.viewMore")}
            posts={postsByCategory[slug] ?? []}
            locked={CATEGORIES[slug].requiresAuth && !user}
            lockedLabel={t("board.loginRequired")}
          />
        ))}
      </section>
    </div>
  );
}
