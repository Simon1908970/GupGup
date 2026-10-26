"use client";

import type { DetectedEmbed } from "@/lib/embeds";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

const ASPECT_CLASS: Record<DetectedEmbed["provider"], string> = {
  youtube: "aspect-[16/9] w-full",
  tiktok: "aspect-[9/16] w-full max-w-[325px]",
};

export function EmbedFrame({ provider, embedUrl }: DetectedEmbed) {
  const { t } = useLanguage();
  const title = provider === "youtube" ? t("embed.youtubeTitle") : t("embed.tiktokTitle");

  return (
    <div
      className={`overflow-hidden rounded-lg border border-[var(--color-border-gray-light)] ${ASPECT_CLASS[provider]}`}
    >
      <iframe
        src={embedUrl}
        title={title}
        className="h-full w-full"
        sandbox="allow-scripts allow-same-origin allow-popups allow-presentation"
        allow="encrypted-media; picture-in-picture; fullscreen"
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </div>
  );
}
