import type { CategorySlug } from "@/lib/types";

export const SIGNUP_BONUS = 2000;
export const POST_REWARD = 100;
export const COMMENT_REWARD = 50;
export const PREMIUM_POST_COST = 200;

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
];

export function isPremiumPostTarget(category: CategorySlug, subCategory?: string): boolean {
  return PREMIUM_POST_TARGETS.some(
    (target) =>
      target.category === category &&
      (target.subCategory === undefined || target.subCategory === subCategory),
  );
}
