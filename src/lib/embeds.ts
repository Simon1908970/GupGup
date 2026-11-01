import {
  MAX_POST_EMBEDS as MAX_POST_EMBEDS_JS,
  detectEmbed as detectEmbedJs,
  extractEmbeds as extractEmbedsJs,
} from "./embeds.mjs";

export type EmbedProvider = "youtube" | "tiktok" | "facebook-post" | "facebook-video";

export interface DetectedEmbed {
  provider: EmbedProvider;
  embedUrl: string;
  // Only set for Facebook embeds, which can fail to render for private/group
  // posts -- used for the "view on Facebook" fallback link.
  sourceUrl?: string;
}

export const MAX_POST_EMBEDS: number = MAX_POST_EMBEDS_JS;
export const detectEmbed = detectEmbedJs as (url: string) => DetectedEmbed | null;
export const extractEmbeds = extractEmbedsJs as (body: string) => DetectedEmbed[];
