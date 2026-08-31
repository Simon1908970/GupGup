import { createClient } from "@/lib/supabase/client";
import type { CategorySlug, CountryCode, Post, SortOrder } from "@/lib/types";
import type { SearchScope } from "@/components/board/BoardSearchBar";
import { isPremiumPostTarget, POST_REWARD, PREMIUM_POST_COST } from "@/lib/constants/points";
import { fetchBlockedIds } from "@/lib/supabase/blocks";

interface PostRow {
  id: string;
  category: CategorySlug;
  sub_category: string | null;
  country: CountryCode;
  title: string;
  body: string;
  author_id: string;
  thumbnail_url: string | null;
  original_body: string | null;
  original_lang: string | null;
  source_name: string | null;
  source_url: string | null;
  image_credit: string | null;
  view_count: number;
  created_at: string;
  points_awarded: number;
  author: {
    id: string;
    nickname: string;
    country: CountryCode;
    avatar_url: string | null;
    is_withdrawn: boolean;
  } | null;
  comments: { count: number }[];
}

const POST_SELECT =
  "id, category, sub_category, country, title, body, author_id, thumbnail_url, original_body, original_lang, source_name, source_url, image_credit, view_count, created_at, points_awarded, author:profiles(id, nickname, country, avatar_url, is_withdrawn), comments(count)";

function mapPost(row: PostRow): Post {
  return {
    id: row.id,
    category: row.category,
    subCategory: row.sub_category ?? undefined,
    country: row.country,
    title: row.title,
    body: row.body,
    author: row.author
      ? {
          id: row.author.id,
          nickname: row.author.nickname,
          country: row.author.country,
          avatarUrl: row.author.avatar_url ?? undefined,
          isWithdrawn: row.author.is_withdrawn,
        }
      : { id: row.author_id, nickname: "알 수 없음", country: "etc" },
    createdAt: row.created_at,
    viewCount: row.view_count,
    commentCount: row.comments?.[0]?.count ?? 0,
    thumbnailUrl: row.thumbnail_url ?? undefined,
    originalBody: row.original_body ?? undefined,
    originalLang: row.original_lang ?? undefined,
    sourceName: row.source_name ?? undefined,
    sourceUrl: row.source_url ?? undefined,
    imageCredit: row.image_credit ?? undefined,
    pointsAwarded: row.points_awarded ?? 0,
  };
}

export class InsufficientPointsError extends Error {
  constructor() {
    super("INSUFFICIENT_POINTS");
    this.name = "InsufficientPointsError";
  }
}

export interface FetchPostsParams {
  category: CategorySlug;
  subCategory?: string;
  country?: CountryCode;
  sort?: SortOrder;
  search?: string;
  searchScope?: SearchScope;
  page?: number;
  pageSize?: number;
}

export async function fetchPosts({
  category,
  subCategory,
  country,
  sort = "latest",
  search,
  searchScope = "titleContent",
  page = 1,
  pageSize = 20,
}: FetchPostsParams): Promise<{ posts: Post[]; total: number }> {
  const supabase = createClient();

  const {
    data: { user: viewer },
  } = await supabase.auth.getUser();
  const blockedIds = viewer ? await fetchBlockedIds(viewer.id) : [];

  let authorIds: string[] | null = null;
  if (search && searchScope === "author") {
    const { data } = await supabase
      .from("profiles")
      .select("id")
      .ilike("nickname", `%${search}%`);
    authorIds = (data ?? []).map((p) => p.id);
    if (authorIds.length === 0) return { posts: [], total: 0 };
  }

  let query = supabase
    .from("posts")
    .select(POST_SELECT, { count: "exact" })
    .eq("category", category);

  if (blockedIds.length > 0) {
    query = query.not("author_id", "in", `(${blockedIds.join(",")})`);
  }
  if (subCategory && subCategory !== "all") {
    query = query.eq("sub_category", subCategory);
  }
  if (country && country !== "all") {
    query = query.eq("country", country);
  }
  if (search) {
    if (searchScope === "title") {
      query = query.ilike("title", `%${search}%`);
    } else if (searchScope === "author" && authorIds) {
      query = query.in("author_id", authorIds);
    } else if (searchScope === "titleContent") {
      query = query.or(`title.ilike.%${search}%,body.ilike.%${search}%`);
    }
  }

  query = query.order(sort === "popular" ? "view_count" : "created_at", {
    ascending: false,
  });

  const from = (page - 1) * pageSize;
  query = query.range(from, from + pageSize - 1);

  const { data, count, error } = await query;
  if (error) throw error;

  return {
    posts: (data ?? []).map((row) => mapPost(row as unknown as PostRow)),
    total: count ?? 0,
  };
}

export async function fetchLatestPosts(
  category: CategorySlug,
  limit: number,
): Promise<Post[]> {
  const { posts } = await fetchPosts({ category, sort: "latest", page: 1, pageSize: limit });
  return posts;
}

export async function fetchPostById(
  category: CategorySlug,
  id: string,
): Promise<Post | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("posts")
    .select(POST_SELECT)
    .eq("category", category)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return mapPost(data as unknown as PostRow);
}

export async function incrementViewCount(id: string, currentViewCount: number) {
  const supabase = createClient();
  await supabase
    .from("posts")
    .update({ view_count: currentViewCount + 1 })
    .eq("id", id);
}

export interface CreatePostInput {
  category: CategorySlug;
  subCategory?: string;
  country: CountryCode;
  title: string;
  body: string;
  authorId: string;
}

export async function createPost(input: CreatePostInput): Promise<string> {
  const supabase = createClient();
  const premium = isPremiumPostTarget(input.category, input.subCategory);

  if (premium) {
    const { data: currentPoints, error: pointsError } = await supabase.rpc("get_my_points");
    if (pointsError) throw pointsError;
    if ((currentPoints ?? 0) < PREMIUM_POST_COST) {
      throw new InsufficientPointsError();
    }
  }

  const delta = premium ? -PREMIUM_POST_COST : POST_REWARD;
  const { data, error } = await supabase
    .from("posts")
    .insert({
      category: input.category,
      sub_category: input.subCategory || null,
      country: input.country,
      title: input.title,
      body: input.body,
      author_id: input.authorId,
      points_awarded: delta,
    })
    .select("id")
    .single();
  if (error) throw error;

  const { error: adjustError } = await supabase.rpc("adjust_points", { delta });
  if (adjustError) throw adjustError;

  return data.id;
}

export async function fetchPostsByAuthor(authorId: string): Promise<Post[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("posts")
    .select(POST_SELECT)
    .eq("author_id", authorId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => mapPost(row as unknown as PostRow));
}

export async function deletePost(postId: string, authorId: string, pointsAwarded: number) {
  const supabase = createClient();
  const { error } = await supabase
    .from("posts")
    .delete()
    .eq("id", postId)
    .eq("author_id", authorId);
  if (error) throw error;
  if (pointsAwarded !== 0) {
    await supabase.rpc("adjust_points", { delta: -pointsAwarded });
  }
}

export async function fetchPostCountByAuthor(authorId: string): Promise<number> {
  const supabase = createClient();
  const { count, error } = await supabase
    .from("posts")
    .select("id", { count: "exact", head: true })
    .eq("author_id", authorId);
  if (error) throw error;
  return count ?? 0;
}
