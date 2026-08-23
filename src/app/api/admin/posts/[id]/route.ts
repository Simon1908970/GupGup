import { NextResponse } from "next/server";
import { assertAdmin } from "@/lib/supabase/adminAuth";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPremiumPostTarget, POST_REWARD, PREMIUM_POST_COST } from "@/lib/constants/points";
import type { CategorySlug } from "@/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";

async function deletePostAndReversePoints(
  supabase: SupabaseClient,
  postId: string,
  authorId: string,
  pointsAwarded: number,
) {
  const { error: deleteError } = await supabase.from("posts").delete().eq("id", postId);
  if (deleteError) throw deleteError;

  if (pointsAwarded) {
    const { data: author } = await supabase
      .from("profiles")
      .select("points")
      .eq("id", authorId)
      .maybeSingle();
    if (author) {
      await supabase
        .from("profiles")
        .update({ points: Math.max(author.points - pointsAwarded, 0) })
        .eq("id", authorId);
    }
  }
}

async function notifyAuthor(supabase: SupabaseClient, adminId: string, authorId: string, body: string) {
  const { data: existing } = await supabase
    .from("message_threads")
    .select("id")
    .or(
      `and(participant_a.eq.${adminId},participant_b.eq.${authorId}),and(participant_a.eq.${authorId},participant_b.eq.${adminId})`,
    )
    .maybeSingle();

  const threadId =
    existing?.id ??
    (
      await supabase
        .from("message_threads")
        .insert({ participant_a: adminId, participant_b: authorId })
        .select("id")
        .single()
    ).data?.id;
  if (!threadId) return;

  await supabase.from("messages").insert({ thread_id: threadId, sender_id: adminId, body });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await assertAdmin();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;
  const supabase = createAdminClient();

  const { data: post } = await supabase
    .from("posts")
    .select("author_id, points_awarded")
    .eq("id", id)
    .maybeSingle();
  if (!post) return NextResponse.json({ error: "not found" }, { status: 404 });

  await deletePostAndReversePoints(supabase, id, post.author_id, post.points_awarded);

  return NextResponse.json({ ok: true });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await assertAdmin();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;
  const { category, subCategory } = (await request.json()) as {
    category?: CategorySlug;
    subCategory?: string | null;
  };
  if (!category) return NextResponse.json({ error: "category required" }, { status: 400 });

  const supabase = createAdminClient();
  const { data: post } = await supabase
    .from("posts")
    .select("author_id, points_awarded, category, sub_category, title")
    .eq("id", id)
    .maybeSingle();
  if (!post) return NextResponse.json({ error: "not found" }, { status: 404 });

  if (post.category === category && (post.sub_category ?? null) === (subCategory ?? null)) {
    return NextResponse.json({ ok: true, action: "unchanged" });
  }

  const { data: author } = await supabase
    .from("profiles")
    .select("points")
    .eq("id", post.author_id)
    .maybeSingle();
  if (!author) return NextResponse.json({ error: "author not found" }, { status: 404 });

  const newPointsAwarded = isPremiumPostTarget(category, subCategory ?? undefined)
    ? -PREMIUM_POST_COST
    : POST_REWARD;
  const diff = newPointsAwarded - post.points_awarded;
  const projected = author.points + diff;

  if (projected < 0) {
    await deletePostAndReversePoints(supabase, id, post.author_id, post.points_awarded);
    await notifyAuthor(
      supabase,
      admin.userId,
      post.author_id,
      `보유 포인트가 부족하여 게시글 "${post.title}"이(가) 삭제되었습니다.`,
    );
    return NextResponse.json({ ok: true, action: "deleted_insufficient_points" });
  }

  const { error: updateError } = await supabase
    .from("posts")
    .update({ category, sub_category: subCategory ?? null, points_awarded: newPointsAwarded })
    .eq("id", id);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  const { error: pointsError } = await supabase
    .from("profiles")
    .update({ points: projected })
    .eq("id", post.author_id);
  if (pointsError) return NextResponse.json({ error: pointsError.message }, { status: 500 });

  return NextResponse.json({ ok: true, action: "moved" });
}
