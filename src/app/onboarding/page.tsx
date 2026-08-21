"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Camera } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { SIGNUP_COUNTRIES } from "@/lib/constants/countries";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import type { DictionaryKey } from "@/lib/i18n/dictionaries";
import type { CountryCode } from "@/lib/types";
import { Avatar } from "@/components/common/Avatar";
import { DefaultAvatarPicker } from "@/components/common/DefaultAvatarPicker";
import { randomDefaultAvatar } from "@/lib/constants/avatars";
import { SIGNUP_BONUS } from "@/lib/constants/points";
import { getErrorMessage } from "@/lib/utils";

export default function OnboardingPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const { user, profile, loading } = useAuth();
  const [nickname, setNickname] = useState("");
  const [country, setCountry] = useState<CountryCode>("vn");
  const [checkResult, setCheckResult] = useState<"idle" | "available" | "taken">("idle");
  const [checking, setChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | undefined>(undefined);
  const [selectedDefaultAvatar, setSelectedDefaultAvatar] = useState<string | null>(null);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [agreeAge14, setAgreeAge14] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const allAgreed = agreeTerms && agreePrivacy && agreeAge14;

  function handleAgreeAllToggle(checked: boolean) {
    setAgreeTerms(checked);
    setAgreePrivacy(checked);
    setAgreeAge14(checked);
  }

  function handleAvatarPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setSelectedDefaultAvatar(null);
    setAvatarPreview(URL.createObjectURL(file));
  }

  function handleDefaultAvatarSelect(url: string) {
    setSelectedDefaultAvatar(url);
    setAvatarFile(null);
    setAvatarPreview(url);
  }

  useEffect(() => {
    if (!loading && profile) router.replace("/");
  }, [loading, profile, router]);

  if (loading || profile) {
    return (
      <div className="mx-auto max-w-sm px-4 py-16 text-center text-sm text-[var(--color-text-muted)]">
        {t("common.loading")}
      </div>
    );
  }

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
      setError(t("onboarding.needLogin"));
      return;
    }
    if (checkResult !== "available") {
      setError(t("onboarding.checkDuplicateFirst"));
      return;
    }
    if (!allAgreed) {
      setError(t("onboarding.agreeRequiredError"));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const supabase = createClient();
      const avatarUrl = avatarFile ? undefined : (selectedDefaultAvatar ?? randomDefaultAvatar());
      const { error: insertError } = await supabase.from("profiles").insert({
        id: user.id,
        nickname: nickname.trim(),
        country,
        points: SIGNUP_BONUS,
        ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
      });
      if (insertError) throw insertError;
      if (avatarFile) {
        const formData = new FormData();
        formData.append("file", avatarFile);
        await fetch("/api/avatar", { method: "POST", body: formData });
      }
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-5 px-4 py-12">
      <h1 className="text-center text-xl font-bold">{t("onboarding.title")}</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex justify-center">
          <span className="relative inline-block h-20 w-20 shrink-0">
            <Avatar nickname={nickname || "?"} avatarUrl={avatarPreview} size={80} />
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full bg-[var(--color-brand-red)] text-white ring-2 ring-white"
            >
              <Camera size={14} />
            </button>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={handleAvatarPick}
            />
          </span>
        </div>

        <div className="flex flex-col items-center gap-2">
          <p className="text-center text-xs text-[var(--color-text-muted)]">{t("onboarding.avatarHint")}</p>
          <DefaultAvatarPicker selected={selectedDefaultAvatar} onSelect={handleDefaultAvatarSelect} />
        </div>

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
            <p className="mt-1 text-xs text-green-600">{t("onboarding.nicknameAvailable")}</p>
          )}
          {checkResult === "taken" && (
            <p className="mt-1 text-xs text-[var(--color-brand-red)]">{t("onboarding.nicknameTaken")}</p>
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

        <div className="flex flex-col gap-2 rounded-md border border-[var(--color-border-gray)] p-3">
          <label className="flex items-center gap-2 border-b border-[var(--color-border-gray-light)] pb-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={allAgreed}
              onChange={(e) => handleAgreeAllToggle(e.target.checked)}
              className="accent-[var(--color-brand-red)]"
            />
            {t("onboarding.agreeAll")}
          </label>

          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={agreeTerms}
              onChange={(e) => setAgreeTerms(e.target.checked)}
              className="accent-[var(--color-brand-red)]"
            />
            <span className="text-[var(--color-brand-red)]">[{t("onboarding.required")}]</span>
            <Link href="/terms" target="_blank" className="flex-1 underline">
              {t("onboarding.agreeTerms")}
            </Link>
          </label>

          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={agreePrivacy}
              onChange={(e) => setAgreePrivacy(e.target.checked)}
              className="accent-[var(--color-brand-red)]"
            />
            <span className="text-[var(--color-brand-red)]">[{t("onboarding.required")}]</span>
            <Link href="/privacy" target="_blank" className="flex-1 underline">
              {t("onboarding.agreePrivacy")}
            </Link>
          </label>

          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={agreeAge14}
              onChange={(e) => setAgreeAge14(e.target.checked)}
              className="accent-[var(--color-brand-red)]"
            />
            <span className="text-[var(--color-brand-red)]">[{t("onboarding.required")}]</span>
            <span className="flex-1">{t("onboarding.agreeAge14")}</span>
          </label>
        </div>

        {error && <p className="text-xs text-[var(--color-brand-red)]">{error}</p>}

        <button
          type="submit"
          disabled={submitting || !allAgreed}
          className="h-11 rounded-md bg-[var(--color-brand-red)] text-sm font-semibold text-white disabled:opacity-50"
        >
          {t("onboarding.submit")}
        </button>
      </form>
    </div>
  );
}
