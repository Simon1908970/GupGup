import { NextResponse } from "next/server";
import { EXCHANGE_TARGETS } from "@/lib/constants/currencies";

// Free, no-key exchange rate API (exchangerate-api.com's "open access" feed,
// updates once/day). We fetch KRW as the base so each rate is directly
// "1 KRW = X <currency>" -- the natural direction for this site's users
// (Korean-won earners converting to home currency), no inversion needed.
// Cached at the route level so client widgets never call the upstream
// directly; revalidated well inside the upstream's own daily cadence.
const UPSTREAM_URL = "https://open.er-api.com/v6/latest/KRW";
const REVALIDATE_SECONDS = 6 * 60 * 60;

export async function GET() {
  try {
    const res = await fetch(UPSTREAM_URL, { next: { revalidate: REVALIDATE_SECONDS } });
    if (!res.ok) throw new Error(`upstream ${res.status}`);
    const data = await res.json();
    if (data.result !== "success" || !data.rates) throw new Error("unexpected upstream response");

    const rates = EXCHANGE_TARGETS.map((target) => ({
      country: target.country,
      code: target.code,
      rate: data.rates[target.code] as number | undefined,
    })).filter((r) => typeof r.rate === "number");

    return NextResponse.json({
      base: "KRW",
      updatedAt: data.time_last_update_utc as string,
      rates,
    });
  } catch {
    return NextResponse.json({ base: "KRW", updatedAt: null, rates: [] }, { status: 200 });
  }
}
