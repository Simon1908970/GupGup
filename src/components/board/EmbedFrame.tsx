"use client";

import type { DetectedEmbed } from "@/lib/embeds";
import type { DictionaryKey } from "@/lib/i18n/dictionaries";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

const ASPECT_CLASS: Record<DetectedEmbed["provider"], string> = {
  youtube: "aspect-[16/9] w-full",
  tiktok: "aspect-[9/16] w-full max-w-[325px]",
  "facebook-post": "h-[500px] w-full",
  "facebook-video": "aspect-[16/9] w-full",
};

const TITLE_KEY: Record<DetectedEmbed["provider"], DictionaryKey> = {
  youtube: "embed.youtubeTitle",
  tiktok: "embed.tiktokTitle",
  "facebook-post": "embed.facebookPostTitle",
  "facebook-video": "embed.facebookVideoTitle",
};

export function EmbedFrame({ provider, embedUrl, sourceUrl }: DetectedEmbed) {
  const { t } = useLanguage();
  const title = t(TITLE_KEY[provider]);

  return (
    <div className="flex flex-col gap-1">
      {/* Facebook's plugin iframe silently fails for lots of ordinary posts
          (personal-profile posts, not just private/group ones), leaving a
          tall blank box with nothing to click. Showing the fallback link
          above the iframe -- not just underneath it -- means it's visible
          immediately instead of requiring a scroll past that empty box. */}
      {sourceUrl && (
        <a
          href={sourceUrl}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="self-start text-xs text-[var(--color-text-muted)] underline hover:text-[var(--color-brand-red)]"
        >
          {t("embed.facebookViewLink")}
        </a>
      )}
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
    </div>
  );
}
