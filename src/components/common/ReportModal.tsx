"use client";

import { useState } from "react";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import type { DictionaryKey } from "@/lib/i18n/dictionaries";
import type { ReportReason, ReportTarget } from "@/lib/types";

const REASONS: { value: ReportReason; labelKey: DictionaryKey }[] = [
  { value: "spam", labelKey: "report.reasonSpam" },
  { value: "abuse", labelKey: "report.reasonAbuse" },
  { value: "obscene", labelKey: "report.reasonObscene" },
  { value: "fraud", labelKey: "report.reasonFraud" },
  { value: "personal_info", labelKey: "report.reasonPersonalInfo" },
  { value: "etc", labelKey: "report.reasonEtc" },
];

export function ReportModal({
  target,
  onClose,
}: {
  target: ReportTarget;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit() {
    if (!reason) return;
    // TODO: insert into `reports` table via Supabase once wired up.
    console.log("report submitted", { target, reason });
    setSubmitted(true);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-lg bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {submitted ? (
          <div className="flex flex-col items-center gap-4 py-4 text-center">
            <p className="text-sm font-medium">{t("post.reportSubmitted")}</p>
            <button
              onClick={onClose}
              className="rounded bg-[var(--color-brand-red)] px-4 py-2 text-sm font-medium text-white"
            >
              {t("common.confirm")}
            </button>
          </div>
        ) : (
          <>
            <h2 className="mb-3 text-sm font-semibold">{t("report.title")}</h2>
            <div className="flex flex-col gap-2">
              {REASONS.map((r) => (
                <label
                  key={r.value}
                  className="flex cursor-pointer items-center gap-2 rounded border border-[var(--color-border-gray-light)] px-3 py-2 text-sm has-[:checked]:border-[var(--color-brand-red)] has-[:checked]:bg-[var(--color-brand-red-light)]"
                >
                  <input
                    type="radio"
                    name="report-reason"
                    value={r.value}
                    checked={reason === r.value}
                    onChange={() => setReason(r.value)}
                    className="accent-[var(--color-brand-red)]"
                  />
                  {t(r.labelKey)}
                </label>
              ))}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={onClose}
                className="rounded border border-[var(--color-border-gray)] px-4 py-2 text-sm"
              >
                {t("report.cancel")}
              </button>
              <button
                onClick={handleSubmit}
                disabled={!reason}
                className="rounded bg-[var(--color-brand-red)] px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
              >
                {t("report.submit")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
