"use client";

import { Search } from "lucide-react";
import { useState } from "react";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

export type SearchScope = "titleContent" | "title" | "author";

export function BoardSearchBar({
  scope,
  query,
  onSubmit,
}: {
  scope: SearchScope;
  query: string;
  onSubmit: (scope: SearchScope, query: string) => void;
}) {
  const { t } = useLanguage();
  const [localScope, setLocalScope] = useState<SearchScope>(scope);
  const [localQuery, setLocalQuery] = useState(query);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(localScope, localQuery);
      }}
      className="flex h-9 items-stretch overflow-hidden rounded-md border border-[var(--color-brand-red)]"
    >
      <select
        value={localScope}
        onChange={(e) => setLocalScope(e.target.value as SearchScope)}
        className="shrink-0 border-r border-[var(--color-brand-red)] bg-white px-2 text-xs outline-none"
      >
        <option value="titleContent">{t("board.searchScope.titleContent")}</option>
        <option value="title">{t("board.searchScope.title")}</option>
        <option value="author">{t("board.searchScope.author")}</option>
      </select>
      <input
        value={localQuery}
        onChange={(e) => setLocalQuery(e.target.value)}
        placeholder={t("board.search")}
        className="w-40 min-w-0 flex-1 px-2 text-sm outline-none"
      />
      <button
        type="submit"
        aria-label={t("board.search")}
        className="flex w-9 shrink-0 items-center justify-center bg-[var(--color-brand-red)] text-white"
      >
        <Search size={14} />
      </button>
    </form>
  );
}
