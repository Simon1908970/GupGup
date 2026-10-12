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

// 첫 방문(저장된 언어 선택이 없을 때)에만 쓰는 감지 로직 — 한 번이라도 지구본
// 아이콘으로 직접 언어를 고르면 그 뒤로는 이 로직을 안 타고 저장된 값을 따른다.
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
    // Reads the persisted locale after the server-rendered "ko" markup has
    // hydrated, so client and server output match on first paint.
    const stored = window.localStorage.getItem(STORAGE_KEY) as Locale | null;
    if (stored && DICTIONARIES[stored]) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLocaleState(stored);
      return;
    }
    // No saved preference yet (first visit on this device/browser) -- follow
    // the device's system language instead of defaulting everyone to Korean.
    // This is intentionally not persisted to localStorage, so it keeps
    // following the device's language on every visit until the person picks
    // one explicitly via the globe icon, at which point setLocale() below
    // takes over for good.
    const detected = detectBrowserLocale();
    if (detected) {
      setLocaleState(detected);
    }
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
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
