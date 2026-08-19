"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { SIGNUP_COUNTRIES } from "@/lib/constants/countries";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import type { DictionaryKey } from "@/lib/i18n/dictionaries";
import type { CountryCode } from "@/lib/types";

export default function OnboardingPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const { user } = useAuth();
  const [nickname, setNickname] = useState("");
  const [country, setCountry] = useState<CountryCode>("vn");
  const [checkResult, setCheckResult] = useState<"idle" | "available" | "taken">("idle");
  const [checking, setChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCheckDuplicate() {
    if (!nickname.trim()) return;
    setChecking(true);
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from("profiles")
        .select("id")
        .eq("nickname", nickname.trim())
        .maybeSingle();
      setCheckResult(data ? "taken" : "available");
    } catch {
      setCheckResult("idle");
    } finally {
      setChecking(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) {
      setError("로그인이 필요합니다.");
      return;
    }
    if (checkResult !== "available") {
      setError("닉네임 중복확인을 먼저 진행해주세요.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: upsertError } = await supabase
        .from("profiles")
        .upsert({ id: user.id, nickname: nickname.trim(), country });
      if (upsertError) throw upsertError;
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-5 px-4 py-12">
      <h1 className="text-center text-xl font-bold">{t("onboarding.title")}</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">
            {t("onboarding.nickname")}
          </label>
          <div className="flex gap-2">
            <input
              value={nickname}
              onChange={(e) => {
                setNickname(e.target.value);
                setCheckResult("idle");
              }}
              className="h-11 flex-1 rounded-md border border-[var(--color-border-gray)] px-3 text-sm outline-none focus:border-[var(--color-brand-red)]"
            />
            <button
              type="button"
              onClick={handleCheckDuplicate}
              disabled={checking || !nickname.trim()}
              className="shrink-0 rounded-md border border-[var(--color-brand-red)] px-3 text-xs font-medium text-[var(--color-brand-red)] disabled:opacity-40"
            >
              {t("onboarding.checkDuplicate")}
            </button>
          </div>
          {checkResult === "available" && (
            <p className="mt-1 text-xs text-green-600">사용 가능한 닉네임입니다.</p>
          )}
          {checkResult === "taken" && (
            <p className="mt-1 text-xs text-[var(--color-brand-red)]">이미 사용 중인 닉네임입니다.</p>
          )}
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">
            {t("onboarding.country")}
          </label>
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value as CountryCode)}
            className="h-11 w-full rounded-md border border-[var(--color-border-gray)] px-3 text-sm"
          >
            {SIGNUP_COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.flag} {t(c.labelKey as DictionaryKey)}
              </option>
            ))}
          </select>
        </div>

        {error && <p className="text-xs text-[var(--color-brand-red)]">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="h-11 rounded-md bg-[var(--color-brand-red)] text-sm font-semibold text-white disabled:opacity-50"
        >
          {t("onboarding.submit")}
        </button>
      </form>
    </div>
  );
}
