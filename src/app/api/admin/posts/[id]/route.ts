import { NextResponse } from "next/server";
import { assertAdmin } from "@/lib/supabase/adminAuth";
import { createAdminClient } from "@/lib/supabase/admin";

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

  const { error: deleteError } = await supabase.from("posts").delete().eq("id", id);
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });

  if (post.points_awarded) {
    const { data: author } = await supabase
      .from("profiles")
      .select("points")
      .eq("id", post.author_id)
      .maybeSingle();
    if (author) {
      await supabase
        .from("profiles")
        .update({ points: Math.max(author.points - post.points_awarded, 0) })
        .eq("id", post.author_id);
    }
  }

  return NextResponse.json({ ok: true });
}
