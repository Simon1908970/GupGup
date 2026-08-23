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
  const { data, error } = await supabase
    .from("inquiry_messages")
    .select("id, sender_type, body, created_at")
    .eq("inquiry_id", id)
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ messages: data });
}
