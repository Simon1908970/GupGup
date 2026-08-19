import { createClient } from "@/lib/supabase/client";
import type { Comment, CountryCode } from "@/lib/types";

interface CommentRow {
  id: string;
  post_id: string;
  parent_id: string | null;
  body: string;
  created_at: string;
  author_id: string;
  author: {
    id: string;
    nickname: string;
    country: CountryCode;
    avatar_url: string | null;
    is_withdrawn: boolean;
  } | null;
}

const COMMENT_SELECT =
  "id, post_id, parent_id, body, created_at, author_id, author:profiles(id, nickname, country, avatar_url, is_withdrawn)";

function mapComment(row: CommentRow): Comment {
  return {
    id: row.id,
    postId: row.post_id,
    parentId: row.parent_id ?? undefined,
    body: row.body,
    createdAt: row.created_at,
    author: row.author
      ? {
          id: row.author.id,
          nickname: row.author.nickname,
          country: row.author.country,
          avatarUrl: row.author.avatar_url ?? undefined,
          isWithdrawn: row.author.is_withdrawn,
        }
      : { id: row.author_id, nickname: "알 수 없음", country: "etc" },
  };
}

export async function fetchComments(postId: string): Promise<Comment[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("comments")
    .select(COMMENT_SELECT)
    .eq("post_id", postId)
    .order("created_at", { ascending: true });
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
  });
  if (error) throw error;
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
