"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Pencil, Settings, Star } from "lucide-react";
import { useAuth, type Profile } from "@/lib/auth/AuthProvider";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import type { DictionaryKey } from "@/lib/i18n/dictionaries";
import { COUNTRIES, SIGNUP_COUNTRIES } from "@/lib/constants/countries";
import { createClient } from "@/lib/supabase/client";
import { fetchPostCountByAuthor } from "@/lib/supabase/posts";
import { fetchCommentCountByAuthor } from "@/lib/supabase/comments";
import { fetchThreads } from "@/lib/supabase/messages";
import { Avatar } from "@/components/common/Avatar";
import { EditableAvatar } from "@/components/common/EditableAvatar";
import { DefaultAvatarPicker } from "@/components/common/DefaultAvatarPicker";
import { PointsInfo } from "@/components/common/PointsInfo";
import type { CountryCode } from "@/lib/types";
import { getErrorMessage } from "@/lib/utils";

function ProfileHeader({
  userId,
  profile,
  email,
}: {
  userId: string;
  profile: Profile;
  email: string;
}) {
  const { t } = useLanguage();
  const router = useRouter();
  const { refreshProfile, signOut } = useAuth();
  const [editing, setEditing] = useState(false);
  const [nickname, setNickname] = useState(profile.nickname);
  const [country, setCountry] = useState<CountryCode>(profile.country as CountryCode);
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url ?? undefined);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [accountMenuStep, setAccountMenuStep] = useState<"root" | "options">("root");
  const [completion, setCompletion] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const countryOption = COUNTRIES.find((c) => c.code === profile.country);
  const accountMenuRef = useRef<HTMLDivElement>(null);

  function closeAccountMenu() {
    setAccountMenuOpen(false);
    setAccountMenuStep("root");
  }

  useEffect(() => {
    if (!accountMenuOpen) return;
    function onClickOutside(e: MouseEvent) {
      if (accountMenuRef.current && !accountMenuRef.current.contains(e.target as Node)) {
        closeAccountMenu();
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [accountMenuOpen]);

  function handleLogoutClick() {
    setCompletion({
      message: t("profile.logoutComplete"),
      onConfirm: async () => {
        await signOut();
        router.push("/");
        router.refresh();
      },
    });
  }

  async function handleWithdrawClick() {
    if (!confirm(t("profile.withdrawConfirm"))) return;
    const supabase = createClient();
    await supabase.from("profiles").update({ is_withdrawn: true }).eq("id", userId);
    setCompletion({
      message: t("profile.withdrawComplete"),
      onConfirm: async () => {
        await signOut();
        router.push("/");
        router.refresh();
      },
    });
  }

  function handleAvatarUploaded(url: string) {
    setAvatarUrl(url);
    refreshProfile();
  }

  async function handleDefaultAvatarSelect(url: string) {
    setMessage(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", userId);
      if (error) throw error;
      handleAvatarUploaded(url);
    } catch (err) {
      setMessage(getErrorMessage(err));
    }
  }

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
      router.refresh();
      setEditing(false);
    } catch (err) {
      setMessage(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <>
      <form
        onSubmit={handleSave}
        className="relative mb-6 flex flex-col gap-3 rounded-lg border border-[var(--color-border-gray)] p-4 gg-glossy"
      >
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">{t("profile.edit")}</p>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="text-xs text-[var(--color-text-muted)] hover:text-[var(--foreground)]"
          >
            {t("common.cancel")}
          </button>
        </div>

        <div className="flex items-center gap-4">
          <EditableAvatar
            nickname={profile.nickname}
            avatarUrl={avatarUrl}
            size={64}
            onUploaded={handleAvatarUploaded}
            onError={setMessage}
          />
          <div className="flex flex-1 items-center justify-between gap-2">
            <div>
              <p className="text-xs text-[var(--color-text-muted)]">{email}</p>
              <p className="mt-1 flex items-center gap-1 text-xs">
                <Star size={12} className="fill-[var(--color-badge-yellow)] text-[var(--color-badge-yellow)]" />
                <span className="text-[var(--color-text-muted)]">{t("profile.points")}</span>
                <PointsInfo />
                <span className="font-semibold">{profile.points}</span>
              </p>
            </div>
            <div className="relative" ref={accountMenuRef}>
              <button
                type="button"
                onClick={() => setAccountMenuOpen((v) => !v)}
                aria-label={t("profile.accountManagement")}
                className="shrink-0 rounded-md p-1.5 text-black hover:bg-[var(--color-border-gray-light)]"
              >
                <Settings size={14} />
              </button>
              {accountMenuOpen && (
                <div className="absolute right-0 top-full z-40 mt-1 w-36 overflow-hidden rounded-md border border-[var(--color-border-gray)] bg-white text-left shadow-lg gg-glossy">
                  {accountMenuStep === "root" ? (
                    <button
                      type="button"
                      onClick={() => setAccountMenuStep("options")}
                      className="block w-full px-4 py-2 text-left text-xs hover:bg-[var(--color-border-gray-light)]"
                    >
                      {t("profile.accountManagement")}
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          closeAccountMenu();
                          handleLogoutClick();
                        }}
                        className="block w-full px-4 py-2 text-left text-xs hover:bg-[var(--color-border-gray-light)]"
                      >
                        {t("profile.logout")}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          closeAccountMenu();
                          handleWithdrawClick();
                        }}
                        className="block w-full border-t border-[var(--color-border-gray-light)] px-4 py-2 text-left text-xs text-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-light)]"
                      >
                        {t("profile.withdraw")}
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-xs text-[var(--color-text-muted)]">{t("profile.avatarHint")}</p>
          <DefaultAvatarPicker
            selected={avatarUrl?.split("?")[0] ?? null}
            onSelect={handleDefaultAvatarSelect}
          />
        </div>

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
        {message && <p className="text-xs text-[var(--color-brand-red)]">{message}</p>}
        <button
          type="submit"
          disabled={saving}
          className="relative h-10 rounded-md bg-[var(--color-brand-red)] text-sm font-medium text-white disabled:opacity-50 gg-glossy-btn"
        >
          {t("common.submit")}
        </button>
      </form>
      {completion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-xl">
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <p className="text-sm font-medium">{completion.message}</p>
              <button
                onClick={completion.onConfirm}
                className="relative rounded bg-[var(--color-brand-red)] px-4 py-2 text-sm font-medium text-white gg-glossy-btn"
              >
                {t("common.confirm")}
              </button>
            </div>
          </div>
        </div>
      )}
      </>
    );
  }

  return (
    <div className="mb-6">
      <div className="flex items-center gap-4">
        <Avatar nickname={profile.nickname} avatarUrl={avatarUrl} size={64} />
        <div className="flex-1">
          <p className="text-lg font-bold">{profile.nickname}</p>
          <p className="text-sm text-[var(--color-text-muted)]">
            {countryOption?.flag} {countryOption && t(countryOption.labelKey as DictionaryKey)}
          </p>
          <p className="text-xs text-[var(--color-text-muted)]">{email}</p>
          <p className="mt-1 flex items-center gap-1 text-xs">
            <Star size={12} className="fill-[var(--color-badge-yellow)] text-[var(--color-badge-yellow)]" />
            <span className="text-[var(--color-text-muted)]">{t("profile.points")}</span>
            <PointsInfo />
            <span className="font-semibold">{profile.points}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label={t("profile.edit")}
          className="rounded-md p-2 text-[var(--color-text-muted)] hover:bg-[var(--color-border-gray-light)] hover:text-[var(--color-brand-red)]"
        >
          <Pencil size={16} />
        </button>
      </div>
    </div>
  );
}

