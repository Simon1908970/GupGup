"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { CATEGORIES } from "@/lib/constants/categories";
import { SIGNUP_COUNTRIES } from "@/lib/constants/countries";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import type { DictionaryKey } from "@/lib/i18n/dictionaries";
import type { CategorySlug, CountryCode } from "@/lib/types";
import { useAuth } from "@/lib/auth/AuthProvider";
import { createPost, InsufficientPointsError } from "@/lib/supabase/posts";
import { isPremiumPostTarget, PREMIUM_POST_COST } from "@/lib/constants/points";
import { getErrorMessage } from "@/lib/utils";

function isValidCategory(v: string): v is CategorySlug {
  return v in CATEGORIES;
}

export default function WritePostPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const params = useParams<{ category: string }>();
  const { user, profile, refreshProfile } = useAuth();
  const categorySlug = params.category;
  const config = isValidCategory(categorySlug) ? CATEGORIES[categorySlug] : null;

  const [subCategory, setSubCategory] = useState(config?.subCategories?.[0]?.slug ?? "");
  const isPremium = config ? isPremiumPostTarget(config.slug, config.subCategories ? subCategory : undefined) : false;
  const insufficientPoints = isPremium && (profile?.points ?? 0) < PREMIUM_POST_COST;
  const [country, setCountry] = useState<CountryCode>(
    (profile?.country as CountryCode) ?? "vn",
  );
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!config) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center text-sm text-[var(--color-text-muted)]">
        {t("error.categoryNotFound")}
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !body.trim() || !user) return;
    if (insufficientPoints) {
      setError(t("points.insufficientError"));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const postId = await createPost({
        category: config!.slug,
        subCategory: config!.subCategories ? subCategory : undefined,
        country,
        title: title.trim(),
        body: body.trim(),
        authorId: user.id,
      });
      await refreshProfile();
      router.push(`/board/${config!.slug}/${postId}`);
    } catch (err) {
      setError(err instanceof InsufficientPointsError ? t("points.insufficientError") : getErrorMessage(err));
      setSubmitting(false);
    }
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center text-sm text-[var(--color-text-muted)]">
        {t("auth.needVerification")}
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center text-sm text-[var(--color-text-muted)]">
        {t("write.needProfile")}{" "}
        <button onClick={() => router.push("/onboarding")} className="text-[var(--color-brand-red)] underline">
          {t("write.goToOnboarding")}
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="mb-1 text-lg font-bold">
        {t(config.labelKey as DictionaryKey)} · {t("board.write")}
      </h1>
      <p className="mb-4 text-xs text-[var(--color-text-muted)]">
        {t("points.balanceLabel")} {profile.points}P
      </p>
      {isPremium && (
        <p className="mb-4 rounded-md border border-[var(--color-brand-red)] bg-[var(--color-brand-red-light)] px-3 py-2 text-xs text-[var(--color-brand-red)]">
          {t("points.premiumNotice")}
        </p>
      )}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {config.subCategories && (
          <select
            value={subCategory}
            onChange={(e) => setSubCategory(e.target.value)}
            className="h-10 rounded-md border border-[var(--color-border-gray)] px-3 text-sm"
          >
            {config.subCategories.map((sub) => (
              <option key={sub.slug} value={sub.slug}>
                {t(sub.labelKey as DictionaryKey)}
              </option>
            ))}
          </select>
        )}

        {config.hasCountryTag && (
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value as CountryCode)}
            className="h-10 rounded-md border border-[var(--color-border-gray)] px-3 text-sm"
          >
            {SIGNUP_COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.flag} {t(c.labelKey as DictionaryKey)}
              </option>
            ))}
          </select>
        )}

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t("placeholder.title")}
          className="h-10 rounded-md border border-[var(--color-border-gray)] px-3 text-sm outline-none focus:border-[var(--color-brand-red)]"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={t("placeholder.content")}
          rows={12}
          className="resize-none rounded-md border border-[var(--color-border-gray)] p-3 text-sm outline-none focus:border-[var(--color-brand-red)]"
        />

        {error && <p className="text-xs text-[var(--color-brand-red)]">{error}</p>}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-md border border-[var(--color-border-gray)] px-5 py-2 text-sm"
          >
            {t("common.cancel")}
          </button>
          <button
            type="submit"
            disabled={submitting || insufficientPoints}
            className="relative rounded-md bg-[var(--color-brand-red)] px-5 py-2 text-sm font-medium text-white disabled:opacity-50 gg-glossy-btn"
          >
            {t("common.submit")}
          </button>
        </div>
      </form>
    </div>
  );
}
