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

const STORAGE_KEY = "gupgup-locale";

// 최초 방문 때 딱 한 번만 쓰는 감지 로직 — 그 결과를 저장해서 이후로는 계속
// 그 언어로 고정한다. 지구본 아이콘으로 고르는 건 그 순간만 유지되는 임시
// 전환이라 이 저장값을 덮어쓰지 않는다.
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
    // server output match on first paint.
    const stored = window.localStorage.getItem(STORAGE_KEY) as Locale | null;
    if (stored && DICTIONARIES[stored]) {
      // Already locked in on a previous visit -- keep using it.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLocaleState(stored);
      return;
    }
    // First-ever visit on this device/browser: detect the system language
    // once and lock it in for every future visit (falls back to Korean if
    // the device's language isn't one we support).
    const fixed = detectBrowserLocale() ?? "ko";
    setLocaleState(fixed);
    window.localStorage.setItem(STORAGE_KEY, fixed);
  }, []);

  // Session-only override: picking a language via the globe icon changes
  // what's shown for the rest of this visit, but doesn't touch the locked-in
  // language above, so the next fresh visit goes right back to it.
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
