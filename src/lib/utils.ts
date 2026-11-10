import { clsx, type ClassValue } from "clsx";
import type { Post } from "@/lib/types";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

// getFullYear/getMonth/getDate follow the *runtime's* local timezone, which
// differs between Vercel's SSR (UTC) and a KST browser -- posts written
// around UTC 15:00–23:59 (KST 00:00–08:59) rendered a different calendar
// date on each side and broke hydration (React error #418). Pinning the
// timezone explicitly keeps server and client output identical everywhere.
const DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function formatDate(iso: string): string {
  const parts = DATE_FORMATTER.formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}.${get("month")}.${get("day")}`;
}

export function formatCount(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}만`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}천`;
  return String(n);
}

export function getPostThumbnail(post: Post): string | undefined {
  return post.thumbnailUrl ?? post.attachments.find((a) => a.type === "image")?.url;
}

export function getErrorMessage(err: unknown): string {
  if (err && typeof err === "object" && "message" in err && typeof err.message === "string") {
    return err.message;
  }
  return String(err);
}
