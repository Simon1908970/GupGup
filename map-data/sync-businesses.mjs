import { createClient } from "@supabase/supabase-js";
import { buildSearchQueries, mapKakaoPlaceToBusinessRow } from "./_lib.mjs";

const TARGETS = [
  { country: "vn", category: "restaurant", keyword: "베트남 음식", regions: ["안산시 원곡동", "서울 광희동", "김포시"] },
  { country: "vn", category: "mart", keyword: "베트남 마트", regions: ["안산시 원곡동", "서울 광희동"] },
  { country: "th", category: "restaurant", keyword: "태국 음식", regions: ["서울", "안산시"] },
  { country: "th", category: "mart", keyword: "태국 식료품", regions: ["서울", "안산시"] },
];

const KAKAO_API_KEY = process.env.KAKAO_REST_API_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!KAKAO_API_KEY || !SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("KAKAO_REST_API_KEY / NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY가 필요합니다.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function searchKeyword(query) {
  const res = await fetch(
    `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}`,
    { headers: { Authorization: `KakaoAK ${KAKAO_API_KEY}` } },
  );
  if (!res.ok) {
    console.error(`카카오 검색 실패: ${query} (${res.status})`);
    return [];
  }
  const data = await res.json();
  return data.documents ?? [];
}

async function main() {
  let totalUpserted = 0;
  for (const target of TARGETS) {
    for (const query of buildSearchQueries(target)) {
      const places = await searchKeyword(query);
      const rows = places.map((p) => mapKakaoPlaceToBusinessRow(p, target));
      if (rows.length === 0) continue;
      const { error } = await supabase.from("businesses").upsert(rows, { onConflict: "kakao_place_id" });
      if (error) {
        console.error(`upsert 실패 (${query}):`, error.message);
        continue;
      }
      totalUpserted += rows.length;
      console.log(`"${query}" → ${rows.length}건 upsert`);
    }
  }
  console.log(`완료: 총 ${totalUpserted}건 upsert`);
}

main();
