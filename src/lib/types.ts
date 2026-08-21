export type CountryCode =
  | "all"
  | "vn"
  | "th"
  | "la"
  | "id"
  | "mm"
  | "ph"
  | "mn"
  | "kr"
  | "etc";

export type CategorySlug =
  | "news"
  | "community"
  | "housing"
  | "life"
  | "marketplace"
  | "university"
  | "meeting";

export type BoxStyle = "large" | "grid";

export interface SubCategory {
  slug: string;
  labelKey: string;
}

export interface CategoryConfig {
  slug: CategorySlug;
  labelKey: string;
  boxStyle: BoxStyle;
  mainCount: number;
  subCategories?: SubCategory[];
  hasAuthorAvatar: boolean;
  hasCountryTag: boolean;
  hasMessageButton: boolean;
  hasNicknamePopup: boolean;
}

export interface Author {
  id: string;
  nickname: string;
  country: CountryCode;
  avatarUrl?: string;
  isWithdrawn?: boolean;
}

export interface Post {
  id: string;
  category: CategorySlug;
  subCategory?: string;
  country: CountryCode;
  title: string;
  body: string;
  author: Author;
  createdAt: string;
  viewCount: number;
  commentCount: number;
  thumbnailUrl?: string;
  pointsAwarded: number;
}

export interface Comment {
  id: string;
  postId: string;
  author: Author;
  body: string;
  createdAt: string;
  parentId?: string;
  isDeleted: boolean;
}

export type SortOrder = "latest" | "popular";

export type ReportReason =
  | "spam"
  | "abuse"
  | "obscene"
  | "fraud"
  | "personal_info"
  | "etc";

export interface ReportTarget {
  type: "post" | "comment" | "user";
  id: string;
}
