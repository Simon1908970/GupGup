export const MAX_POST_EMBEDS = 3;

const YOUTUBE_WATCH = /^https:\/\/(?:www\.)?youtube\.com\/watch\?v=([\w-]{11})(?:&.*)?$/;
const YOUTUBE_SHORT = /^https:\/\/youtu\.be\/([\w-]{11})(?:\?.*)?$/;
const YOUTUBE_SHORTS = /^https:\/\/(?:www\.)?youtube\.com\/shorts\/([\w-]{11})(?:\?.*)?$/;
const TIKTOK_VIDEO = /^https:\/\/(?:www\.)?tiktok\.com\/@[\w.-]{1,24}\/video\/(\d{5,25})(?:\?.*)?$/;

export function detectEmbed(url) {
  const youtubeMatch =
    url.match(YOUTUBE_WATCH) ?? url.match(YOUTUBE_SHORT) ?? url.match(YOUTUBE_SHORTS);
  if (youtubeMatch) {
    return {
      provider: "youtube",
      embedUrl: `https://www.youtube-nocookie.com/embed/${youtubeMatch[1]}?autoplay=0&rel=0`,
    };
  }

  const tiktokMatch = url.match(TIKTOK_VIDEO);
  if (tiktokMatch) {
    return {
      provider: "tiktok",
      embedUrl: `https://www.tiktok.com/player/v1/${tiktokMatch[1]}?autoplay=0&music_info=0&description=0`,
    };
  }

  return null;
}

export function extractEmbeds(body) {
  const tokens = body.split(/\s+/);
  const seen = new Set();
  const embeds = [];

  for (const token of tokens) {
    if (embeds.length >= MAX_POST_EMBEDS) break;
    const match = detectEmbed(token);
    if (match && !seen.has(match.embedUrl)) {
      seen.add(match.embedUrl);
      embeds.push(match);
    }
  }

  return embeds;
}
