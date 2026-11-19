"use client";

import type { DetectedEmbed } from "@/lib/embeds";
import type { DictionaryKey } from "@/lib/i18n/dictionaries";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

const ASPECT_CLASS: Record<DetectedEmbed["provider"], string> = {
  youtube: "aspect-[16/9] w-full",
  tiktok: "aspect-[9/16] w-full max-w-[325px]",
  "facebook-post": "h-[500px] w-full",
  // Facebook Reels (the realistic case for /reel/ and fb.watch short-video
  // links) are vertical like TikTok, not landscape -- a 16:9 box just
  // crops a 9:16 video down to its horizontal middle slice.
  "facebook-video": "aspect-[9/16] w-full max-w-[325px]",
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
          // No sandbox attribute: TikTok's own oEmbed response (and Facebook's
          // documented plugin snippet) ship their player iframes unsandboxed.
          // A sandboxed instance of the same embedUrl reliably shows "Unable to
          // load player" -- the player script needs the ordinary permissions an
          // unsandboxed cross-origin iframe already has (e.g. requesting its own
          // cookies), which the sandbox attribute strips even with allow-same-origin.
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; fullscreen; gyroscope; picture-in-picture; web-share"
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
    </div>
  );
}
