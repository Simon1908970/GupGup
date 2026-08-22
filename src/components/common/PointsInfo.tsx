"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

export function PointsInfo({ align = "left" }: { align?: "left" | "right" }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);

  return (
    <>
      <span className="group relative inline-flex">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex h-4 w-4 items-center justify-center rounded-[4px] bg-green-700 text-[10px] font-bold leading-none text-white hover:bg-green-800"
          aria-label={t("points.infoTitle")}
        >
          ?
        </button>
        <span
          className={`pointer-events-none absolute top-full z-50 mt-1 w-64 whitespace-pre-line rounded-md border border-[var(--color-border-gray)] bg-white p-3 text-left text-[11px] leading-relaxed text-[var(--color-text-muted)] opacity-0 shadow-lg transition-opacity group-hover:opacity-100 gg-glossy ${align === "right" ? "right-0" : "left-0"}`}
        >
          {t("points.infoBody")}
        </span>
      </span>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold">{t("points.infoTitle")}</h2>
              <button onClick={() => setOpen(false)} aria-label={t("common.close")}>
                <X size={18} />
              </button>
            </div>
            <p className="whitespace-pre-line text-xs leading-relaxed text-[var(--color-text-muted)]">
              {t("points.infoBody")}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
