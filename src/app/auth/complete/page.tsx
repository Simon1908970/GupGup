"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

// Google / Facebook login lands here (see login page redirectTo).
// The PKCE code is exchanged in the browser, so the session is stored with
// document.cookie instead of large Set-Cookie response headers, which
// Hostinger's proxy rejects with HTTP 500. Email links still use the
// /auth/callback route (their sessions are small).
export default function AuthCompletePage() {
  const router = useRouter();
  const { t } = useLanguage();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const supabase = createClient();
      const code = new URLSearchParams(window.location.search).get("code");

      // The browser client picks up ?code= by itself while initialising;
      // getSession() waits for that to finish.
      let {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session && code) {
        const { data } = await supabase.auth.exchangeCodeForSession(code);
        session = data.session;
      }

      if (cancelled) return;
      if (!session) {
        router.replace("/login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", session.user.id)
        .maybeSingle();

      if (!cancelled) router.replace(profile ? "/" : "/onboarding");
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <div className="mx-auto max-w-sm px-4 py-16 text-center text-sm text-gray-500">
      {t("common.loading")}
    </div>
  );
}
