import { cn } from "@/lib/utils";

export function CategoryBadge({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-block rounded border border-[var(--color-brand-red)] bg-white px-2 py-0.5 text-xs font-semibold text-[var(--color-brand-red)]",
        className,
      )}
    >
      {children}
    </span>
  );
}
