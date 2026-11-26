import type { MetadataRoute } from "next";

const SITE_URL = (process.env.SITE_URL || "https://gupgupkorea.com").replace(/\/$/, "");

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Private or account-only pages: nothing useful for search results.
        disallow: [
          "/admin",
          "/api/",
          "/auth/",
          "/messages",
          "/inquiries",
          "/profile",
          "/onboarding",
          "/reset-password",
          "/board/*/write",
          "/board/*/*/edit",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
