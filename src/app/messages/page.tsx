"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { fetchThreads, type ThreadWithPartner } from "@/lib/supabase/messages";
import { Avatar } from "@/components/common/Avatar";
import { formatDate } from "@/lib/utils";

export default function MessagesListPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const { user, loading } = useAuth();
  const [threads, setThreads] = useState<ThreadWithPartner[]>([]);
  const [loadingThreads, setLoadingThreads] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    fetchThreads(user.id)
      .then(setThreads)
      .finally(() => setLoadingThreads(false));
  }, [user]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="mb-4 text-lg font-bold">{t("messages.title")}</h1>
      {loadingThreads ? (
        <p className="py-16 text-center text-sm text-[var(--color-text-muted)]">
          {t("common.loading")}
        </p>
      ) : threads.length === 0 ? (
        <p className="py-16 text-center text-sm text-[var(--color-text-muted)]">
          {t("messages.empty")}
        </p>
      ) : (
        <ul className="divide-y divide-[var(--color-border-gray-light)] rounded-lg border border-[var(--color-border-gray)]">
          {threads.map(({ threadId, partner, lastMessage }) => (
            <li key={threadId}>
              <Link
                href={`/messages/${partner.id}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--color-border-gray-light)]/60"
              >
                <Avatar nickname={partner.nickname} avatarUrl={partner.avatarUrl} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{partner.nickname}</p>
                  <p className="truncate text-xs text-[var(--color-text-muted)]">
                    {lastMessage?.body}
                  </p>
                </div>
                {lastMessage && (
                  <span className="shrink-0 text-xs text-[var(--color-text-muted)]">
                    {formatDate(lastMessage.createdAt)}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
