import Link from "next/link";
import { CATEGORIES } from "@/lib/constants/categories";
import type { CategorySlug, Post } from "@/lib/types";
import { CategoryBadge } from "@/components/common/CategoryBadge";
import { CountryTag } from "@/components/common/CountryTag";
import { formatDate } from "@/lib/utils";

export function CategoryBox({
  slug,
  label,
  moreLabel,
  posts,
}: {
  slug: CategorySlug;
  label: string;
  moreLabel: string;
  posts: Post[];
}) {
  const config = CATEGORIES[slug];
  const items = posts.slice(0, config.mainCount);

  return (
    <div className="relative flex h-full flex-col rounded-lg border border-[var(--color-border-gray)] bg-white gg-glossy-interactive">
      <div className="flex items-center justify-between border-b border-[var(--color-border-gray-light)] px-4 py-3">
        <CategoryBadge>{label}</CategoryBadge>
        <Link
          href={`/board/${slug}`}
          className="text-xs font-medium text-[var(--color-text-muted)] hover:text-[var(--color-brand-red)]"
        >
          {moreLabel}
        </Link>
      </div>
      <ul className="flex-1 divide-y divide-[var(--color-border-gray-light)] px-4">
        {items.length === 0 && (
          <li className="py-6 text-center text-xs text-[var(--color-text-muted)]">
            —
          </li>
        )}
        {items.map((post) => (
          <li key={post.id}>
            <Link
              href={`/board/${slug}/${post.id}`}
              className="flex items-center gap-2 py-2.5 text-sm hover:text-[var(--color-brand-red)]"
            >
              {config.hasCountryTag && (
                <CountryTag country={post.country} className="shrink-0" />
              )}
              <span className="min-w-0 flex-1 truncate">{post.title}</span>
              <span className="shrink-0 text-xs text-[var(--color-text-muted)]">
                {formatDate(post.createdAt)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
