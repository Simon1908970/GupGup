import { NextResponse } from "next/server";
import { assertAdmin } from "@/lib/supabase/adminAuth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const admin = await assertAdmin();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const status = new URL(request.url).searchParams.get("status") ?? "all";
  const supabase = createAdminClient();
  let query = supabase
    .from("inquiries")
    .select("id, title, status, created_at, user:profiles(nickname)")
    .order("created_at", { ascending: false });
  if (status !== "all") query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ inquiries: data });
}
