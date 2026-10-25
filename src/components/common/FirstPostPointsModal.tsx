"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { createClient } from "@/lib/supabase/client";
import type { Post } from "@/lib/types";

const TITLE_ID = "first-post-points-modal-title";

export function FirstPostPointsModal({ post }: { post: Post }) {
  const { user, profile, refreshProfile } = useAuth();
  const { t } = useLanguage();
  const [acknowledged, setAcknowledged] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const visible = Boolean(
    user &&
      profile &&
      !profile.points_ack_at &&
      post.author.id === user.id &&
      !acknowledged,
  );

  useEffect(() => {
    if (visible) buttonRef.current?.focus();
  }, [visible]);

  async function acknowledge() {
    setAcknowledged(true);
    if (!user) return;
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("profiles")
        .update({ points_ack_at: new Date().toISOString() })
        .eq("id", user.id);
      if (!error) await refreshProfile();
    } catch {
      // 1회성 안내라 실패해도 조용히 무시 — 다음 방문에 다시 뜰 수 있다.
    }
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={TITLE_ID}
        className="max-h-[calc(100dvh-2rem)] w-full max-w-sm overflow-y-auto rounded-lg bg-white p-5 shadow-xl"
      >
        <h2 id={TITLE_ID} className="mb-1 text-sm font-bold">
          {t("welcome.firstPostThanks")}
        </h2>
        <h3 className="mb-2 text-xs font-bold text-[var(--color-text-muted)]">
          {t("points.infoTitle")}
        </h3>
        <p className="mb-4 whitespace-pre-line text-xs leading-relaxed text-[var(--color-text-muted)]">
          {t("points.infoBody")}
        </p>
        <button
          ref={buttonRef}
          type="button"
          onClick={() => void acknowledge()}
          className="relative h-10 w-full rounded-md bg-[var(--color-brand-red)] text-sm font-medium text-white gg-glossy-btn"
        >
          {t("welcome.understood")}
        </button>
      </div>
    </div>
  );
}
