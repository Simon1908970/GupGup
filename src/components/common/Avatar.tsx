import { cn } from "@/lib/utils";

const DEFAULT_AVATARS = ["🧑", "👩", "🧑‍🦱", "👨‍🦰", "👩‍🦳", "🧔"];

function fallbackEmoji(seed: string) {
  let hash = 0;
  for (const ch of seed) hash = (hash * 31 + ch.charCodeAt(0)) % 1000;
  return DEFAULT_AVATARS[hash % DEFAULT_AVATARS.length];
}

export function Avatar({
  nickname,
  avatarUrl,
  size = 32,
  className,
}: {
  nickname: string;
  avatarUrl?: string;
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--color-border-gray-light)] text-center",
        className,
      )}
      style={{ width: size, height: size, fontSize: size * 0.55 }}
    >
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatarUrl}
          alt={nickname}
          width={size}
          height={size}
          className="h-full w-full object-cover"
        />
      ) : (
        fallbackEmoji(nickname)
      )}
    </span>
  );
}
