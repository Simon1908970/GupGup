"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

export function useTitleTranslation(titles: string[]) {
  const { locale } = useLanguage();
  const [showTranslation, setShowTranslation] = useState(false);
  const [translated, setTranslated] = useState<{ locale: string; values: string[] } | null>(
    null,
  );
  const [translating, setTranslating] = useState(false);

  const titlesKey = titles.join("|");

  useEffect(() => {
    setShowTranslation(false);
    setTranslated(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [titlesKey]);

  // A cached translation is only valid for the locale it was fetched in;
  // switching languages must force a re-fetch on the next toggle.
  const showTranslated = showTranslation && translated?.locale === locale;

  async function toggle() {
    if (showTranslated) {
      setShowTranslation(false);
      return;
    }
    if (translated && translated.locale === locale) {
      setShowTranslation(true);
      return;
    }
    if (titles.length === 0) return;
    setTranslating(true);
    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texts: titles, target: locale }),
      });
      const data = await res.json();
      if (!res.ok || !data.translations) throw new Error("translate failed");
      setTranslated({ locale, values: data.translations });
      setShowTranslation(true);
    } catch {
      // leave original titles shown if translation fails
    } finally {
      setTranslating(false);
    }
  }

  return {
    showTranslation: showTranslated,
    translating,
    translatedTitles: showTranslated && translated ? translated.values : null,
    toggle,
  };
}
