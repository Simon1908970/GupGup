"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { MOCK_INQUIRIES, type InquiryMessage } from "@/lib/mock/inquiries";
import { cn, formatDate } from "@/lib/utils";

export default function InquiryDetailPage() {
  const { t } = useLanguage();
  const params = useParams<{ id: string }>();
  const inquiry = MOCK_INQUIRIES.find((i) => i.id === params.id);
  const [messages, setMessages] = useState<InquiryMessage[]>(inquiry?.messages ?? []);
  const [draft, setDraft] = useState("");

  if (!inquiry) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center text-sm text-[var(--color-text-muted)]">
        문의를 찾을 수 없습니다.
      </div>
    );
  }

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    setMessages((prev) => [
      ...prev,
      {
        id: `local-${prev.length}`,
        senderType: "user",
        body: draft.trim(),
        createdAt: new Date().toISOString(),
      },
    ]);
    setDraft("");
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-7rem)] max-w-2xl flex-col px-4 py-4">
      <div className="mb-3 border-b border-[var(--color-border-gray-light)] pb-3">
        <p className="text-sm font-semibold">{inquiry.title}</p>
        <p className="text-xs text-[var(--color-text-muted)]">{t("inquiries.team")}</p>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto py-2">
        {messages.map((m) => {
          const mine = m.senderType === "user";
          return (
            <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
              <div className="flex max-w-[75%] flex-col">
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
        <button className="rounded-md bg-[var(--color-brand-red)] px-4 text-sm font-medium text-white">
          {t("messages.send")}
        </button>
      </form>
    </div>
  );
}
