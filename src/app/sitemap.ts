import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";
import { CATEGORIES, CATEGORY_ORDER } from "@/lib/constants/categories";

const SITE_URL = (process.env.SITE_URL || "https://gupgupkorea.com").replace(/\/$/, "");

// Rebuild the sitemap at most once an hour.
export const revalidate = 3600;

// Categories behind a login gate ("meeting") are left out: crawlers can't see them.
const PUBLIC_CATEGORIES = CATEGORY_ORDER.filter((c) => !CATEGORIES[c].requiresAuth);

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: "hourly", priority: 1 },
    ...PUBLIC_CATEGORIES.map((category) => ({
      url: `${SITE_URL}/board/${category}`,
      lastModified: now,
      changeFrequency: "hourly" as const,
      priority: 0.8,
    })),
    { url: `${SITE_URL}/popular`, lastModified: now, changeFrequency: "daily", priority: 0.6 },
    { url: `${SITE_URL}/map`, lastModified: now, changeFrequency: "weekly", priority: 0.5 },
    { url: `${SITE_URL}/terms`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/privacy`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/data-deletion`, changeFrequency: "yearly", priority: 0.1 },
  ];

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return staticPages;

  try {
    // Anonymous client: only what a logged-out visitor (and a crawler) can see.
    const supabase = createClient(url, anonKey, { auth: { persistSession: false } });
    const { data, error } = await supabase
      .from("posts")
      .select("id, category, created_at")
      .in("category", PUBLIC_CATEGORIES)
      .eq("members_only", false)
      .order("created_at", { ascending: false })
      .limit(5000);
    if (error || !data) return staticPages;

    const postPages: MetadataRoute.Sitemap = data.map((post) => ({
      url: `${SITE_URL}/board/${post.category}/${post.id}`,
      lastModified: new Date(post.created_at),
      changeFrequency: "weekly",
      priority: 0.7,
    }));
    return [...staticPages, ...postPages];
  } catch {
    return staticPages;
  }
}
