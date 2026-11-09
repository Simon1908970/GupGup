import { createClient } from "@/lib/supabase/client";
import type { CategorySlug, Comment, CountryCode } from "@/lib/types";
import { COMMENT_REWARD } from "@/lib/constants/points";
import { fetchBlockedIds } from "@/lib/supabase/blocks";

interface CommentRow {
  id: string;
  post_id: string;
  parent_id: string | null;
  body: string;
  created_at: string;
  author_id: string;
  is_deleted: boolean;
  author: {
    id: string;
    nickname: string;
    country: CountryCode;
    avatar_url: string | null;
    is_withdrawn: boolean;
    is_supporter: boolean;
  } | null;
}

const COMMENT_SELECT =
  "id, post_id, parent_id, body, created_at, author_id, is_deleted, author:profiles(id, nickname, country, avatar_url, is_withdrawn, is_supporter)";

function mapComment(row: CommentRow): Comment {
  return {
    id: row.id,
    postId: row.post_id,
    parentId: row.parent_id ?? undefined,
    body: row.body,
    createdAt: row.created_at,
    isDeleted: row.is_deleted,
    author: row.author
      ? {
          id: row.author.id,
          nickname: row.author.nickname,
          country: row.author.country,
          avatarUrl: row.author.avatar_url ?? undefined,
          isWithdrawn: row.author.is_withdrawn,
          isSupporter: row.author.is_supporter,
        }
      : { id: row.author_id, nickname: "알 수 없음", country: "etc" },
  };
}

export async function fetchComments(
  postId: string,
  options?: { repliesOnly?: boolean },
): Promise<Comment[]> {
  const supabase = createClient();
  const {
    data: { user: viewer },
  } = await supabase.auth.getUser();
  const blockedIds = viewer ? await fetchBlockedIds(viewer.id) : [];

  let query = supabase
    .from("comments")
    .select(COMMENT_SELECT)
    .eq("post_id", postId)
    .order("created_at", { ascending: true });
  // 고정 폼 글(월급/생활비)의 "카드"는 익명일 수 있는 최상위 댓글이라, 그
  // 작성자 정보가 이 일반 조회(author:profiles 조인)로 새 나가면 안 된다 --
  // 그런 글에서는 답글만 이 함수로 가져오고, 카드 자체는
  // lib/supabase/pinnedFormEntries.ts의 익명 처리된 뷰로 따로 가져온다.
  if (options?.repliesOnly) {
    query = query.not("parent_id", "is", null);
  }
  if (blockedIds.length > 0) {
    query = query.not("author_id", "in", `(${blockedIds.join(",")})`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((row) => mapComment(row as unknown as CommentRow));
}

export async function createComment(
  postId: string,
  authorId: string,
  body: string,
  parentId?: string,
) {
  const supabase = createClient();
  const { error } = await supabase.from("comments").insert({
    post_id: postId,
    author_id: authorId,
    body,
    parent_id: parentId ?? null,
    points_awarded: COMMENT_REWARD,
  });
  if (error) throw error;
  await supabase.rpc("adjust_points", { delta: COMMENT_REWARD });
}

export async function deleteComment(
  commentId: string,
  authorId: string,
  hasReplies: boolean,
) {
  const supabase = createClient();
  // 보통 댓글은 항상 COMMENT_REWARD만큼 받지만, "내 월급"/"내 생활비" 카드는
  // 더 많이 받는다(PINNED_FORM_CARD_REWARD) -- 삭제할 때 실제로 그 댓글이
  // 받았던 만큼 그대로 돌려줘야 해서, 고정값 대신 저장된 points_awarded를
  // 조회해서 쓴다.
  const { data: existing } = await supabase
    .from("comments")
    .select("points_awarded")
    .eq("id", commentId)
    .eq("author_id", authorId)
    .maybeSingle();
  const pointsToReclaim = existing?.points_awarded ?? COMMENT_REWARD;

  if (hasReplies) {
    const { error } = await supabase
      .from("comments")
      .update({ is_deleted: true })
      .eq("id", commentId)
      .eq("author_id", authorId);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("comments")
      .delete()
      .eq("id", commentId)
      .eq("author_id", authorId);
    if (error) throw error;
  }
  await supabase.rpc("adjust_points", { delta: -pointsToReclaim });
}

export interface CommentWithPost extends Comment {
  postTitle: string;
  postCategory: CategorySlug;
}

interface CommentWithPostRow extends CommentRow {
  post: { id: string; title: string; category: CategorySlug } | null;
}

export async function fetchCommentsByAuthor(authorId: string): Promise<CommentWithPost[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("comments")
    .select(`${COMMENT_SELECT}, post:posts(id, title, category)`)
    .eq("author_id", authorId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => {
    const typed = row as unknown as CommentWithPostRow;
    return {
      ...mapComment(typed),
      postTitle: typed.post?.title ?? "",
      postCategory: typed.post?.category ?? "community",
    };
  });
}

export async function commentHasReplies(commentId: string): Promise<boolean> {
  const supabase = createClient();
  const { count, error } = await supabase
    .from("comments")
    .select("id", { count: "exact", head: true })
    .eq("parent_id", commentId);
  if (error) throw error;
  return (count ?? 0) > 0;
}

export async function fetchCommentCountByAuthor(authorId: string): Promise<number> {
  const supabase = createClient();
  const { count, error } = await supabase
    .from("comments")
    .select("id", { count: "exact", head: true })
    .eq("author_id", authorId);
  if (error) throw error;
  return count ?? 0;
}
