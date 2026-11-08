"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import type { Comment, LivingCostEntry, Post, SalaryEntry } from "@/lib/types";
import {
  fetchSalaryEntries,
  fetchLivingCostEntries,
  fetchMySalaryEntryForMonth,
  fetchMyLivingCostEntryForMonth,
  fetchMyEntryCommentIds,
  submitSalaryEntry,
  submitLivingCostEntry,
  updateSalaryEntry,
  updateLivingCostEntry,
  DuplicateMonthError,
  type SalaryEntryInput,
  type LivingCostEntryInput,
} from "@/lib/supabase/pinnedFormEntries";
import { fetchComments, createComment, deleteComment, commentHasReplies } from "@/lib/supabase/comments";
import { CommentSection } from "@/components/board/CommentSection";
import { SalaryEntryCard, LivingCostEntryCard } from "@/components/board/PinnedFormEntryCard";
import {
  SalaryEntryForm,
  LivingCostEntryForm,
  salaryFormFromEntry,
  livingCostFormFromEntry,
} from "@/components/board/PinnedFormEntryForm";
import { ConfirmModal } from "@/components/common/ConfirmModal";
import { getErrorMessage } from "@/lib/utils";

type AnyEntry = SalaryEntry | LivingCostEntry;

function toPseudoComment(entry: AnyEntry, postId: string): Comment {
  return {
    id: entry.commentId,
    postId,
    author: entry.author,
    body: "",
    createdAt: entry.createdAt,
    isDeleted: entry.isDeleted,
  };
}

