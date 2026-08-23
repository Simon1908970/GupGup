import { NextResponse } from "next/server";
import { assertAdmin } from "@/lib/supabase/adminAuth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const admin = await assertAdmin();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  const supabase = createAdminClient();
  let query = supabase
    .from("profiles")
    .select("id, nickname, country, points, is_withdrawn, created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  if (q) query = query.ilike("nickname", `%${q}%`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ users: data });
}
