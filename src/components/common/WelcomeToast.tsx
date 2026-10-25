"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { createClient } from "@/lib/supabase/client";

const AUTO_DISMISS_MS = 6000;

export function WelcomeToast() {
  const { user, profile, refreshProfile } = useAuth();
  const { t } = useLanguage();
  const [dismissed, setDismissed] = useState(false);

  const visible = Boolean(user && profile && !profile.welcomed_at && !dismissed);

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => {
      void dismiss();
    }, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  async function dismiss() {
    setDismissed(true);
    if (!user) return;
    try {
      const supabase = createClient();
      await supabase
        .from("profiles")
        .update({ welcomed_at: new Date().toISOString() })
        .eq("id", user.id);
      await refreshProfile();
    } catch {
      // 1회성 안내라 실패해도 조용히 무시 — 다음 방문에 다시 뜰 수 있다.
    }
  }

  if (!visible) return null;

  return (
    <div className="fixed left-1/2 top-20 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 rounded-lg border border-[var(--color-border-gray)] bg-white p-4 text-sm shadow-lg">
      <button
        type="button"
        onClick={() => void dismiss()}
        aria-label={t("common.close")}
        className="absolute right-2 top-2 text-[var(--color-text-muted)] hover:text-black"
      >
        <X size={16} />
      </button>
      <p className="pr-5 leading-relaxed">{t("welcome.greeting")}</p>
    </div>
  );
}
