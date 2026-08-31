export interface NewsArticleInput {
  title: string;
  sourceName: string;
  sourceUrl: string;
  originalBody: string;
  originalLang: string;
  body: string; // Korean summary
}

export type NewsInputError =
  | "title"
  | "sourceName"
  | "sourceUrl"
  | "originalBody"
  | "body";

/**
 * Validates admin news-article input. Returns the first offending field,
 * or null when every required field is acceptable. Shared by the admin
 * form (pre-submit hint) and the API route (authoritative check).
 * `originalLang` is optional and not validated here.
 */
export function validateNewsArticleInput(
  input: Partial<NewsArticleInput>,
): NewsInputError | null {
  if (!input.title?.trim()) return "title";
  if (!input.sourceName?.trim()) return "sourceName";
  if (!isHttpUrl(input.sourceUrl)) return "sourceUrl";
  if (!input.originalBody?.trim()) return "originalBody";
  if (!input.body?.trim()) return "body";
  return null;
}

export function isHttpUrl(value: string | undefined): boolean {
  if (!value?.trim()) return false;
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return false;
  }
  return url.protocol === "http:" || url.protocol === "https:";
}
