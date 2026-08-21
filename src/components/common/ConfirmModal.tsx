"use client";

import { useLanguage } from "@/lib/i18n/LanguageProvider";

interface ConfirmModalProps {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({ message, onConfirm, onCancel }: ConfirmModalProps) {
  const { t } = useLanguage();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-xl">
        <div className="flex flex-col items-center gap-4 py-4 text-center">
          <p className="whitespace-pre-line text-sm font-medium">{message}</p>
          <div className="flex w-full gap-2">
            <button
              onClick={onCancel}
              className="h-10 flex-1 rounded-md border border-[var(--color-border-gray)] text-sm font-medium"
            >
              {t("common.cancel")}
            </button>
            <button
              onClick={onConfirm}
              className="h-10 flex-1 rounded-md bg-[var(--color-brand-red)] text-sm font-medium text-white"
            >
              {t("common.confirm")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
