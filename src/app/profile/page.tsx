"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth, type Profile } from "@/lib/auth/AuthProvider";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import type { DictionaryKey } from "@/lib/i18n/dictionaries";
import { COUNTRIES, SIGNUP_COUNTRIES } from "@/lib/constants/countries";
import { createClient } from "@/lib/supabase/client";
import { fetchPostCountByAuthor } from "@/lib/supabase/posts";
import { fetchCommentCountByAuthor } from "@/lib/supabase/comments";
import { fetchThreads } from "@/lib/supabase/messages";
import { Avatar } from "@/components/common/Avatar";
import type { CountryCode } from "@/lib/types";

function ProfileEditForm({ userId, profile }: { userId: string; profile: Profile }) {
  const { t } = useLanguage();
  const router = useRouter();
  const [nickname, setNickname] = useState(profile.nickname);
  const [country, setCountry] = useState<CountryCode>(profile.country as CountryCode);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("profiles")
        .update({ nickname, country })
        .eq("id", userId);
      if (error) throw error;
      setMessage("저장되었습니다.");
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSave} className="flex flex-col gap-3 rounded-lg border border-[var(--color-border-gray)] p-4">
      <p className="text-sm font-semibold">{t("profile.edit")}</p>
      <input
        value={nickname}
        onChange={(e) => setNickname(e.target.value)}
        className="h-10 rounded-md border border-[var(--color-border-gray)] px-3 text-sm"
      />
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
      <Link href="/forgot-password" className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-brand-red)]">
        {t("auth.forgotPassword")}
      </Link>
      {message && <p className="text-xs">{message}</p>}
      <button
        type="submit"
        disabled={saving}
        className="h-10 rounded-md bg-[var(--color-brand-red)] text-sm font-medium text-white disabled:opacity-50"
      >
        {t("common.submit")}
      </button>
    </form>
  );
}

export default function MyProfilePage() {
  const { t } = useLanguage();
  const router = useRouter();
  const { user, profile, loading, signOut } = useAuth();
  const [stats, setStats] = useState({ posts: 0, comments: 0, messages: 0 });

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      fetchPostCountByAuthor(user.id),
      fetchCommentCountByAuthor(user.id),
      fetchThreads(user.id),
    ]).then(([posts, comments, threads]) => {
      setStats({ posts, comments, messages: threads.length });
    });
  }, [user]);

  if (loading || !user) {
    return <div className="px-4 py-16 text-center text-sm text-[var(--color-text-muted)]">{t("common.loading")}</div>;
  }

  async function handleWithdraw() {
    if (!confirm("정말 탈퇴하시겠습니까? 작성한 글과 댓글은 유지됩니다.")) return;
    const supabase = createClient();
    await supabase.from("profiles").update({ is_withdrawn: true }).eq("id", user!.id);
    await signOut();
    router.push("/");
  }

  const countryOption = profile ? COUNTRIES.find((c) => c.code === profile.country) : undefined;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 flex items-center gap-4">
        <Avatar nickname={profile?.nickname ?? "?"} avatarUrl={profile?.avatar_url ?? undefined} size={64} />
        <div>
          <p className="text-lg font-bold">{profile?.nickname}</p>
          <p className="text-sm text-[var(--color-text-muted)]">
            {countryOption?.flag} {countryOption && t(countryOption.labelKey as DictionaryKey)}
          </p>
          <p className="text-xs text-[var(--color-text-muted)]">{user.email}</p>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-3 gap-3 text-center">
        <div className="rounded-lg border border-[var(--color-border-gray)] py-4">
          <p className="text-lg font-bold">{stats.posts}</p>
          <p className="text-xs text-[var(--color-text-muted)]">{t("profile.myPosts")}</p>
        </div>
        <div className="rounded-lg border border-[var(--color-border-gray)] py-4">
          <p className="text-lg font-bold">{stats.comments}</p>
          <p className="text-xs text-[var(--color-text-muted)]">{t("profile.myComments")}</p>
        </div>
        <Link
          href="/messages"
          className="rounded-lg border border-[var(--color-border-gray)] py-4 hover:border-[var(--color-brand-red)]"
        >
          <p className="text-lg font-bold">{stats.messages}</p>
          <p className="text-xs text-[var(--color-text-muted)]">{t("profile.receivedMessages")}</p>
        </Link>
      </div>

      {profile && <ProfileEditForm key={profile.id} userId={user.id} profile={profile} />}

      <div className="mt-6 flex justify-between text-xs">
        <button
          onClick={async () => {
            await signOut();
            router.push("/");
          }}
          className="text-[var(--color-text-muted)] hover:text-[var(--foreground)]"
        >
          {t("profile.logout")}
        </button>
        <button onClick={handleWithdraw} className="text-[var(--color-text-muted)] hover:text-[var(--color-brand-red)]">
          {t("profile.withdraw")}
        </button>
      </div>
    </div>
  );
}
