"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ConfirmModal } from "@/components/common/ConfirmModal";
import { formatDate } from "@/lib/utils";
import { validateNewsArticleInput } from "@/lib/news/newsInput";

interface NewsRow {
  id: string;
  title: string;
  source_name: string | null;
  source_url: string | null;
  original_lang: string | null;
  original_body: string | null;
  body: string;
  created_at: string;
}

const EMPTY = {
  title: "",
  sourceName: "",
  sourceUrl: "",
  originalLang: "th",
  originalBody: "",
  body: "",
};

export default function AdminNewsPage() {
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<NewsRow[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  function load() {
    const supabase = createClient();
    supabase
      .from("posts")
      .select("id, title, source_name, source_url, original_lang, original_body, body, created_at")
      .eq("category", "news")
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => setRows((data as NewsRow[]) ?? []));
  }

  useEffect(load, []);

  function handleEdit(r: NewsRow) {
    setEditingId(r.id);
    setForm({
      title: r.title,
      sourceName: r.source_name ?? "",
      sourceUrl: r.source_url ?? "",
      originalLang: r.original_lang ?? "th",
      originalBody: r.original_body ?? "",
      body: r.body,
    });
    setError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleCancelEdit() {
    setEditingId(null);
    setForm(EMPTY);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const invalid = validateNewsArticleInput(form);
    if (invalid) {
      setError(`입력을 확인해주세요: ${invalid}`);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(
        editingId ? `/api/admin/news/${editingId}` : "/api/admin/news",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "failed");
      setForm(EMPTY);
      setEditingId(null);
      load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : editingId ? "수정에 실패했습니다." : "등록에 실패했습니다.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await fetch(`/api/admin/posts/${deleteTarget}`, { method: "DELETE" });
    setDeleteTarget(null);
    load();
  }

  const field =
    "h-10 rounded-md border border-[var(--color-border-gray)] px-3 text-sm outline-none focus:border-[var(--color-brand-red)]";
  const area =
    "resize-none rounded-md border border-[var(--color-border-gray)] p-3 text-sm outline-none focus:border-[var(--color-brand-red)]";

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-lg font-bold">뉴스 관리</h1>

      {editingId && (
        <p className="text-xs text-[var(--color-text-muted)]">
          뉴스 글을 수정하는 중입니다. 취소하면 새 글 등록 폼으로 돌아갑니다.
        </p>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          className={field}
          placeholder="헤드라인 (한국어)"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
        />
        <div className="flex gap-3">
          <input
            className={`${field} flex-1`}
            placeholder="출처 매체명 (예: Khaosod (ข่าวสด))"
            value={form.sourceName}
            onChange={(e) => setForm({ ...form, sourceName: e.target.value })}
          />
          <input
            className={`${field} w-24`}
            placeholder="원문 언어"
            value={form.originalLang}
            onChange={(e) => setForm({ ...form, originalLang: e.target.value })}
          />
        </div>
        <input
          className={field}
          placeholder="출처 URL (https://...)"
          value={form.sourceUrl}
          onChange={(e) => setForm({ ...form, sourceUrl: e.target.value })}
        />
        <textarea
          className={area}
          rows={5}
          placeholder="원문 발췌 (원문 언어 그대로, 2~4문장)"
          value={form.originalBody}
          onChange={(e) => setForm({ ...form, originalBody: e.target.value })}
        />
        <textarea
          className={area}
          rows={8}
          placeholder="한국어 요약"
          value={form.body}
          onChange={(e) => setForm({ ...form, body: e.target.value })}
        />
        {error && <p className="text-xs text-[var(--color-brand-red)]">{error}</p>}
        <div className="flex justify-end gap-2">
          {editingId && (
            <button
              type="button"
              onClick={handleCancelEdit}
              className="rounded-md border border-[var(--color-border-gray)] px-5 py-2 text-sm font-medium"
            >
              취소
            </button>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="relative rounded-md bg-[var(--color-brand-red)] px-5 py-2 text-sm font-medium text-white disabled:opacity-50 gg-glossy-btn"
          >
            {editingId ? "수정" : "등록"}
          </button>
        </div>
      </form>

      <ul className="divide-y divide-[var(--color-border-gray-light)] rounded-lg border border-[var(--color-border-gray)]">
        {rows.length === 0 && (
          <li className="px-4 py-3 text-sm text-[var(--color-text-muted)]">
            등록된 뉴스가 없습니다.
          </li>
        )}
        {rows.map((r) => (
          <li key={r.id} className="flex items-center gap-3 px-4 py-3 text-sm">
            <span className="min-w-0 flex-1 truncate">{r.title}</span>
            <span className="shrink-0 text-xs text-[var(--color-text-muted)]">
              {r.source_name ?? "—"}
            </span>
            <span className="shrink-0 text-xs text-[var(--color-text-muted)]">
              {formatDate(r.created_at)}
            </span>
            <a
              href={`/board/news/${r.id}`}
              target="_blank"
              rel="noreferrer"
              className="shrink-0 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-brand-red)]"
            >
              보기
            </a>
            <button
              onClick={() => handleEdit(r)}
              className="shrink-0 text-xs font-medium text-[var(--color-text-muted)] hover:text-[var(--color-brand-red)]"
            >
              수정
            </button>
            <button
              onClick={() => setDeleteTarget(r.id)}
              className="shrink-0 text-xs font-medium text-[var(--color-brand-red)]"
            >
              삭제
            </button>
          </li>
        ))}
      </ul>

      {deleteTarget && (
        <ConfirmModal
          message="이 뉴스를 삭제하시겠습니까?"
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
