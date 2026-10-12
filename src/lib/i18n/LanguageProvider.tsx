"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  DICTIONARIES,
  SUPPORTED_LOCALES,
  type DictionaryKey,
  type Locale,
} from "@/lib/i18n/dictionaries";

// 지구본 아이콘은 그 방문 동안만 유지되는 "일시적으로 다른 언어로 읽기" 기능이라
// 선택을 저장하지 않는다 — 다시 들어오면(새로고침·재방문) 매번 아래 감지 로직으로
// 기기 시스템 언어부터 다시 시작한다.
function detectBrowserLocale(): Locale | null {
  if (typeof navigator === "undefined") return null;
  const candidates = navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const tag of candidates) {
    if (!tag) continue;
    let base = tag.toLowerCase().split("-")[0];
    // 필리핀어는 브라우저/OS가 "fil"로 보고하는 경우가 많은데, 우리 로케일 코드는 "tl".
    if (base === "fil") base = "tl";
    if ((SUPPORTED_LOCALES as readonly string[]).includes(base)) {
      return base as Locale;
    }
  }
  return null;
}

interface LanguageContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: DictionaryKey) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("ko");

  useEffect(() => {
    // Runs after the server-rendered "ko" markup hydrates, so client and
    // server output match on first paint. Always re-detects on mount (no
    // stored preference to check) so every fresh visit starts from the
    // device's current system language.
    const detected = detectBrowserLocale();
    if (detected) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLocaleState(detected);
    }
  }, []);

  // Session-only override: picking a language via the globe icon changes
  // what's shown for the rest of this visit, but isn't saved anywhere, so
  // the next fresh visit goes back to following the device's language.
  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
  }, []);

  const t = useCallback(
    (key: DictionaryKey) => DICTIONARIES[locale][key] ?? DICTIONARIES.ko[key],
    [locale],
  );

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }
  return ctx;
}
