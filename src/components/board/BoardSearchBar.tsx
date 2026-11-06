"use client";

import { Search } from "lucide-react";
import { useEffect, useState } from "react";
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

  // 목록 페이지가 정적으로 미리 구워지면서 ?q= 값이 마운트 이후에야(URL을
  // 직접 읽는 효과로) 채워질 수 있다 -- 그 뒤늦은 query 변경을 입력란에도
  // 반영해야 해서 effect 안에서 setState가 불가피하다.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocalQuery(query);
  }, [query]);

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
