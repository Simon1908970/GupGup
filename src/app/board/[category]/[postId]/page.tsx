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
    const post = await fetchPostById(categorySlug, postId);
    // 이 서버 쪽 조회는 로그인 세션이 없는(사실상 비로그인) 컨텍스트라서,
    // members_only 글은 RLS에 걸려 실제로 존재해도 null로 돌아온다 -- 그걸
    // 그대로 "글이 없음"으로 굳혀 버리면 로그인한 회원한테까지 영원히
    // "게시글을 찾을 수 없습니다"가 뜬다(2026-11-09에 "내 월급"/"내 생활비"를
    // members_only로 바꾸면서 발견). null이면 undefined로 넘겨서, 클라이언트가
    // 본인 로그인 세션으로 다시 확인하고 진짜 없는 글인지 판단하게 한다.
    initialPost = post ?? undefined;
    // "내 월급"/"내 생활비" 같은 고정 폼 글의 최상위 댓글("카드")은 익명일
    // 수 있는데, 일반 fetchComments()는 댓글마다 실제 작성자 프로필을
    // 조인해서 가져온다 -- 그 결과를 여기서 정적/ISR HTML에 그대로 구워
    // 넣으면 "익명"으로 올린 사람의 실제 닉네임이 캐시된 HTML에 영원히
    // 남는다. 그런 글은 초기 댓글 없이 넘기고, 클라이언트(PinnedFormSection)
    // 가 익명 처리된 뷰로 따로, 안전하게 가져오게 한다.
    if (post && !post.pinnedFormType) {
      initialComments = await fetchComments(postId);
    }
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
