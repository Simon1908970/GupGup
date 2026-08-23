import { NextResponse } from "next/server";
import { assertAdmin } from "@/lib/supabase/adminAuth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await assertAdmin();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;
  const { body } = (await request.json()) as { body?: string };
  if (!body?.trim()) {
    return NextResponse.json({ error: "empty body" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error: insertError } = await supabase.from("inquiry_messages").insert({
    inquiry_id: id,
    sender_type: "admin",
    sender_id: admin.userId,
    body: body.trim(),
  });
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  const { error: statusError } = await supabase
    .from("inquiries")
    .update({ status: "answered" })
    .eq("id", id);
  if (statusError) return NextResponse.json({ error: statusError.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
