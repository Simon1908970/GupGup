"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

export function useTitleTranslation(titles: string[]) {
  const { locale } = useLanguage();
  const [showTranslation, setShowTranslation] = useState(false);
  const [translated, setTranslated] = useState<string[] | null>(null);
  const [translating, setTranslating] = useState(false);

  const titlesKey = titles.join("|");

  useEffect(() => {
    setShowTranslation(false);
    setTranslated(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [titlesKey]);

  async function toggle() {
    if (showTranslation) {
      setShowTranslation(false);
      return;
    }
    if (translated) {
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
      setTranslated(data.translations);
      setShowTranslation(true);
    } catch {
      // leave original titles shown if translation fails
    } finally {
      setTranslating(false);
    }
  }

  return { showTranslation, translating, translatedTitles: translated, toggle };
}
