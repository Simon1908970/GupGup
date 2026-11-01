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
  assert.equal(detectEmbed("https://www.instagram.com/p/abc123/"), null);
});

test("detectEmbed: facebook post URL uses the post plugin", () => {
  const url = "https://www.facebook.com/koreanonlinecoursemgl/posts/pfbid02SR";
  assert.deepEqual(detectEmbed(url), {
    provider: "facebook-post",
    embedUrl: `https://www.facebook.com/plugins/post.php?href=${encodeURIComponent(url)}`,
    sourceUrl: url,
  });
});

test("detectEmbed: facebook group post URL uses the post plugin", () => {
  const url = "https://www.facebook.com/groups/123456/posts/789012";
  assert.deepEqual(detectEmbed(url), {
    provider: "facebook-post",
    embedUrl: `https://www.facebook.com/plugins/post.php?href=${encodeURIComponent(url)}`,
    sourceUrl: url,
  });
});

test("detectEmbed: facebook /videos/ URL uses the video plugin", () => {
  const url = "https://www.facebook.com/koreanonlinecoursemgl/videos/1234567890";
  assert.deepEqual(detectEmbed(url), {
    provider: "facebook-video",
    embedUrl: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}`,
    sourceUrl: url,
  });
});

test("detectEmbed: facebook /reel/ URL uses the video plugin", () => {
  const url = "https://www.facebook.com/reel/1234567890";
  assert.deepEqual(detectEmbed(url), {
    provider: "facebook-video",
    embedUrl: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}`,
    sourceUrl: url,
  });
});

test("detectEmbed: facebook watch URL uses the video plugin", () => {
  const url = "https://www.facebook.com/watch/?v=1234567890";
  assert.deepEqual(detectEmbed(url), {
    provider: "facebook-video",
    embedUrl: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}`,
    sourceUrl: url,
  });
});

test("detectEmbed: fb.watch short link uses the video plugin", () => {
  const url = "https://fb.watch/abc123XYZ/";
  assert.deepEqual(detectEmbed(url), {
    provider: "facebook-video",
    embedUrl: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}`,
    sourceUrl: url,
  });
});

test("detectEmbed: facebook m. subdomain is accepted", () => {
  const url = "https://m.facebook.com/koreanonlinecoursemgl/posts/pfbid02SR";
  assert.equal(detectEmbed(url)?.provider, "facebook-post");
});

test("detectEmbed: facebook URL with trailing punctuation is not detected", () => {
  assert.equal(detectEmbed("https://www.facebook.com/x/posts/1!"), null);
});

test("detectEmbed: rejects facebook domain spoofing", () => {
  assert.equal(detectEmbed("https://facebook.com.evil.com/x/posts/1"), null);
});

test("detectEmbed: rejects facebook userinfo trick", () => {
  assert.equal(detectEmbed("https://evil@facebook.com/x/posts/1"), null);
});

test("detectEmbed: rejects fb.watch domain spoofing", () => {
  assert.equal(detectEmbed("https://fb.watch.evil.com/abc123"), null);
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
  const body = "https://www.instagram.com/p/abc123/ 그리고 https://youtu.be/dQw4w9WgXcQ";
  const result = extractEmbeds(body);
  assert.equal(result.length, 1);
  assert.equal(result[0].provider, "youtube");
});

test("extractEmbeds: picks up a facebook link alongside a youtube link", () => {
  const body = "https://www.facebook.com/x/posts/1 그리고 https://youtu.be/dQw4w9WgXcQ";
  const result = extractEmbeds(body);
  assert.deepEqual(
    result.map((e) => e.provider),
    ["facebook-post", "youtube"],
  );
});
