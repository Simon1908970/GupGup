import Link from "next/link";

export function Logo() {
  return (
    <Link href="/" className="flex shrink-0 items-center gap-2" aria-label="줍줍">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[var(--color-brand-red)]">
        <span className="text-base font-bold text-white" aria-hidden>
          줍
        </span>
      </span>
      <span className="whitespace-nowrap text-lg font-bold tracking-tight text-[var(--foreground)]">
        Gup Gup
      </span>
    </Link>
  );
}
