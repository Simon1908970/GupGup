"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { CATEGORIES, CATEGORY_ORDER } from "@/lib/constants/categories";
import type { CategorySlug } from "@/lib/types";
import type { DictionaryKey } from "@/lib/i18n/dictionaries";
import { ConfirmModal } from "@/components/common/ConfirmModal";
import { formatDate } from "@/lib/utils";

interface AdminPostRow {
  id: string;
  title: string;
  category: CategorySlug;
  created_at: string;
  author: { nickname: string } | null;
}

export default function AdminPostsPage() {
  const { t } = useLanguage();
  const [category, setCategory] = useState<CategorySlug | "all">("all");
  const [q, setQ] = useState("");
  const [posts, setPosts] = useState<AdminPostRow[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  function load() {
    const supabase = createClient();
    let query = supabase
      .from("posts")
      .select("id, title, category, created_at, author:profiles(nickname)")
      .order("created_at", { ascending: false })
      .limit(50);
    if (category !== "all") query = query.eq("category", category);
    if (q.trim()) query = query.ilike("title", `%${q.trim()}%`);
    query.then(({ data }) => setPosts((data as unknown as AdminPostRow[]) ?? []));
  }

  useEffect(load, [category]);

  async function handleDelete() {
    if (!deleteTarget) return;
    await fetch(`/api/admin/posts/${deleteTarget}`, { method: "DELETE" });
    setDeleteTarget(null);
    load();
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-bold">게시글 관리</h1>

      <div className="flex flex-wrap gap-2">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as CategorySlug | "all")}
          className="h-10 rounded-md border border-[var(--color-border-gray)] px-3 text-sm"
        >
          <option value="all">전체 카테고리</option>
          {CATEGORY_ORDER.map((slug) => (
            <option key={slug} value={slug}>
              {t(CATEGORIES[slug].labelKey as DictionaryKey)}
            </option>
          ))}
        </select>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            load();
          }}
          className="flex flex-1 gap-2"
        >
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="제목 검색"
            className="h-10 flex-1 rounded-md border border-[var(--color-border-gray)] px-3 text-sm outline-none focus:border-[var(--color-brand-red)]"
          />
          <button className="h-10 rounded-md border border-[var(--color-border-gray)] px-4 text-sm font-medium">
            검색
          </button>
        </form>
      </div>

      <ul className="divide-y divide-[var(--color-border-gray-light)] rounded-lg border border-[var(--color-border-gray)]">
        {posts.map((p) => (
          <li key={p.id} className="flex items-center gap-3 px-4 py-3 text-sm">
            <span className="shrink-0 rounded border border-[var(--color-border-gray)] px-1.5 py-0.5 text-xs">
              {t(CATEGORIES[p.category].labelKey as DictionaryKey)}
            </span>
            <span className="min-w-0 flex-1 truncate">{p.title}</span>
            <span className="shrink-0 text-xs text-[var(--color-text-muted)]">
              {p.author?.nickname ?? "알 수 없음"}
            </span>
            <span className="shrink-0 text-xs text-[var(--color-text-muted)]">
              {formatDate(p.created_at)}
            </span>
            <a
              href={`/board/${p.category}/${p.id}`}
              target="_blank"
              rel="noreferrer"
              className="shrink-0 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-brand-red)]"
            >
              보기
            </a>
            <button
              onClick={() => setDeleteTarget(p.id)}
              className="shrink-0 text-xs font-medium text-[var(--color-brand-red)]"
            >
              삭제
            </button>
          </li>
        ))}
      </ul>

      {deleteTarget && (
        <ConfirmModal
          message="이 게시글을 삭제하시겠습니까?"
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
