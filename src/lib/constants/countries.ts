import type { CountryCode } from "@/lib/types";

export interface CountryOption {
  code: CountryCode;
  labelKey: string;
  flag: string;
}

export const COUNTRIES: CountryOption[] = [
  { code: "all", labelKey: "country.all", flag: "🌏" },
  { code: "vn", labelKey: "country.vn", flag: "🇻🇳" },
  { code: "th", labelKey: "country.th", flag: "🇹🇭" },
  { code: "la", labelKey: "country.la", flag: "🇱🇦" },
  { code: "id", labelKey: "country.id", flag: "🇮🇩" },
  { code: "mm", labelKey: "country.mm", flag: "🇲🇲" },
  { code: "ph", labelKey: "country.ph", flag: "🇵🇭" },
  { code: "mn", labelKey: "country.mn", flag: "🇲🇳" },
  { code: "etc", labelKey: "country.etc", flag: "🌐" },
];

// countries selectable at signup / post-writing (excludes "all")
export const SIGNUP_COUNTRIES = COUNTRIES.filter((c) => c.code !== "all");
