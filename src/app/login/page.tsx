"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

export default function LoginPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleOAuth(provider: "google" | "facebook") {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) throw signInError;
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-4 px-4 py-10">
      <h1 className="text-center text-xl font-bold">{t("auth.login")}</h1>

      <button
        onClick={() => handleOAuth("google")}
        className="h-11 rounded-md border border-[var(--color-border-gray)] text-sm font-medium"
      >
        {t("auth.google")}
      </button>
      <button
        onClick={() => handleOAuth("facebook")}
        className="h-11 rounded-md border border-[var(--color-border-gray)] text-sm font-medium"
      >
        {t("auth.facebook")}
      </button>

      <div className="my-1 flex items-center gap-3 text-xs text-[var(--color-text-muted)]">
        <div className="h-px flex-1 bg-[var(--color-border-gray-light)]" />
        {t("auth.email")}
        <div className="h-px flex-1 bg-[var(--color-border-gray-light)]" />
      </div>

      <form onSubmit={handleEmailLogin} className="flex flex-col gap-3">
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
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t("auth.passwordPlaceholder")}
          className="h-11 rounded-md border border-[var(--color-border-gray)] px-3 text-sm outline-none focus:border-[var(--color-brand-red)]"
        />
        {error && <p className="text-xs text-[var(--color-brand-red)]">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="h-11 rounded-md bg-[var(--color-brand-red)] text-sm font-semibold text-white disabled:opacity-50"
        >
          {t("auth.login")}
        </button>
      </form>

      <div className="flex justify-center gap-3 text-xs text-[var(--color-text-muted)]">
        <Link href="/signup" className="hover:text-[var(--color-brand-red)]">
          {t("auth.signup")}
        </Link>
        <span>·</span>
        <Link href="/forgot-password" className="hover:text-[var(--color-brand-red)]">
          {t("auth.forgotPassword")}
        </Link>
      </div>
      <p className="text-center text-[11px] text-[var(--color-text-muted)]">
        {t("auth.noFindId")}
      </p>
    </div>
  );
}
