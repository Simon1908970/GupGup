"use client";

import { Globe } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { LOCALE_LABELS, SUPPORTED_LOCALES } from "@/lib/i18n/dictionaries";

export function LanguageSwitcher() {
  const { locale, setLocale } = useLanguage();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Language"
        className="flex h-10 w-10 items-center justify-center rounded-md text-[var(--foreground)] hover:bg-[var(--color-border-gray-light)]"
      >
        <Globe size={20} />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-40 mt-1 max-h-80 w-40 overflow-y-auto rounded-md border border-[var(--color-border-gray)] bg-white shadow-lg">
          {SUPPORTED_LOCALES.map((loc) => (
            <button
              key={loc}
              onClick={() => {
                setLocale(loc);
                setOpen(false);
              }}
              className={`block w-full px-4 py-2 text-left text-sm hover:bg-[var(--color-border-gray-light)] ${
                loc === locale ? "font-semibold text-[var(--color-brand-red)]" : ""
              }`}
            >
              {LOCALE_LABELS[loc]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
