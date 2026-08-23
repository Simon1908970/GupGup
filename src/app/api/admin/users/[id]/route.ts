import { NextResponse } from "next/server";
import { assertAdmin } from "@/lib/supabase/adminAuth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await assertAdmin();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;
  const body = (await request.json()) as { pointsDelta?: number; isWithdrawn?: boolean };
  const supabase = createAdminClient();

  if (typeof body.pointsDelta === "number" && body.pointsDelta !== 0) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("points")
      .eq("id", id)
      .maybeSingle();
    if (!profile) return NextResponse.json({ error: "not found" }, { status: 404 });
    const { error } = await supabase
      .from("profiles")
      .update({ points: Math.max(profile.points + body.pointsDelta, 0) })
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (typeof body.isWithdrawn === "boolean") {
    const { error } = await supabase
      .from("profiles")
      .update({ is_withdrawn: body.isWithdrawn })
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
