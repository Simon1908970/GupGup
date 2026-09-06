import { createClient } from "@/lib/supabase/client";

export async function fetchLikedPostIds(userId: string, postIds: string[]): Promise<Set<string>> {
  if (postIds.length === 0) return new Set();
  const supabase = createClient();
  const { data, error } = await supabase
    .from("post_likes")
    .select("post_id")
    .eq("user_id", userId)
    .in("post_id", postIds);
  if (error) throw error;
  return new Set((data ?? []).map((row) => row.post_id));
}

export async function likePost(postId: string, userId: string) {
  const supabase = createClient();
  const { error } = await supabase.from("post_likes").insert({ post_id: postId, user_id: userId });
  // Duplicate like (already liked, e.g. double-click) is not an error the UI needs to see.
  if (error && error.code !== "23505") throw error;
}

export async function unlikePost(postId: string, userId: string) {
  const supabase = createClient();
  const { error } = await supabase
    .from("post_likes")
    .delete()
    .eq("post_id", postId)
    .eq("user_id", userId);
  if (error) throw error;
}
