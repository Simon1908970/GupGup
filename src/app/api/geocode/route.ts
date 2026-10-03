import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseKakaoAddressResponse } from "@/lib/kakaoGeocode";

export async function POST(request: Request) {
  // 로그인 사용자만 — 비로그인 호출로 KAKAO_REST_API_KEY 쿼터(수집 스크립트와 공용)가
  // 소진되지 않도록. 이 라우트를 부르는 글쓰기 화면 자체가 로그인 필요.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { address } = (await request.json()) as { address?: string };
  if (!address) {
    return NextResponse.json({ error: "address is required" }, { status: 400 });
  }

  const apiKey = process.env.KAKAO_REST_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "geocoding is not configured" }, { status: 500 });
  }

  const res = await fetch(
    `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(address)}`,
    { headers: { Authorization: `KakaoAK ${apiKey}` } },
  );

  if (!res.ok) {
    const detail = await res.text();
    return NextResponse.json({ error: detail }, { status: 502 });
  }

  const data = await res.json();
  const coords = parseKakaoAddressResponse(data);
  if (!coords) {
    return NextResponse.json({ error: "no matching address found" }, { status: 404 });
  }

  return NextResponse.json(coords);
}