export default function MyProfilePage() {
  const { t } = useLanguage();
  const router = useRouter();
  const { user, profile, loading } = useAuth();
  const [stats, setStats] = useState({ posts: 0, comments: 0, messages: 0 });
  const wasAuthedRef = useRef(false);

  useEffect(() => {
    if (user) wasAuthedRef.current = true;
  }, [user]);

  useEffect(() => {
    // Only bounce to /login for a page load that was never authenticated.
    // A logged-in -> logged-out transition here means the user just hit
    // logout/withdraw, which already navigates itself (usually to "/").
    if (!loading && !user && !wasAuthedRef.current) router.replace("/login");
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

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      {profile && <ProfileHeader userId={user.id} profile={profile} email={user.email ?? ""} />}

      <div className="mb-6 grid grid-cols-3 gap-3 text-center">
        <Link
          href="/profile/posts"
          className="relative rounded-lg border border-[var(--color-border-gray)] py-4 hover:border-[var(--color-brand-red)] gg-glossy-interactive"
        >
          <p className="text-lg font-bold">{stats.posts}</p>
          <p className="text-xs text-[var(--color-text-muted)]">{t("profile.myPosts")}</p>
        </Link>
        <Link
          href="/profile/comments"
          className="relative rounded-lg border border-[var(--color-border-gray)] py-4 hover:border-[var(--color-brand-red)] gg-glossy-interactive"
        >
          <p className="text-lg font-bold">{stats.comments}</p>
          <p className="text-xs text-[var(--color-text-muted)]">{t("profile.myComments")}</p>
        </Link>
        <Link
          href="/messages"
          className="relative rounded-lg border border-[var(--color-border-gray)] py-4 hover:border-[var(--color-brand-red)] gg-glossy-interactive"
        >
          <p className="text-lg font-bold">{stats.messages}</p>
          <p className="text-xs text-[var(--color-text-muted)]">{t("profile.receivedMessages")}</p>
        </Link>
      </div>
    </div>
  );
}
