import type { CategorySlug, Comment, CountryCode, Post } from "@/lib/types";

const NAMES = [
  "hoa_ng",
  "somchai99",
  "budi.k",
  "phuong.tr",
  "минж",
  "juan_dc",
  "aye.mm",
  "linh2023",
];
const COUNTRIES: CountryCode[] = ["vn", "th", "id", "ph", "mn", "mm", "la", "etc"];

function mockAuthor(seed: number) {
  return {
    id: `user-${seed}`,
    nickname: NAMES[seed % NAMES.length],
    country: COUNTRIES[seed % COUNTRIES.length],
  };
}

const TITLES: Record<CategorySlug, string[]> = {
  news: [
    "외국인 근로자 비자 연장 절차 간소화 안내",
    "2026년 최저임금 인상 확정",
    "다문화가족 지원센터 이용 안내",
    "건강보험료 납부 기한 안내",
    "외국인 등록증 재발급 절차 변경",
    "지역별 무료 한국어 교실 모집",
    "외국인 근로자 대상 안전교육 실시",
    "출입국관리사무소 민원 온라인 접수 확대",
    "외국인 유학생 장학금 신청 안내",
    "설 연휴 대중교통 운행 안내",
  ],
  community: [
    "한국 생활 3년차, 다들 어떻게 지내세요?",
    "월세 계약할 때 꼭 확인해야 할 것들",
    "주말에 갈만한 서울 맛집 추천해주세요",
    "한국어 공부 같이 하실 분 구해요",
    "휴대폰 요금제 뭐 쓰세요?",
    "이직 준비 중인데 조언 부탁드려요",
    "동네에 괜찮은 병원 아시는 분?",
    "설날에 고향 못 가시는 분들 모여요",
    "제주도 여행 다녀왔어요 후기 남겨요",
    "한국 생활 꿀팁 공유합니다",
  ],
  housing: [
    "원룸 보증금 협상 후기",
    "외국인도 전세자금대출 가능한가요?",
    "이사할 때 필요한 서류 정리",
    "관리비 포함 월세 시세 궁금해요",
    "집 구할 때 사기 조심하세요",
  ],
  life: [
    "출산 준비 서류 뭐가 필요한가요",
    "이 동네 맛있는 쌀국수집 발견",
    "감기로 병원 갔는데 통역 지원 있나요",
    "알뜰폰 요금제 비교해봤어요",
    "외국인등록증 갱신 방법 정리",
    "근로계약서 관련 법률 상담 후기",
  ],
  marketplace: [
    "거의 새것 냉장고 팝니다",
    "겨울 패딩 판매해요 (M사이즈)",
    "노트북 급처합니다",
    "자전거 팔아요 상태 좋음",
    "책상, 의자 세트 판매",
  ],
  university: [
    "한국어능력시험 준비 같이 해요",
    "교환학생 기숙사 신청 후기",
    "장학금 신청 서류 질문있어요",
    "졸업 후 취업비자 전환 후기",
    "동아리 신입 모집합니다",
  ],
  meeting: [
    "주말에 같이 등산 가실 분",
    "우리 동네 친구 구해요",
    "같은 나라 친구들과 모임 하고 싶어요",
    "취미로 배드민턴 치실 분 구해요",
    "언어교환 파트너 구합니다",
  ],
};

function buildPosts(category: CategorySlug, count: number): Post[] {
  const titles = TITLES[category];
  return Array.from({ length: count }).map((_, i) => {
    const seed = i + 1;
    const author = mockAuthor(seed);
    const daysAgo = i * 7 + (seed % 5);
    const createdAt = new Date(
      Date.now() - daysAgo * 24 * 60 * 60 * 1000,
    ).toISOString();
    return {
      id: `${category}-${seed}`,
      category,
      country: category === "news" ? "all" : author.country,
      title: titles[i % titles.length],
      body: `${titles[i % titles.length]}\n\n내용을 입력하는 예시 게시글입니다. 실제 서비스에서는 Supabase의 posts 테이블에서 데이터를 불러옵니다.`,
      author:
        category === "news"
          ? { id: "gupgup-admin", nickname: "Gup Gup", country: "all" }
          : author,
      createdAt,
      viewCount: 12 + seed * 17,
      commentCount: seed % 6,
    };
  });
}

export const MOCK_POSTS: Record<CategorySlug, Post[]> = {
  news: buildPosts("news", 24),
  community: buildPosts("community", 40),
  housing: buildPosts("housing", 18),
  life: buildPosts("life", 22),
  marketplace: buildPosts("marketplace", 16),
  university: buildPosts("university", 14),
  meeting: buildPosts("meeting", 20),
};

export function getPostsForCategory(category: CategorySlug): Post[] {
  return MOCK_POSTS[category] ?? [];
}

export function getPostById(
  category: CategorySlug,
  id: string,
): Post | undefined {
  return MOCK_POSTS[category]?.find((p) => p.id === id);
}

export function getAllPosts(): Post[] {
  return Object.values(MOCK_POSTS).flat();
}

export function getAuthorById(id: string) {
  return getAllPosts().find((p) => p.author.id === id)?.author;
}

export function getPostsByAuthor(id: string): Post[] {
  return getAllPosts().filter((p) => p.author.id === id);
}

export function getMockComments(postId: string): Comment[] {
  const count = Number(postId.split("-").pop()) % 4;
  return Array.from({ length: count }).map((_, i) => {
    const author = mockAuthor(i + 3);
    return {
      id: `${postId}-comment-${i}`,
      postId,
      author,
      body: [
        "좋은 정보 감사합니다!",
        "저도 같은 고민이었어요.",
        "혹시 연락처 공유 가능하실까요?",
        "도움이 많이 됐습니다 :)",
      ][i % 4],
      createdAt: new Date(Date.now() - i * 3600_000).toISOString(),
    };
  });
}
