"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CATEGORIES } from "@/lib/constants/categories";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import type { DictionaryKey } from "@/lib/i18n/dictionaries";
import { fetchPosts, fetchNotices } from "@/lib/supabase/posts";
import type { CategorySlug, CountryCode, Post, SortOrder } from "@/lib/types";
import { CategoryBadge } from "@/components/common/CategoryBadge";
import { CountryFilterChips } from "@/components/board/CountryFilterChips";
import { PostListItem } from "@/components/board/PostListItem";
import { Pagination } from "@/components/board/Pagination";
import { BoardSearchBar, type SearchScope } from "@/components/board/BoardSearchBar";
import { TranslateToggle } from "@/components/common/TranslateToggle";
import { useTitleTranslation } from "@/lib/hooks/useTitleTranslation";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;

function isValidCategory(v: string): v is CategorySlug {
  return v in CATEGORIES;
}

interface BoardListViewProps {
  category: string;
  // 서버(page.tsx)가 기본 필터(전체 국가·최신순·1페이지)로 미리 받아온
  // 글 목록. 로그인 게이트가 걸린 카테고리("만남")나 잘못된 카테고리에는
  // 아예 넘어오지 않는다 -- 그런 콘텐츠를 정적 캐시에 구워 넣으면 안 되므로
  // 서버는 거기선 fetch 자체를 하지 않는다. undefined면 종전처럼 클라이언트가
  // 첫 로딩부터 직접 가져온다.
  initialPosts?: Post[];
  initialNotices?: Post[];
  initialTotal?: number;
}

export function BoardListView(props: BoardListViewProps) {
  // 카테고리가 바뀌면(클라이언트 내비게이션 포함) 필터·목록 상태를 깨끗하게
  // 새로 시작하도록 key로 강제 리마운트한다 -- 그래야 이전 카테고리의 글이
  // 한 프레임이라도 잘못 보이는 일 없이, 새 카테고리의 서버 제공 초기
  // 데이터를 그대로 쓴다.
  return <BoardListViewInner key={props.category} {...props} />;
}

