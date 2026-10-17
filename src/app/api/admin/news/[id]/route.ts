import { NextResponse } from "next/server";
import { assertAdmin } from "@/lib/supabase/adminAuth";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateNewsArticleInput, type NewsArticleInput } from "@/lib/news/newsInput";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await assertAdmin();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;
  const input = (await request.json()) as Partial<NewsArticleInput>;
  const invalid = validateNewsArticleInput(input);
  if (invalid) {
    return NextResponse.json({ error: `invalid: ${invalid}` }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: post } = await supabase
    .from("posts")
    .select("category")
    .eq("id", id)
    .maybeSingle();
  if (!post) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (post.category !== "news") {
    return NextResponse.json({ error: "not a news post" }, { status: 400 });
  }

  const { error } = await supabase
    .from("posts")
    .update({
      title: input.title!.trim(),
      body: input.body!.trim(),
      original_body: input.originalBody!.trim(),
      original_lang: input.originalLang?.trim() || "th",
      source_name: input.sourceName!.trim(),
      source_url: input.sourceUrl!.trim(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
