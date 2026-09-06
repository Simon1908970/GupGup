import { COUNTRIES } from "@/lib/constants/countries";
import type { CountryCode } from "@/lib/types";
import { cn } from "@/lib/utils";

// Real countries render as a crisp SVG flag (flag-icons package) so they
// show up correctly everywhere -- most desktop browsers (Windows Chrome/Edge
// in particular) have no flag glyphs in their emoji font and silently fall
// back to plain two-letter text (e.g. "TH") instead of an actual flag.
// "all"/"etc" aren't countries, so they keep their globe emoji, which is a
// regular (non flag-sequence) emoji that renders fine everywhere.
const FLAG_ICON_CODES = new Set<CountryCode>(["vn", "th", "la", "id", "mm", "ph", "mn", "kr"]);

export function CountryFlag({
  code,
  size = 12,
  className,
}: {
  code: CountryCode;
  /** Flag height in px; width follows the flag's native ~4:3 ratio. Default 12. */
  size?: number;
  className?: string;
}) {
  const option = COUNTRIES.find((c) => c.code === code);
  if (!option) return null;

  if (!FLAG_ICON_CODES.has(code)) {
    return <span className={className}>{option.flag}</span>;
  }

  return (
    <span
      role="img"
      aria-label={option.code}
      // Inline width/height (rather than Tailwind h-*/w-* classes) so a
      // per-call-site size always wins outright instead of depending on
      // Tailwind's generated CSS order when a caller's className also
      // carries a conflicting size utility.
      style={{ width: size * (4 / 3), height: size }}
      className={cn("fi", `fi-${code}`, "inline-block shrink-0 rounded-[2px] align-middle", className)}
    />
  );
}
