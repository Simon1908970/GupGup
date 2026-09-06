import type { CountryCode } from "@/lib/types";

export interface ExchangeTarget {
  country: CountryCode;
  code: string; // ISO 4217
}

// Matches the site's 7 target countries (see constants/countries.ts) --
// "etc"/"all"/"kr" have no single home currency, so they're excluded.
export const EXCHANGE_TARGETS: ExchangeTarget[] = [
  { country: "vn", code: "VND" },
  { country: "th", code: "THB" },
  { country: "la", code: "LAK" },
  { country: "id", code: "IDR" },
  { country: "mm", code: "MMK" },
  { country: "ph", code: "PHP" },
  { country: "mn", code: "MNT" },
];
