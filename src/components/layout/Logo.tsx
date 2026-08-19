import Link from "next/link";
import { Hand } from "lucide-react";

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2">
      <span className="flex h-9 w-9 items-center justify-center rounded-md bg-[var(--color-brand-red)] text-white">
        <Hand size={20} strokeWidth={2.25} />
      </span>
      <span className="flex flex-col leading-none">
        <span className="text-lg font-extrabold tracking-tight">Gup Gup</span>
        <span className="text-[10px] font-medium text-[var(--color-text-muted)]">
          줍줍
        </span>
      </span>
    </Link>
  );
}
