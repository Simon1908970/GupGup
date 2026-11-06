import { CATEGORIES, CATEGORY_ORDER } from "@/lib/constants/categories";
import { fetchPosts } from "@/lib/supabase/posts";
import type { CategorySlug } from "@/lib/types";
import { BoardListView } from "@/components/board/BoardListView";

const PAGE_SIZE = 20;

function isValidCategory(v: string): v is CategorySlug {
  return v in CATEGORIES;
}

// 기본 필터(국가 전체·최신순·1페이지) 글 목록을 빌드/재검증 시점에 서버에서
// 미리 받아와 크롤러가 받는 첫 HTML에도 글 목록이 그대로 들어있게 한다.
export const revalidate = 60;

export function generateStaticParams() {
  return CATEGORY_ORDER.map((category) => ({ category }));
}

export default async function BoardListPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category: categorySlug } = await params;

  if (!isValidCategory(categorySlug) || CATEGORIES[categorySlug].requiresAuth) {
    // 잘못된 카테고리이거나 로그인 게이트가 걸린 카테고리("만남")는 서버에서
    // 미리 캐시해 두면 안 되므로(게이트 콘텐츠가 비로그인 사용자에게 새어나갈
    // 수 있음) 초기 데이터 없이 넘기고, 404 안내/로그인 리다이렉트는 그대로
    // 클라이언트 쪽 로직에 맡긴다.
    return <BoardListView category={categorySlug} />;
  }

  const { posts, notices, total } = await fetchPosts({
    category: categorySlug,
    sort: "latest",
    page: 1,
    pageSize: PAGE_SIZE,
  }).catch(() => ({ posts: [], notices: [], total: 0 }));

  return (
    <BoardListView
      category={categorySlug}
      initialPosts={posts}
      initialNotices={notices}
      initialTotal={total}
    />
  );
}