function BoardListViewInner({
  category: categorySlug,
  initialPosts,
  initialNotices,
  initialTotal,
}: BoardListViewProps) {
  const { t } = useLanguage();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [subCategory, setSubCategory] = useState<string>("all");
  const [country, setCountry] = useState<CountryCode>("all");
  const [sort, setSort] = useState<SortOrder>("latest");
  const [page, setPage] = useState(1);
  const [searchScope, setSearchScope] = useState<SearchScope>("titleContent");
  const [searchQuery, setSearchQuery] = useState("");

  // 헤더 검색창에서 ?q=로 들어온 검색어를 초기값으로 반영한다. 이 페이지는
  // 정적/ISR로 미리 구워지므로(요청마다 다른 쿼리스트링을 반영해 캐시를 구울
  // 수 없음) useSearchParams() 훅 대신 마운트 후 location에서 직접 읽는다 --
  // useSearchParams()를 쓰면 정적 렌더링 시점엔 가장 가까운 Suspense의
  // fallback만 구워져서 이 아래 글 목록 전체가 빈 HTML로 나가 버린다.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("q");
    // location은 React 바깥의 외부 상태라 동기화하려면 effect 안에서
    // setState가 불가피하다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (q) setSearchQuery(q);
  }, []);

  const valid = isValidCategory(categorySlug);
  const config = valid ? CATEGORIES[categorySlug] : null;
  const gated = Boolean(config?.requiresAuth);
  const hasServerData = initialPosts !== undefined;

  const [posts, setPosts] = useState<Post[]>(initialPosts ?? []);
  const [notices, setNotices] = useState<Post[]>(initialNotices ?? []);
  const [total, setTotal] = useState(initialTotal ?? 0);
  const [loading, setLoading] = useState(!hasServerData);
  const { showTranslation, translating, translatedTitles, toggle } = useTitleTranslation(
    posts.map((p) => p.title),
  );

  useEffect(() => {
    if (gated && !authLoading && !user) router.replace("/login");
  }, [gated, authLoading, user, router]);

  // 서버가 기본 필터(국가 전체·최신순·1페이지·검색어 없음) 글 목록을 이미
  // 내려줬다면 마운트 직후 같은 요청을 한 번 더 보낼 필요가 없다 -- 그
  // 경우에만 첫 실행을 건너뛴다. ?q= 로 들어와 검색어가 이미 채워진
  // 상태라면 서버가 준 건 검색 전 기본 목록이라 그대로는 못 쓰므로
  // 건너뛰지 않는다.
  const skippedInitialFetch = useRef(false);

  useEffect(() => {
    if (!config || (gated && !user)) return;
    if (
      !skippedInitialFetch.current &&
      hasServerData &&
      subCategory === "all" &&
      country === "all" &&
      sort === "latest" &&
      page === 1 &&
      !searchQuery.trim()
    ) {
      skippedInitialFetch.current = true;
      return;
    }
    skippedInitialFetch.current = true;
    let cancelled = false;
    // Marks the in-flight fetch below as loading; setting this outside the
    // effect would require duplicating the same filter/sort/page deps.
    setLoading(true);
    fetchPosts({
      category: config.slug,
      subCategory: subCategory === "all" ? undefined : subCategory,
      country: config.hasCountryTag ? country : undefined,
      sort,
      search: searchQuery.trim() || undefined,
      searchScope,
      page,
      pageSize: PAGE_SIZE,
    })
      .then(({ posts: rows, notices: noticeRows, total: count }) => {
        if (cancelled) return;
        setPosts(rows);
        setNotices(noticeRows);
        setTotal(count);
      })
      .catch(() => {
        if (!cancelled) {
          setPosts([]);
          setNotices([]);
          setTotal(0);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [config, gated, user, subCategory, country, sort, searchQuery, searchScope, page, hasServerData]);

  // 고정 글은 서버가 미리 구워준 게 있어도 항상 다시 확인한다 -- 다른
  // 카테고리에서 클릭으로 들어오면 Next.js가 캐시해 둔 예전 응답을 그대로
  // 쓸 수 있어서, 막 고정한 글이 "국가 필터를 한 번 건드려야" 보이는
  // 문제가 있었다(2026-11-09). 위의 본문 목록 효과와 달리 건너뛰지 않는다.
  useEffect(() => {
    if (!config || (gated && !user)) return;
    let cancelled = false;
    fetchNotices(config.slug, subCategory === "all" ? undefined : subCategory)
      .then((rows) => {
        if (!cancelled) setNotices(rows);
      })
      .catch(() => {
        /* 서버가 준 초기값(있다면)을 그대로 둔다 -- 조용히 실패 */
      });
    return () => {
      cancelled = true;
    };
  }, [config, gated, user, subCategory]);

  if (!config) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-16 text-center text-sm text-[var(--color-text-muted)]">
        {t("error.categoryNotFound")}
      </div>
    );
  }

  if (gated && !user) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-16 text-center text-sm text-[var(--color-text-muted)]">
        {t("common.loading")}
      </div>
    );
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CategoryBadge>{t(config.labelKey as DictionaryKey)}</CategoryBadge>
        </div>
        {config.slug !== "news" && (
          <Link
            href={`/board/${config.slug}/write`}
            className="gg-write-btn relative rounded-md bg-[var(--color-brand-red)] px-3 py-1 text-sm font-medium text-white gg-glossy-btn"
          >
            {t("board.write")}
          </Link>
        )}
      </div>

      {config.subCategories && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          <button
            onClick={() => {
              setSubCategory("all");
              setPage(1);
            }}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium",
              subCategory === "all"
                ? "border-[var(--foreground)] bg-[var(--foreground)] text-white"
                : "border-[var(--color-border-gray)]",
            )}
          >
            {t("common.all")}
          </button>
          {config.subCategories.map((sub) => (
            <button
              key={sub.slug}
              onClick={() => {
                setSubCategory(sub.slug);
                setPage(1);
              }}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium",
                subCategory === sub.slug
                  ? "border-[var(--foreground)] bg-[var(--foreground)] text-white"
                  : "border-[var(--color-border-gray)]",
              )}
            >
              {t(sub.labelKey as DictionaryKey)}
            </button>
          ))}
        </div>
      )}

      {config.subCategories && config.hasCountryTag && (
        <div className="mb-3 border-t border-[var(--color-border-gray-light)]" />
      )}

      {config.hasCountryTag && (
        <div className="mb-3">
          <CountryFilterChips
            value={country}
            onChange={(c) => {
              setCountry(c);
              setPage(1);
            }}
          />
        </div>
      )}

      <div className="mb-2 flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setSort("latest")}
            className={cn(
              "gg-sort-text rounded px-2 py-1 font-medium",
              sort === "latest" ? "text-[var(--color-brand-red)]" : "text-[var(--color-text-muted)]",
            )}
          >
            {t("sort.latest")}
          </button>
          <span className="text-[var(--color-border-gray)]">|</span>
          <button
            onClick={() => setSort("popular")}
            className={cn(
              "gg-sort-text rounded px-2 py-1 font-medium",
              sort === "popular" ? "text-[var(--color-brand-red)]" : "text-[var(--color-text-muted)]",
            )}
          >
            {t("sort.popular")}
          </button>
        </div>
        {posts.length > 0 && (
          <TranslateToggle showTranslation={showTranslation} translating={translating} onClick={toggle} />
        )}
      </div>

      <ul className="relative rounded-lg border border-[var(--color-border-gray)] px-3 gg-glossy">
        {config.slug === "housing" && (
          <li className="border-b border-[var(--color-border-gray-light)] bg-[var(--color-border-gray-light)]/40 px-1 py-3">
            {/* globals.css가 .font-bold에 사이트 전역으로 18px 제목용 글꼴을
                강제로 입히는데, 이 작은 배지는 거기서 빠져야 해서 font-bold
                대신 숫자로 직접 굵기만 지정한다(글자 크기는 text-[10px] 그대로
                적용되게). */}
            <span className="inline-block shrink-0 rounded bg-[var(--color-brand-red)] px-1.5 py-0.5 text-[10px] font-[700] text-white">
              {t("housing.noticeLabel")}
            </span>
            <p className="mt-1.5 text-xs leading-relaxed text-[var(--color-text-muted)]">
              {t("housing.noticeText")}
            </p>
          </li>
        )}
        {loading && (
          <li className="py-12 text-center text-sm text-[var(--color-text-muted)]">
            {t("common.loading")}
          </li>
        )}
        {!loading &&
          notices.map((post) => <PostListItem key={`notice-${post.id}`} post={post} />)}
        {!loading && posts.length === 0 && notices.length === 0 && (
          <li className="py-12 text-center text-sm text-[var(--color-text-muted)]">
            {t("board.noPosts")}
          </li>
        )}
        {!loading &&
          posts.map((post, i) => (
            <PostListItem
              key={post.id}
              post={post}
              titleOverride={showTranslation && translatedTitles ? translatedTitles[i] : undefined}
            />
          ))}
      </ul>

      <div className="mt-5 flex flex-col items-center gap-4">
        <Pagination page={page} totalPages={totalPages} onChange={setPage} />
        <BoardSearchBar
          scope={searchScope}
          query={searchQuery}
          onSubmit={(scope, q) => {
            setSearchScope(scope);
            setSearchQuery(q);
            setPage(1);
          }}
        />
      </div>
    </div>
  );
}
