"use client";

import { cn } from "@/lib/utils";
import { useAutoFitFontSize } from "@/lib/hooks/useAutoFitFontSize";

const BASE_FONT_PX = 12; // text-xs
const MIN_FONT_PX = 9;

export function CategoryBadge({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  // Translated labels (Vietnamese, Thai, Indonesian, ...) are often
  // longer than the Korean original and would otherwise wrap onto a
  // second line inside this badge — shrink the font instead so it
  // always stays on one line, in every language.
  const ref = useAutoFitFontSize<HTMLSpanElement>([children], BASE_FONT_PX, MIN_FONT_PX);

  return (
    <span
      ref={ref}
      className={cn(
        "inline-block max-w-full overflow-hidden text-ellipsis whitespace-nowrap rounded border border-[var(--color-brand-red)] bg-white px-2 py-0.5 text-xs font-semibold text-[var(--color-brand-red)] gg-badge-inset",
        className,
      )}
    >
      {children}
    </span>
  );
}
