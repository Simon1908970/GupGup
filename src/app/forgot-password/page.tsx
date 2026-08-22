"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { getErrorMessage } from "@/lib/utils";

export default function ForgotPasswordPage() {
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const supabase = createClient();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
      });
      if (resetError) throw resetError;
      setSent(true);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-4 px-4 py-16">
      <h1 className="text-center text-xl font-bold">{t("forgotPassword.title")}</h1>
      {sent ? (
        <p className="text-center text-sm text-[var(--color-text-muted)]">
          {t("forgotPassword.sent")}
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("auth.emailPlaceholder")}
            className="h-11 rounded-md border border-[var(--color-border-gray)] px-3 text-sm outline-none focus:border-[var(--color-brand-red)]"
          />
          {error && <p className="text-xs text-[var(--color-brand-red)]">{error}</p>}
          <button className="relative h-11 rounded-md bg-[var(--color-brand-red)] text-sm font-semibold text-white gg-glossy-btn">
            {t("forgotPassword.submit")}
          </button>
        </form>
      )}
    </div>
  );
}
