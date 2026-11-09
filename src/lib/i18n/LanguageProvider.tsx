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
// 지구본으로 고른 언어를 이번 방문(탭)에서만 기억하는 용도. localStorage(STORAGE_KEY)는
// "최초 방문 때 고정된 언어"라 지구본 선택으로 덮어쓰지 않고, 새로고침 때 구글 지도
// 스크립트가 같은 언어로 다시 로드되도록 이 값만 sessionStorage에 잠깐 남긴다.
const SESSION_STORAGE_KEY = "gupgup-locale-session";

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
  // 위 locale은 첫 페인트 동안 서버와 맞추려고 "ko"로 시작했다가 클라이언트에서
  // 마운트 직후 바뀐다. 구글 지도처럼 "한 번만, 확정된 언어로" 로드해야 하는
  // 쪽은 이 확정 여부를 봐야 설익은 "ko"로 먼저 로드해버리는 걸 피할 수 있다.
  localeResolved: boolean;
  setLocale: (locale: Locale) => void;
  t: (key: DictionaryKey) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("ko");
  const [localeResolved, setLocaleResolved] = useState(false);

  useEffect(() => {
    // Runs after the server-rendered "ko" markup hydrates, so client and
    // server output match on first paint.
    const sessionOverride = window.sessionStorage.getItem(SESSION_STORAGE_KEY) as Locale | null;
    if (sessionOverride && DICTIONARIES[sessionOverride]) {
      // 지구본으로 고른 언어로 새로고침된 상태 — 이번 방문 동안은 이 값을 쓴다.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLocaleState(sessionOverride);
      setLocaleResolved(true);
      return;
    }
    const stored = window.localStorage.getItem(STORAGE_KEY) as Locale | null;
    if (stored && DICTIONARIES[stored]) {
      // Already locked in on a previous visit -- keep using it.
      setLocaleState(stored);
      setLocaleResolved(true);
      return;
    }
    // First-ever visit on this device/browser: detect the system language
    // once and lock it in for every future visit (falls back to Korean if
    // the device's language isn't one we support).
    const fixed = detectBrowserLocale() ?? "ko";
    setLocaleState(fixed);
    setLocaleResolved(true);
    window.localStorage.setItem(STORAGE_KEY, fixed);
  }, []);

  // 지구본 아이콘으로 고르는 건 그 순간만 유지되는 임시 전환이라 STORAGE_KEY(최초
  // 고정 언어)는 덮어쓰지 않는다. 대신 sessionStorage에 남겨두고 바로 새로고침해서,
  // 이미 "ko"로 로드돼버린 구글 지도 스크립트도 고른 언어로 다시 불러오게 한다.
  const setLocale = useCallback((next: Locale) => {
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, next);
    window.location.reload();
  }, []);

  const t = useCallback(
    (key: DictionaryKey) => DICTIONARIES[locale][key] ?? DICTIONARIES.ko[key],
    [locale],
  );

  const value = useMemo(
    () => ({ locale, localeResolved, setLocale, t }),
    [locale, localeResolved, setLocale, t],
  );

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