export function PinnedFormSection({ post }: { post: Post }) {
  const { t } = useLanguage();
  const router = useRouter();
  const { user } = useAuth();
  const formType = post.pinnedFormType;

  const [salaryEntries, setSalaryEntries] = useState<SalaryEntry[]>([]);
  const [livingCostEntries, setLivingCostEntries] = useState<LivingCostEntry[]>([]);
  const [replies, setReplies] = useState<Comment[]>([]);
  const [myCommentIds, setMyCommentIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<AnyEntry | null>(null);
  const [formNonce, setFormNonce] = useState(0);
  const [pendingDuplicate, setPendingDuplicate] = useState<{
    salaryInput?: SalaryEntryInput;
    livingCostInput?: LivingCostEntryInput;
    existing: AnyEntry;
  } | null>(null);

  async function reload() {
    if (!formType) return;
    setLoading(true);
    try {
      const [entries, repliesData, mine] = await Promise.all([
        formType === "salary" ? fetchSalaryEntries(post.id) : fetchLivingCostEntries(post.id),
        fetchComments(post.id, { repliesOnly: true }),
        user ? fetchMyEntryCommentIds(post.id, user.id, formType) : Promise.resolve(new Set<string>()),
      ]);
      if (formType === "salary") setSalaryEntries(entries as SalaryEntry[]);
      else setLivingCostEntries(entries as LivingCostEntry[]);
      setReplies(repliesData);
      setMyCommentIds(mine);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post.id, formType, user?.id]);

  function startEdit(entry: AnyEntry) {
    setError(null);
    setEditing(entry);
    setFormNonce((n) => n + 1);
  }

  function cancelEdit() {
    setEditing(null);
    setFormNonce((n) => n + 1);
  }

  async function handleDeleteEntry(entry: AnyEntry) {
    if (!user) return;
    const hasReplies = await commentHasReplies(entry.commentId);
    await deleteComment(entry.commentId, user.id, hasReplies);
    if (editing?.id === entry.id) cancelEdit();
    await reload();
  }

  if (!formType) return null;

  const entries: AnyEntry[] = formType === "salary" ? salaryEntries : livingCostEntries;
  const pseudoCards = entries.map((e) => toPseudoComment(e, post.id));
  const comments = [...pseudoCards, ...replies];
  const cardBodies: Record<string, React.ReactNode> = {};
  for (const entry of entries) {
    const isMine = myCommentIds.has(entry.commentId);
    const handleEdit = isMine ? () => startEdit(entry) : undefined;
    const handleDelete = isMine ? () => handleDeleteEntry(entry) : undefined;
    cardBodies[entry.commentId] =
      formType === "salary" ? (
        <SalaryEntryCard entry={entry as SalaryEntry} onEdit={handleEdit} onDelete={handleDelete} />
      ) : (
        <LivingCostEntryCard entry={entry as LivingCostEntry} onEdit={handleEdit} onDelete={handleDelete} />
      );
  }

  async function handleReply(parentId: string, body: string) {
    if (!user) return;
    await createComment(post.id, user.id, body, parentId);
    const repliesData = await fetchComments(post.id, { repliesOnly: true });
    setReplies(repliesData);
  }

  async function handleSubmitSalary(input: SalaryEntryInput) {
    if (!user) return;
    setSubmitting(true);
    setError(null);
    try {
      if (editing) {
        await updateSalaryEntry(editing.id, editing.commentId, user.id, input);
        cancelEdit();
      } else {
        await submitSalaryEntry(post.id, user.id, input);
        setFormNonce((n) => n + 1);
      }
      await reload();
    } catch (err) {
      if (err instanceof DuplicateMonthError) {
        const existing = await fetchMySalaryEntryForMonth(post.id, user.id, input.baseMonth);
        if (existing) setPendingDuplicate({ salaryInput: input, existing });
      } else {
        setError(getErrorMessage(err));
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmitLivingCost(input: LivingCostEntryInput) {
    if (!user) return;
    setSubmitting(true);
    setError(null);
    try {
      if (editing) {
        await updateLivingCostEntry(editing.id, editing.commentId, user.id, input);
        cancelEdit();
      } else {
        await submitLivingCostEntry(post.id, user.id, input);
        setFormNonce((n) => n + 1);
      }
      await reload();
    } catch (err) {
      if (err instanceof DuplicateMonthError) {
        const existing = await fetchMyLivingCostEntryForMonth(post.id, user.id, input.baseMonth);
        if (existing) setPendingDuplicate({ livingCostInput: input, existing });
      } else {
        setError(getErrorMessage(err));
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmOverwriteDuplicate() {
    if (!user || !pendingDuplicate) return;
    setSubmitting(true);
    try {
      if (pendingDuplicate.salaryInput) {
        await updateSalaryEntry(
          pendingDuplicate.existing.id,
          pendingDuplicate.existing.commentId,
          user.id,
          pendingDuplicate.salaryInput,
        );
      } else if (pendingDuplicate.livingCostInput) {
        await updateLivingCostEntry(
          pendingDuplicate.existing.id,
          pendingDuplicate.existing.commentId,
          user.id,
          pendingDuplicate.livingCostInput,
        );
      }
      setPendingDuplicate(null);
      setFormNonce((n) => n + 1);
      await reload();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      {!user ? (
        <button
          onClick={() => router.push("/login")}
          className="relative w-full rounded-md bg-[var(--color-brand-red)] py-2.5 text-sm font-medium text-white gg-glossy-btn"
        >
          {t("pinnedForm.loginToParticipate")}
        </button>
      ) : (
        <div>
          {editing && (
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="font-medium text-[var(--color-brand-red)]">
                {t("pinnedForm.editingMyEntry")}
              </span>
              <button onClick={cancelEdit} className="text-[var(--color-text-muted)] underline">
                {t("common.cancel")}
              </button>
            </div>
          )}
          {error && <p className="mb-2 text-xs text-[var(--color-brand-red)]">{error}</p>}
          {formType === "salary" ? (
            <SalaryEntryForm
              key={formNonce}
              initial={editing ? salaryFormFromEntry(editing as SalaryEntry) : undefined}
              submitLabelKey={editing ? "common.edit" : "pinnedForm.submit"}
              onSubmit={handleSubmitSalary}
              submitting={submitting}
            />
          ) : (
            <LivingCostEntryForm
              key={formNonce}
              initial={editing ? livingCostFormFromEntry(editing as LivingCostEntry) : undefined}
              submitLabelKey={editing ? "common.edit" : "pinnedForm.submit"}
              onSubmit={handleSubmitLivingCost}
              submitting={submitting}
            />
          )}
        </div>
      )}

      <div className="mt-6 border-t border-[var(--color-border-gray-light)] pt-2">
        <h2 className="py-3 text-sm font-semibold">
          {t("board.comments")} {comments.length}
        </h2>
        {loading ? (
          <p className="py-6 text-center text-sm text-[var(--color-text-muted)]">{t("common.loading")}</p>
        ) : (
          <CommentSection comments={comments} onReply={handleReply} cardBodies={cardBodies} />
        )}
      </div>

      {pendingDuplicate && (
        <ConfirmModal
          message={t("pinnedForm.duplicateMonthConfirm")}
          onCancel={() => setPendingDuplicate(null)}
          onConfirm={confirmOverwriteDuplicate}
        />
      )}
    </div>
  );
}
