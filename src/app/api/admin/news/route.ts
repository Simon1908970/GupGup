import { NextResponse } from "next/server";
import { assertAdmin } from "@/lib/supabase/adminAuth";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateNewsArticleInput, type NewsArticleInput } from "@/lib/news/newsInput";

export async function POST(request: Request) {
  const admin = await assertAdmin();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const input = (await request.json()) as Partial<NewsArticleInput>;
  const invalid = validateNewsArticleInput(input);
  if (invalid) {
    return NextResponse.json({ error: `invalid: ${invalid}` }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("posts")
    .insert({
      category: "news",
      sub_category: null,
      country: "etc",
      author_id: admin.userId,
      points_awarded: 0,
      title: input.title!.trim(),
      body: input.body!.trim(),
      original_body: input.originalBody!.trim(),
      original_lang: input.originalLang?.trim() || "th",
      source_name: input.sourceName!.trim(),
      source_url: input.sourceUrl!.trim(),
      image_credit: input.imageCredit?.trim() || null,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: data.id });
}
