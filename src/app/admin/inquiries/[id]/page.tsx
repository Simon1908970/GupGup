"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { cn, formatDate } from "@/lib/utils";

interface InquiryMessage {
  id: string;
  sender_type: "user" | "admin";
  body: string;
  created_at: string;
}

export default function AdminInquiryThreadPage() {
  const params = useParams<{ id: string }>();
  const [messages, setMessages] = useState<InquiryMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  function load() {
    fetch(`/api/admin/inquiries/${params.id}/messages`)
      .then((r) => r.json())
      .then((data) => setMessages(data.messages ?? []));
  }

  useEffect(load, [params.id]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    setSending(true);
    try {
      await fetch(`/api/admin/inquiries/${params.id}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: draft.trim() }),
      });
      setDraft("");
      load();
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col gap-3">
      <Link href="/admin/inquiries" className="text-xs text-[var(--color-text-muted)]">
        ← 목록으로
      </Link>

      <div className="flex-1 space-y-3 overflow-y-auto py-2">
        {messages.map((m) => {
          const isAdmin = m.sender_type === "admin";
          return (
            <div key={m.id} className={cn("flex", isAdmin ? "justify-end" : "justify-start")}>
              <div className="flex max-w-[75%] flex-col">
                {isAdmin && (
                  <span className="mb-0.5 self-end text-[10px] text-[var(--color-text-muted)]">
                    Gup Gup 운영팀
                  </span>
                )}
                <div
                  className={cn(
                    "rounded-2xl px-3.5 py-2 text-sm",
                    isAdmin
                      ? "rounded-br-sm bg-[var(--color-brand-red)] text-white"
                      : "rounded-bl-sm bg-[var(--color-border-gray-light)] text-[var(--foreground)]",
                  )}
                >
                  {m.body}
                </div>
                <span className="mt-0.5 text-[10px] text-[var(--color-text-muted)]">
                  {formatDate(m.created_at)}
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
          placeholder="답변을 입력하세요"
          className="h-10 flex-1 rounded-md border border-[var(--color-border-gray)] px-3 text-sm outline-none focus:border-[var(--color-brand-red)]"
        />
        <button
          disabled={sending}
          className="relative rounded-md bg-[var(--color-brand-red)] px-4 text-sm font-medium text-white disabled:opacity-50 gg-glossy-btn"
        >
          전송
        </button>
      </form>
    </div>
  );
}
