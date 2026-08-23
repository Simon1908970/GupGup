import { NextResponse } from "next/server";
import { assertAdmin } from "@/lib/supabase/adminAuth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const admin = await assertAdmin();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const status = new URL(request.url).searchParams.get("status") ?? "pending";
  const supabase = createAdminClient();
  let query = supabase
    .from("reports")
    .select(
      "id, target_type, target_id, reason, detail, status, created_at, reporter:profiles(nickname)",
    )
    .order("created_at", { ascending: false });
  if (status !== "all") query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ reports: data });
}
