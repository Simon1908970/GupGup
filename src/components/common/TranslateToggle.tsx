"use client";

import { Languages } from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { cn } from "@/lib/utils";

export function TranslateToggle({
  showTranslation,
  translating,
  onClick,
  className,
  iconOnly,
}: {
  showTranslation: boolean;
  translating: boolean;
  onClick: () => void;
  className?: string;
  iconOnly?: boolean;
}) {
  const { t } = useLanguage();
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={translating}
      className={cn(
        "flex shrink-0 items-center gap-1 text-xs font-medium text-green-600 disabled:opacity-50",
        className,
      )}
    >
      <Languages size={14} />
      {!iconOnly &&
        (translating
          ? t("common.loading")
          : showTranslation
            ? t("post.originalView")
            : t("post.translateView"))}
    </button>
  );
}
