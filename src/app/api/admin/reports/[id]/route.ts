import { NextResponse } from "next/server";
import { assertAdmin } from "@/lib/supabase/adminAuth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await assertAdmin();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;
  const supabase = createAdminClient();
  const { data: report, error } = await supabase
    .from("reports")
    .select(
      "id, target_type, target_id, reason, detail, status, created_at, reporter:profiles(nickname)",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!report) return NextResponse.json({ error: "not found" }, { status: 404 });

  let target: unknown = null;
  if (report.target_type === "post") {
    const { data } = await supabase
      .from("posts")
      .select("id, title, body, category, author_id, author:profiles(nickname)")
      .eq("id", report.target_id)
      .maybeSingle();
    target = data;
  } else if (report.target_type === "comment") {
    const { data } = await supabase
      .from("comments")
      .select("id, body, post_id, is_deleted, author_id, author:profiles(nickname)")
      .eq("id", report.target_id)
      .maybeSingle();
    target = data;
  } else {
    const { data } = await supabase
      .from("profiles")
      .select("id, nickname, country, is_withdrawn")
      .eq("id", report.target_id)
      .maybeSingle();
    target = data;
  }

  return NextResponse.json({ report, target });
}
