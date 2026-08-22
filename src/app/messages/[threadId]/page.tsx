"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { fetchPublicProfile } from "@/lib/supabase/profiles";
import {
  fetchMessages,
  findOrCreateThread,
  sendMessage,
  type MessageRow,
} from "@/lib/supabase/messages";
import { NicknamePopup } from "@/components/common/NicknamePopup";
import { Avatar } from "@/components/common/Avatar";
import type { Author } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";

export default function ChatPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const params = useParams<{ threadId: string }>();
  const { user, loading } = useAuth();
  const partnerId = params.threadId;

  const [partner, setPartner] = useState<Author | null | undefined>(undefined);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  useEffect(() => {
    fetchPublicProfile(partnerId).then((p) => setPartner(p?.author ?? null));
  }, [partnerId]);

  useEffect(() => {
    if (!user || !partner) return;
    findOrCreateThread(user.id, partnerId).then((id) => {
      setThreadId(id);
      fetchMessages(id).then(setMessages);
    });
  }, [user, partner, partnerId]);

  if (partner === null) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center text-sm text-[var(--color-text-muted)]">
        {t("error.userNotFound")}
      </div>
    );
  }

  if (!user || !partner || !threadId) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center text-sm text-[var(--color-text-muted)]">
        {t("common.loading")}
      </div>
    );
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim() || !threadId || !user) return;
    setSending(true);
    try {
      await sendMessage(threadId, user.id, draft.trim());
      const updated = await fetchMessages(threadId);
      setMessages(updated);
      setDraft("");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-7rem)] max-w-2xl flex-col px-4 py-4">
      <div className="mb-3 flex items-center gap-2 border-b border-[var(--color-border-gray-light)] pb-3">
        <Avatar nickname={partner.nickname} avatarUrl={partner.avatarUrl} size={32} />
        <NicknamePopup author={partner} className="text-sm font-semibold" />
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto py-2">
        {messages.map((m) => {
          const mine = m.senderId === user.id;
          return (
            <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
              <div className={cn("max-w-[75%]", mine ? "items-end" : "items-start", "flex flex-col")}>
                <div
                  className={cn(
                    "rounded-2xl px-3.5 py-2 text-sm",
                    mine
                      ? "rounded-br-sm bg-[var(--color-brand-red)] text-white"
                      : "rounded-bl-sm bg-[var(--color-border-gray-light)] text-[var(--foreground)]",
                  )}
                >
                  {m.body}
                </div>
                <span className="mt-0.5 text-[10px] text-[var(--color-text-muted)]">
                  {formatDate(m.createdAt)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <form onSubmit={handleSend} className="flex gap-2 border-t border-[var(--color-border-gray-light)] pt-3">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t("messages.chatPlaceholder")}
          className="h-10 flex-1 rounded-md border border-[var(--color-border-gray)] px-3 text-sm outline-none focus:border-[var(--color-brand-red)]"
        />
        <button
          disabled={sending}
          className="relative rounded-md bg-[var(--color-brand-red)] px-4 text-sm font-medium text-white disabled:opacity-50 gg-glossy-btn"
        >
          {t("messages.send")}
        </button>
      </form>
    </div>
  );
}
