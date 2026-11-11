export type CountryCode =
  | "all"
  | "vn"
  | "th"
  | "la"
  | "id"
  | "mm"
  | "ph"
  | "mn"
  | "kh"
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

export type BusinessCategory =
  | "restaurant"
  | "mart"
  | "salon"
  | "hospital"
  | "mobile"
  | "admin"
  | "shipping"
  | "etc";

export interface Business {
  id: string;
  name: string;
  category: BusinessCategory;
  country: CountryCode;
  address: string;
  lat: number;
  lng: number;
  phone?: string;
}


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
  requiresAuth?: boolean;
}

export interface Author {
  id: string;
  nickname: string;
  country: CountryCode;
  avatarUrl?: string;
  isWithdrawn?: boolean;
  isSupporter?: boolean;
  // "내 월급"/"내 생활비" 카드를 익명으로 올린 경우. id는 실제 회원 id가
  // 아닌 더미 값이라 프로필 보기/쪽지/차단 같은 작성자 기반 동작을 쓸 수
  // 없으므로, 닉네임 팝업은 이 값일 때 클릭 가능한 팝업 대신 평범한 텍스트를
  // 보여준다(탈퇴 회원과 같은 방식).
  isAnonymousCard?: boolean;
  // "내 월급"/"내 생활비" 카드 전용: 익명 여부와 무관하게 닉네임 옆에 보여줄
  // 국기(제출 시점 시스템 언어로 추정, profiles.country와는 다른 값).
  // 다른 화면의 Author에는 없는 필드라 일반 댓글/게시글에는 영향 없다.
  flagCountry?: CountryCode;
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
  likeCount: number;
  likedByViewer: boolean;
  thumbnailUrl?: string;
  attachments: Attachment[];
  originalBody?: string;
  originalLang?: string;
  sourceName?: string;
  sourceUrl?: string;
  imageCredit?: string;
  pointsAwarded: number;
  showOnMap?: boolean;
  businessAddress?: string;
  businessDetailAddress?: string;
  businessLat?: number;
  businessLng?: number;
  isNotice?: boolean;
  membersOnly?: boolean;
  pinnedFormType?: "salary" | "living_cost";
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

// 지역·업종·근무시간 같은 세부 항목은 전부 선택 입력이다 -- 본인의 정확한
// 세전 월급이나 동네 이름을 모르는 회원도 아는 만큼만 채워서 올릴 수 있게
// (2026-11-08 결정). null은 "안 적었음"이고, base_month만 항상 값이 있다.
export interface SalaryEntry {
  id: string;
  postId: string;
  commentId: string;
  isDeleted: boolean;
  isAnonymous: boolean;
  author: Author;
  regionProvince: string | null;
  regionCity: string | null;
  industryMain: string | null;
  industrySub: string | null;
  visa: string | null;
  weeklyHours: number | null;
  monthlyDaysOff: number | null;
  nightWork: "none" | "sometimes" | "shift";
  grossPay: number | null;
  overtimeIncluded: boolean;
  deductHousing: number | null;
  deductFood: number | null;
  deductTaxInsurance: number | null;
  deductOther: number | null;
  netPay: number | null;
  baseMonth: string;
  createdAt: string;
  authorLocale: string | null;
}

export interface LivingCostEntry {
  id: string;
  postId: string;
  commentId: string;
  isDeleted: boolean;
  isAnonymous: boolean;
  author: Author;
  regionProvince: string | null;
  regionCity: string | null;
  status: string | null;
  household: string | null;
  housingType: string | null;
  netPay: number | null;
  rent: number | null;
  utilities: number | null;
  phone: number | null;
  transport: number | null;
  groceries: number | null;
  eatingOut: number | null;
  shopping: number | null;
  other: number | null;
  totalCost: number | null;
  remaining: number | null;
  baseMonth: string;
  createdAt: string;
  authorLocale: string | null;
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
