"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CATEGORY_ORDER } from "@/lib/constants/categories";
import { CATEGORIES } from "@/lib/constants/categories";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import type { DictionaryKey } from "@/lib/i18n/dictionaries";
import type { CategorySlug } from "@/lib/types";

export function SearchBar() {
  const { t } = useLanguage();
  const router = useRouter();
  const [category, setCategory] = useState<CategorySlug | "all">("all");
  const [query, setQuery] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const target = category === "all" ? "community" : category;
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    router.push(`/board/${target}?${params.toString()}`);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex h-10 w-full max-w-xl items-stretch overflow-hidden rounded-md border border-[var(--color-brand-red)]"
    >
      <select
        value={category}
        onChange={(e) => setCategory(e.target.value as CategorySlug | "all")}
        className="hidden shrink-0 border-r border-[var(--color-brand-red)] bg-white px-2 text-sm text-[var(--foreground)] outline-none sm:block"
      >
        <option value="all">{t("common.all")}</option>
        {CATEGORY_ORDER.map((slug) => (
          <option key={slug} value={slug}>
            {t(CATEGORIES[slug].labelKey as DictionaryKey)}
          </option>
        ))}
      </select>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t("header.searchPlaceholder")}
        className="w-full min-w-0 flex-1 px-3 text-sm outline-none"
      />
      <button
        type="submit"
        aria-label={t("board.search")}
        className="flex w-10 shrink-0 items-center justify-center bg-[var(--color-brand-red)] text-white"
      >
        <Search size={16} />
      </button>
    </form>
  );
}
