import Link from "next/link";
import { Hand } from "lucide-react";

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2" aria-label="줍줍">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[var(--color-brand-red)]">
        <Hand size={18} strokeWidth={2} className="text-white" aria-hidden />
      </span>
      <span className="flex items-baseline gap-1.5">
        <span className="text-lg font-bold tracking-tight text-[var(--foreground)]">Gup Gup</span>
        <span className="text-[11px] text-[var(--color-text-muted)]">줍줍</span>
      </span>
    </Link>
  );
}
