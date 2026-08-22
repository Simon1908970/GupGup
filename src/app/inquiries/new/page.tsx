"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { createInquiry } from "@/lib/supabase/inquiries";
import { getErrorMessage } from "@/lib/utils";

export default function NewInquiryPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !body.trim() || !user) return;
    setSubmitting(true);
    setError(null);
    try {
      const id = await createInquiry(user.id, title.trim(), body.trim());
      router.push(`/inquiries/${id}`);
    } catch (err) {
      setError(getErrorMessage(err));
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

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="mb-4 text-lg font-bold">{t("inquiries.new")}</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t("placeholder.title")}
          className="h-10 rounded-md border border-[var(--color-border-gray)] px-3 text-sm outline-none focus:border-[var(--color-brand-red)]"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={t("inquiries.contentPlaceholder")}
          rows={8}
          className="resize-none rounded-md border border-[var(--color-border-gray)] p-3 text-sm outline-none focus:border-[var(--color-brand-red)]"
        />
        {error && <p className="text-xs text-[var(--color-brand-red)]">{error}</p>}
        <button
          disabled={submitting}
          className="relative h-11 rounded-md bg-[var(--color-brand-red)] text-sm font-semibold text-white disabled:opacity-50 gg-glossy-btn"
        >
          {t("common.submit")}
        </button>
      </form>
    </div>
  );
}
