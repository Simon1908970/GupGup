"use client";

import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { AuthTabs } from "@/components/auth/AuthTabs";
import { getErrorMessage } from "@/lib/utils";

export default function SignupPage() {
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError(t("signup.passwordMismatch"));
      return;
    }
    setLoading(true);
    try {
      const supabase = createClient();
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        // The confirmation link comes back with a PKCE ?code that only the
        // /auth/callback route can exchange for a session; it then forwards
        // to /onboarding (or / if a profile already exists).
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (signUpError) throw signUpError;
      setDone(true);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="mx-auto max-w-sm px-4 py-16 text-center">
        <p className="text-sm">
          {t("signup.verificationSent")}
        </p>
        <Link
          href="/login"
          className="relative mt-6 inline-block rounded-md bg-[var(--color-brand-red)] px-5 py-2 text-sm font-medium text-white gg-glossy-btn"
        >
          {t("auth.login")}
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-4 px-4 py-10">
      <AuthTabs active="signup" />
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t("auth.emailPlaceholder")}
          className="h-11 rounded-md border border-[var(--color-border-gray)] px-3 text-sm outline-none focus:border-[var(--color-brand-red)]"
        />
        <input
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t("auth.passwordPlaceholder")}
          className="h-11 rounded-md border border-[var(--color-border-gray)] px-3 text-sm outline-none focus:border-[var(--color-brand-red)]"
        />
        <input
          type="password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder={t("signup.passwordConfirmPlaceholder")}
          className="h-11 rounded-md border border-[var(--color-border-gray)] px-3 text-sm outline-none focus:border-[var(--color-brand-red)]"
        />
        {error && <p className="text-xs text-[var(--color-brand-red)]">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="relative h-11 rounded-md bg-[var(--color-brand-red)] text-sm font-semibold text-white disabled:opacity-50 gg-glossy-btn"
        >
          {t("auth.signup")}
        </button>
      </form>
    </div>
  );
}
