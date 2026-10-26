import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_POST_EMBEDS, detectEmbed, extractEmbeds } from "./embeds.mjs";

test("detectEmbed: youtube watch URL", () => {
  assert.deepEqual(detectEmbed("https://www.youtube.com/watch?v=dQw4w9WgXcQ"), {
    provider: "youtube",
    embedUrl: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=0&rel=0",
  });
});

test("detectEmbed: youtu.be short URL", () => {
  assert.deepEqual(detectEmbed("https://youtu.be/dQw4w9WgXcQ"), {
    provider: "youtube",
    embedUrl: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=0&rel=0",
  });
});

test("detectEmbed: youtube shorts URL", () => {
  assert.deepEqual(detectEmbed("https://www.youtube.com/shorts/dQw4w9WgXcQ"), {
    provider: "youtube",
    embedUrl: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=0&rel=0",
  });
});

test("detectEmbed: tiktok video URL", () => {
  assert.deepEqual(detectEmbed("https://www.tiktok.com/@koreanonlinecoursemgl/video/7591824021851852052"), {
    provider: "tiktok",
    embedUrl: "https://www.tiktok.com/player/v1/7591824021851852052?autoplay=0&music_info=0&description=0",
  });
});

test("detectEmbed: unsupported platform returns null", () => {
  assert.equal(detectEmbed("https://www.facebook.com/koreanonlinecoursemgl/posts/pfbid02SR"), null);
});

test("detectEmbed: rejects domain spoofing", () => {
  assert.equal(detectEmbed("https://youtube.com.evil.com/watch?v=dQw4w9WgXcQ"), null);
});

test("detectEmbed: rejects userinfo trick", () => {
  assert.equal(detectEmbed("https://evil@youtube.com/watch?v=dQw4w9WgXcQ"), null);
});

test("detectEmbed: rejects TikTok short link", () => {
  assert.equal(detectEmbed("https://vm.tiktok.com/ZSe8reciAwq/"), null);
});

test("detectEmbed: rejects non-https", () => {
  assert.equal(detectEmbed("http://www.youtube.com/watch?v=dQw4w9WgXcQ"), null);
});

test("detectEmbed: rejects malformed video id length", () => {
  assert.equal(detectEmbed("https://www.youtube.com/watch?v=short"), null);
});

test("extractEmbeds: no links returns empty array", () => {
  assert.deepEqual(extractEmbeds("그냥 평범한 글입니다."), []);
});

test("extractEmbeds: finds a link embedded mid-sentence", () => {
  const body = "이거 한번 보세요 https://youtu.be/dQw4w9WgXcQ 재밌어요";
  assert.deepEqual(extractEmbeds(body), [
    { provider: "youtube", embedUrl: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=0&rel=0" },
  ]);
});

test("extractEmbeds: URL with trailing punctuation is not detected", () => {
  const body = "보세요: https://youtu.be/dQw4w9WgXcQ!";
  assert.deepEqual(extractEmbeds(body), []);
});

test("extractEmbeds: caps at MAX_POST_EMBEDS and keeps input order", () => {
  assert.equal(MAX_POST_EMBEDS, 3);
  const body = [
    "https://youtu.be/aaaaaaaaaaa",
    "https://youtu.be/bbbbbbbbbbb",
    "https://youtu.be/ccccccccccc",
    "https://youtu.be/ddddddddddd",
  ].join("\n");
  const result = extractEmbeds(body);
  assert.equal(result.length, 3);
  assert.deepEqual(result.map((e) => e.embedUrl), [
    "https://www.youtube-nocookie.com/embed/aaaaaaaaaaa?autoplay=0&rel=0",
    "https://www.youtube-nocookie.com/embed/bbbbbbbbbbb?autoplay=0&rel=0",
    "https://www.youtube-nocookie.com/embed/ccccccccccc?autoplay=0&rel=0",
  ]);
});

test("extractEmbeds: dedupes the same URL repeated", () => {
  const body = "https://youtu.be/dQw4w9WgXcQ\n\n다시 봐도 좋아요 https://youtu.be/dQw4w9WgXcQ";
  assert.equal(extractEmbeds(body).length, 1);
});

test("extractEmbeds: ignores unsupported links mixed with supported ones", () => {
  const body = "https://www.facebook.com/x/posts/1 그리고 https://youtu.be/dQw4w9WgXcQ";
  const result = extractEmbeds(body);
  assert.equal(result.length, 1);
  assert.equal(result[0].provider, "youtube");
});
