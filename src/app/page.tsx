import { CATEGORIES, CATEGORY_ORDER } from "@/lib/constants/categories";
import { fetchLatestPosts } from "@/lib/supabase/posts";
import type { CategorySlug, Post } from "@/lib/types";
import { HomeView } from "@/components/home/HomeView";

// 로그인 여부와 무관하게 모두에게 같은 글 목록을 보여주는 카테고리들이라
// 빌드/재검증 시점에 서버에서 미리 데이터를 채워 넣는다 -- 그래야 크롤러가
// 받는 첫 HTML에도 글 목록이 그대로 들어있다. requiresAuth 카테고리("만남")는
// 로그인한 사람에게만 보여줘야 해서 여기서는 항상 비워 두고, 실제 글 목록은
// HomeView가 클라이언트에서 로그인 확인 후 채운다.
export const revalidate = 60;

export default async function Home() {
  const entries = await Promise.all(
    CATEGORY_ORDER.map(async (slug) => {
      if (CATEGORIES[slug].requiresAuth) return [slug, []] as const;
      try {
        const posts = await fetchLatestPosts(slug, CATEGORIES[slug].mainCount);
        return [slug, posts] as const;
      } catch {
        return [slug, []] as const;
      }
    }),
  );
  const postsByCategory = Object.fromEntries(entries) as Record<CategorySlug, Post[]>;

  return <HomeView initialPostsByCategory={postsByCategory} />;
}
