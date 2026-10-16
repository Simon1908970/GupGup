"use client";

import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { cn } from "@/lib/utils";

export function DeleteButton({
  onClick,
  disabled,
  className,
  label,
}: {
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  label?: string;
}) {
  const { t } = useLanguage();

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "shrink-0 rounded border border-[var(--color-brand-red)] bg-white px-2 py-1 text-xs font-medium text-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-light)] disabled:opacity-50",
        className,
      )}
    >
      {label ?? t("common.delete")}
    </button>
  );
}
