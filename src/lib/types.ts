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

export type AttachmentType = "image" | "video";

export interface Attachment {
  url: string;
  type: AttachmentType;
}

export const MAX_ATTACHMENTS = 5;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
export const ATTACHMENT_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
] as const;
export const ATTACHMENT_VIDEO_TYPES = [
  "video/mp4",
  "video/quicktime",
  "video/webm",
] as const;

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
  attachments: Attachment[];
  originalBody?: string;
  originalLang?: string;
  sourceName?: string;
  sourceUrl?: string;
  imageCredit?: string;
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
