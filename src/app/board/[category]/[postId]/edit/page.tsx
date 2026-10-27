"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CATEGORIES } from "@/lib/constants/categories";
import { SIGNUP_COUNTRIES } from "@/lib/constants/countries";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import type { DictionaryKey } from "@/lib/i18n/dictionaries";
import type { Attachment, CategorySlug, CountryCode, Post } from "@/lib/types";
import { useAuth } from "@/lib/auth/AuthProvider";
import { fetchPostById, updatePost } from "@/lib/supabase/posts";
import { getErrorMessage } from "@/lib/utils";
import { useProfanityCheck } from "@/lib/moderation/useProfanityCheck";
import { PostAttachmentInput } from "@/components/board/PostAttachmentInput";
import { AddressPicker } from "@/components/board/AddressPicker";

function isValidCategory(v: string): v is CategorySlug {
  return v in CATEGORIES;
}

export default function EditPostPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const params = useParams<{ category: string; postId: string }>();
  const { user, loading: authLoading } = useAuth();
  const categorySlug = params.category;
  const config = isValidCategory(categorySlug) ? CATEGORIES[categorySlug] : null;

  const [post, setPost] = useState<Post | null | undefined>(undefined);
  const [country, setCountry] = useState<CountryCode>("vn");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showOnMap, setShowOnMap] = useState(false);
  const [businessAddress, setBusinessAddress] = useState("");
  const [businessDetailAddress, setBusinessDetailAddress] = useState("");
  const hasProfanity = useProfanityCheck(`${title} ${body}`);

  useEffect(() => {
    if (!config) return;
    fetchPostById(config.slug, params.postId).then((data) => {
      setPost(data);
      if (data) {
        setCountry(data.country);
        setTitle(data.title);
        setBody(data.body);
        setAttachments(data.attachments);
        setShowOnMap(data.showOnMap ?? false);
        setBusinessAddress(data.businessAddress ?? "");
        setBusinessDetailAddress(data.businessDetailAddress ?? "");
      }
    });
  }, [config, params.postId]);

  if (!config || config.slug === "news" || post === null) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center text-sm text-[var(--color-text-muted)]">
        {t("error.postNotFound")}
      </div>
    );
  }

  if (authLoading || post === undefined) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center text-sm text-[var(--color-text-muted)]">
        {t("common.loading")}
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center text-sm text-[var(--color-text-muted)]">
        {t("auth.needVerification")}
      </div>
    );
  }

  if (post.author.id !== user.id) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center text-sm text-[var(--color-text-muted)]">
        {t("error.notPostAuthor")}
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !body.trim() || !user || !post || hasProfanity) return;
    if (showOnMap && !businessAddress.trim()) {
      setError(t("map.addressPlaceholder"));
      return;
    }

    setSubmitting(true);
    setError(null);

    let businessLat = post.businessLat;
    let businessLng = post.businessLng;

    if (showOnMap && businessAddress.trim() && businessAddress.trim() !== post.businessAddress) {
      try {
        const res = await fetch("/api/geocode", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address: businessAddress.trim() }),
        });
        if (!res.ok) throw new Error("geocode failed");
        const coords = (await res.json()) as { lat: number; lng: number };
        businessLat = coords.lat;
        businessLng = coords.lng;
      } catch {
        setSubmitting(false);
        setError(t("map.geocodeError"));
        return;
      }
    }

    try {
      await updatePost({
        id: post.id,
        authorId: user.id,
        country,
        title: title.trim(),
        body: body.trim(),
        attachments,
        showOnMap,
        businessAddress: showOnMap ? businessAddress.trim() : undefined,
        businessDetailAddress: showOnMap ? businessDetailAddress.trim() || undefined : undefined,
        businessLat,
        businessLng,
      });
      router.push(`/board/${config!.slug}/${post.id}`);
    } catch (err) {
      setError(getErrorMessage(err));
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="mb-4 text-lg font-bold">
        {t(config.labelKey as DictionaryKey)} · {t("common.edit")}
      </h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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

        <PostAttachmentInput
          value={attachments}
          onChange={setAttachments}
          onError={setError}
        />

        {config.slug === "life" && (
          <div className="flex flex-col gap-2 rounded-md border border-[var(--color-border-gray-light)] p-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={showOnMap}
                onChange={(e) => setShowOnMap(e.target.checked)}
              />
              {t("map.showOnMapLabel")}
            </label>
            {showOnMap && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={businessAddress}
                    placeholder={t("map.addressPlaceholder")}
                    className="min-w-0 flex-1 rounded-md border border-[var(--color-border-gray-light)] px-3 py-1.5 text-sm"
                  />
                  <AddressPicker onSelect={setBusinessAddress} />
                </div>
                <input
                  type="text"
                  value={businessDetailAddress}
                  onChange={(e) => setBusinessDetailAddress(e.target.value)}
                  placeholder={t("map.detailAddressLabel")}
                  className="rounded-md border border-[var(--color-border-gray-light)] px-3 py-1.5 text-sm"
                />
              </div>
            )}
          </div>
        )}

        {hasProfanity && (
          <p className="text-xs text-[var(--color-brand-red)]">{t("moderation.profanityWarning")}</p>
        )}
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
            disabled={submitting || hasProfanity}
            className="relative rounded-md bg-[var(--color-brand-red)] px-5 py-2 text-sm font-medium text-white disabled:opacity-50 gg-glossy-btn"
          >
            {t("common.edit")}
          </button>
        </div>
      </form>
    </div>
  );
}
