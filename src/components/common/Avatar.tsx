import { cn } from "@/lib/utils";

// 무료 라이선스(Avataaars) 기본 캐릭터 일러스트 -- 닉네임 해시로 고정 배정해
// 같은 사람은 항상 같은 기본 이미지를 받는다.
const DEFAULT_AVATARS = [
  "/avatars/male-1.svg",
  "/avatars/female-1.svg",
  "/avatars/male-2.svg",
  "/avatars/female-2.svg",
  "/avatars/male-3.svg",
  "/avatars/female-3.svg",
  "/avatars/male-4.svg",
  "/avatars/female-4.svg",
  "/avatars/male-5.svg",
  "/avatars/female-5.svg",
];

function fallbackAvatarSrc(seed: string) {
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
      style={{ width: size, height: size }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={avatarUrl || fallbackAvatarSrc(nickname)}
        alt={nickname}
        width={size}
        height={size}
        className="h-full w-full object-cover"
      />
    </span>
  );
}
