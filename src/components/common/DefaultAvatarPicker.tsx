"use client";

import { DEFAULT_AVATARS } from "@/lib/constants/avatars";
import { cn } from "@/lib/utils";

export function DefaultAvatarPicker({
  selected,
  onSelect,
}: {
  selected?: string | null;
  onSelect: (url: string) => void;
}) {
  return (
    <div className="grid grid-cols-5 gap-2">
      {DEFAULT_AVATARS.map((avatar) => (
        <button
          key={avatar.id}
          type="button"
          onClick={() => onSelect(avatar.url)}
          className={cn(
            "flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border-2",
            selected === avatar.url
              ? "border-[var(--color-brand-red)]"
              : "border-transparent hover:border-[var(--color-border-gray)]",
          )}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={avatar.url} alt={avatar.id} className="h-full w-full object-cover" />
        </button>
      ))}
    </div>
  );
}
