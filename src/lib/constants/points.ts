import type { CategorySlug } from "@/lib/types";

export const SIGNUP_BONUS = 2000;
export const POST_REWARD = 100;
export const COMMENT_REWARD = 50;
export const PREMIUM_POST_COST = 200;
// "내 월급"/"내 생활비" 카드 제출 -- 표를 채우는 수고가 일반 댓글보다 커서
// 일반 글쓰기와 같은 수준으로 준다(2026-11-09 결정). 카드에 대한 답글은
// 여전히 COMMENT_REWARD.
export const PINNED_FORM_CARD_REWARD = 100;

interface PremiumTarget {
  category: CategorySlug;
  subCategory?: string;
}

const PREMIUM_POST_TARGETS: PremiumTarget[] = [
  { category: "housing" },
  { category: "marketplace" },
  { category: "life", subCategory: "restaurant" },
  { category: "life", subCategory: "hospital" },
  { category: "life", subCategory: "mobile" },
  { category: "life", subCategory: "admin" },
  { category: "community", subCategory: "dating" },
];

export function isPremiumPostTarget(category: CategorySlug, subCategory?: string): boolean {
  return PREMIUM_POST_TARGETS.some(
    (target) =>
      target.category === category &&
      (target.subCategory === undefined || target.subCategory === subCategory),
  );
}
