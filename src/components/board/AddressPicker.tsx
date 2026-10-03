"use client";

import { useLanguage } from "@/lib/i18n/LanguageProvider";

declare global {
  interface Window {
    daum?: {
      Postcode: new (options: {
        oncomplete: (data: { roadAddress: string; jibunAddress: string }) => void;
      }) => { open: () => void };
    };
  }
}

const SCRIPT_SRC = "//ssl.daum.net/postcode/postcodev2.js";

function loadDaumPostcodeScript(): Promise<void> {
  if (window.daum?.Postcode) return Promise.resolve();
  const existing = document.querySelector(`script[src="${SCRIPT_SRC}"]`);
  if (existing) {
    return new Promise((resolve) => existing.addEventListener("load", () => resolve()));
  }
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.onload = () => resolve();
    document.head.appendChild(script);
  });
}

export function AddressPicker({ onSelect }: { onSelect: (address: string) => void }) {
  const { t } = useLanguage();

  async function openPicker() {
    await loadDaumPostcodeScript();
    if (!window.daum?.Postcode) return;
    new window.daum.Postcode({
      oncomplete: (data) => {
        onSelect(data.roadAddress || data.jibunAddress);
      },
    }).open();
  }

  return (
    <button
      type="button"
      onClick={openPicker}
      className="rounded-md border border-[var(--color-brand-red)] px-3 py-1.5 text-sm font-medium text-[var(--color-brand-red)] hover:bg-[var(--color-brand-red)]/5"
    >
      {t("map.addressSearchButton")}
    </button>
  );
}
