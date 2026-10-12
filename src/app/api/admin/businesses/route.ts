import { NextResponse } from "next/server";
import { assertAdmin } from "@/lib/supabase/adminAuth";
import { createAdminClient } from "@/lib/supabase/admin";

// businesses의 공개 select RLS는 is_active = true 행만 허용하므로, 관리자 화면은
// 브라우저 클라이언트로 읽으면 비활성화한 업체를 다시 볼 수 없다. 서비스 롤로
// is_active 필터 없이 전체를 읽는다.
export async function GET() {
  const admin = await assertAdmin();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("businesses")
    .select("id, name, category, country, address, lat, lng, phone, is_active")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ businesses: data });
}
