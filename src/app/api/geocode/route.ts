import { NextResponse } from "next/server";
import { parseKakaoAddressResponse } from "@/lib/kakaoGeocode";

export async function POST(request: Request) {
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
