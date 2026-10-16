"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { deleteThread, fetchThreads, type ThreadWithPartner } from "@/lib/supabase/messages";
import { Avatar } from "@/components/common/Avatar";
import { ConfirmModal } from "@/components/common/ConfirmModal";
import { DeleteButton } from "@/components/common/DeleteButton";
import { formatDate, getErrorMessage } from "@/lib/utils";

export default function MessagesListPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const { user, loading } = useAuth();
  const [threads, setThreads] = useState<ThreadWithPartner[]>([]);
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [pendingDelete, setPendingDelete] = useState<ThreadWithPartner | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    fetchThreads(user.id)
      .then(setThreads)
      .finally(() => setLoadingThreads(false));
  }, [user]);

  async function handleConfirmDelete() {
    if (!pendingDelete) return;
    const { threadId } = pendingDelete;
    setPendingDelete(null);
    setDeleteError(null);
    try {
      await deleteThread(threadId);
      setThreads((prev) => prev.filter((t) => t.threadId !== threadId));
    } catch (err) {
      setDeleteError(getErrorMessage(err));
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="mb-4 text-lg font-bold">{t("messages.title")}</h1>
      {deleteError && (
        <p className="mb-3 text-xs text-[var(--color-brand-red)]">{deleteError}</p>
      )}
      {loadingThreads ? (
        <p className="py-16 text-center text-sm text-[var(--color-text-muted)]">
          {t("common.loading")}
        </p>
      ) : threads.length === 0 ? (
        <p className="py-16 text-center text-sm text-[var(--color-text-muted)]">
          {t("messages.empty")}
        </p>
      ) : (
        <ul className="relative divide-y divide-[var(--color-border-gray-light)] rounded-lg border border-[var(--color-border-gray)] gg-glossy">
          {threads.map((thread) => {
            const { threadId, partner, lastMessage } = thread;
            return (
              <li key={threadId} className="flex items-center">
                <Link
                  href={`/messages/${partner.id}`}
                  className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 hover:bg-[var(--color-border-gray-light)]/60"
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
                <DeleteButton onClick={() => setPendingDelete(thread)} className="mr-3" />
              </li>
            );
          })}
        </ul>
      )}
      {pendingDelete && (
        <ConfirmModal
          message={t("post.deleteConfirm")}
          onConfirm={handleConfirmDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
}
