import type { CountryCode } from "@/lib/types";

export interface RateItem {
  country: CountryCode;
  code: string;
  rate: number;
  trend?: "up" | "down" | "flat" | null;
}

// Some target currencies (THB, PHP) are worth close to or more than 1 KRW,
// so "1 ₩ = 0.02 THB" reads as basically zero. Scale the KRW side up to the
// smallest power of 10 that keeps the converted amount readable (>= ~1).
export function displayUnit(rate: number): number {
  if (rate >= 1) return 1;
  if (rate >= 0.1) return 10;
  if (rate >= 0.01) return 100;
  return 1000;
}
