"use client";

import { cn } from "@/lib/utils";

export function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  const pages = Array.from({ length: totalPages }).map((_, i) => i + 1);

  return (
    <nav className="flex items-center justify-center gap-1.5">
      <button
        onClick={() => onChange(Math.max(1, page - 1))}
        disabled={page === 1}
        className="h-8 w-8 rounded border border-[var(--color-border-gray)] text-sm disabled:opacity-30"
        aria-label="Previous page"
      >
        ‹
      </button>
      {pages.map((p) => (
        <button
          key={p}
          onClick={() => onChange(p)}
          className={cn(
            "h-8 w-8 rounded border text-sm font-medium",
            p === page
              ? "border-[var(--color-brand-red)] bg-[var(--color-brand-red)] text-white"
              : "border-[var(--color-border-gray)] text-[var(--foreground)]",
          )}
        >
          {p}
        </button>
      ))}
      <button
        onClick={() => onChange(Math.min(totalPages, page + 1))}
        disabled={page === totalPages}
        className="h-8 w-8 rounded border border-[var(--color-border-gray)] text-sm disabled:opacity-30"
        aria-label="Next page"
      >
        ›
      </button>
    </nav>
  );
}
