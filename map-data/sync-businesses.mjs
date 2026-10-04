import { createClient } from "@supabase/supabase-js";
import { buildSearchQueries, mapKakaoPlaceToBusinessRow } from "./_lib.mjs";

// 전국 단위 검색: 지역을 특정하지 않고 "국가명 + 업종" 키워드만으로 검색하고,
// 페이지네이션으로 여러 페이지를 긁어와 특정 지역에 치우치지 않게 한다.
// 마사지/노래방/클럽 등은 국적명과 묶이면 불법 성매매·인신매매 위장 광고가
// 섞여 나오는 걸로 잘 알려져 있어 자동 수집 대상에 넣지 않는다 — 검수 없이
// 바로 공개되는 구조라 이주노동자 대상 사이트에서 특히 위험하다.
const COUNTRY_NAMES = {
  vn: "베트남",
  th: "태국",
  la: "라오스",
  id: "인도네시아",
  mm: "미얀마",
  ph: "필리핀",
  mn: "몽골",
};

const CATEGORY_KEYWORDS = {
  restaurant: "음식점",
  mart: "마트",
  salon: "미용실",
  admin: "비자",
  shipping: "국제택배",
};

const TARGETS = Object.entries(COUNTRY_NAMES).flatMap(([country, countryName]) =>
  Object.entries(CATEGORY_KEYWORDS).map(([category, categoryKeyword]) => ({
    country,
    category,
    keyword: `${countryName} ${categoryKeyword}`,
  })),
);

const MAX_PAGES = 3; // 쿼리당 최대 45건 (15 × 3페이지)

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
  const results = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const res = await fetch(
      `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}&page=${page}&size=15`,
      { headers: { Authorization: `KakaoAK ${KAKAO_API_KEY}` } },
    );
    if (!res.ok) {
      console.error(`카카오 검색 실패: ${query} (page ${page}, ${res.status})`);
      break;
    }
    const data = await res.json();
    results.push(...(data.documents ?? []));
    if (data.meta?.is_end) break;
  }
  return results;
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
