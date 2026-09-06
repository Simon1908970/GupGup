import { NextResponse } from "next/server";
import { EXCHANGE_TARGETS } from "@/lib/constants/currencies";
import { createAdminClient } from "@/lib/supabase/admin";

// Free, no-key exchange rate API (exchangerate-api.com's "open access" feed,
// updates once/day). We fetch KRW as the base so each rate is directly
// "1 KRW = X <currency>" -- the natural direction for this site's users
// (Korean-won earners converting to home currency), no inversion needed.
// Cached at the route level so client widgets never call the upstream
// directly; revalidated well inside the upstream's own daily cadence.
const UPSTREAM_URL = "https://open.er-api.com/v6/latest/KRW";
const REVALIDATE_SECONDS = 6 * 60 * 60;

type Trend = "up" | "down" | "flat";

export async function GET() {
  try {
    const res = await fetch(UPSTREAM_URL, { next: { revalidate: REVALIDATE_SECONDS } });
    if (!res.ok) throw new Error(`upstream ${res.status}`);
    const data = await res.json();
    if (data.result !== "success" || !data.rates) throw new Error("unexpected upstream response");

    const today = new Date(data.time_last_update_utc as string).toISOString().slice(0, 10);
    const codes = EXCHANGE_TARGETS.map((t) => t.code);

    const todayRates = EXCHANGE_TARGETS.map((target) => ({
      country: target.country,
      code: target.code,
      rate: data.rates[target.code] as number | undefined,
    })).filter((r): r is { country: (typeof EXCHANGE_TARGETS)[number]["country"]; code: string; rate: number } =>
      typeof r.rate === "number",
    );

    // Best-effort history: snapshot today's rates and diff against the most
    // recent prior day on record. Trend info is a nice-to-have, so any
    // failure here must not break the rates response itself.
    const trendByCode = new Map<string, Trend>();
    try {
      const admin = createAdminClient();
      await admin
        .from("exchange_rate_history")
        .upsert(
          todayRates.map((r) => ({ date: today, code: r.code, rate: r.rate })),
          { onConflict: "date,code" },
        );

      const { data: history } = await admin
        .from("exchange_rate_history")
        .select("date, code, rate")
        .in("code", codes)
        .lt("date", today)
        .order("date", { ascending: false });

      const previousByCode = new Map<string, number>();
      for (const row of history ?? []) {
        if (!previousByCode.has(row.code)) previousByCode.set(row.code, Number(row.rate));
      }
      for (const r of todayRates) {
        const prev = previousByCode.get(r.code);
        if (prev === undefined) continue;
        trendByCode.set(r.code, r.rate > prev ? "up" : r.rate < prev ? "down" : "flat");
      }
    } catch {
      // no trend data this time -- rates themselves are unaffected
    }

    return NextResponse.json({
      base: "KRW",
      updatedAt: data.time_last_update_utc as string,
      rates: todayRates.map((r) => ({ ...r, trend: trendByCode.get(r.code) ?? null })),
    });
  } catch {
    return NextResponse.json({ base: "KRW", updatedAt: null, rates: [] }, { status: 200 });
  }
}
