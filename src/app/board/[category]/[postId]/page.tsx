import { CATEGORIES } from "@/lib/constants/categories";
import { fetchPostById } from "@/lib/supabase/posts";
import { fetchComments } from "@/lib/supabase/comments";
import type { CategorySlug, Comment, Post } from "@/lib/types";
import { PostDetailView } from "@/components/board/PostDetailView";

function isValidCategory(v: string): v is CategorySlug {
  return v in CATEGORIES;
}

// 게시글 하나하나가 검색에 걸려야 하는 핵심 콘텐츠라서, 첫 방문 시 서버에서
// 미리 받아와 크롤러가 받는 첫 HTML에도 본문·댓글이 그대로 들어있게 한다.
// generateStaticParams 없이 ISR만 쓰므로 처음 요청이 온 글만 그때 한 번
// 정적으로 구워지고(글 수가 계속 늘어나 빌드 시점에 전부 미리 만들 수 없음),
// 이후 같은 경로는 60초 동안 캐시에서 그대로 나간다.
export const revalidate = 60;

export default async function PostDetailPage({
  params,
}: {
  params: Promise<{ category: string; postId: string }>;
}) {
  const { category: categorySlug, postId } = await params;

  if (!isValidCategory(categorySlug) || CATEGORIES[categorySlug].requiresAuth) {
    // 잘못된 카테고리이거나 로그인 게이트가 걸린 카테고리("만남")는 서버에서
    // 미리 캐시해 두면 안 되므로 초기 데이터 없이 넘기고, 404 안내/로그인
    // 리다이렉트는 그대로 클라이언트 쪽 로직에 맡긴다.
    return <PostDetailView category={categorySlug} postId={postId} />;
  }

  let initialPost: Post | null | undefined;
  let initialComments: Comment[] | undefined;
  try {
    const [post, comments] = await Promise.all([
      fetchPostById(categorySlug, postId),
      fetchComments(postId),
    ]);
    initialPost = post;
    initialComments = comments;
  } catch {
    // 일시적인 조회 실패를 "존재하지 않는 글"로 오판하면 안 되므로, 이때는
    // 초기 데이터 없이 넘겨 클라이언트가 다시 가져오게 한다.
    initialPost = undefined;
    initialComments = undefined;
  }

  return (
    <PostDetailView
      category={categorySlug}
      postId={postId}
      initialPost={initialPost}
      initialComments={initialComments}
    />
  );
}
