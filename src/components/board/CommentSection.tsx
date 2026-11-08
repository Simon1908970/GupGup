"use client";

import { useState } from "react";
import type { Comment } from "@/lib/types";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { useAuth } from "@/lib/auth/AuthProvider";
import { formatDate } from "@/lib/utils";
import { useProfanityCheck } from "@/lib/moderation/useProfanityCheck";
import { Avatar } from "@/components/common/Avatar";
import { NicknamePopup } from "@/components/common/NicknamePopup";
import { ReportModal } from "@/components/common/ReportModal";

interface ReplyInputProps {
  onCancel: () => void;
  onSubmit: (body: string) => Promise<void>;
}

function ReplyInput({ onCancel, onSubmit }: ReplyInputProps) {
  const { t } = useLanguage();
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const hasProfanity = useProfanityCheck(draft);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim() || hasProfanity) return;
    setPosting(true);
    try {
      await onSubmit(draft.trim());
      setDraft("");
      onCancel();
    } finally {
      setPosting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-2 flex flex-col gap-1.5">
      {hasProfanity && (
        <p className="text-xs text-[var(--color-brand-red)]">{t("moderation.profanityWarning")}</p>
      )}
      <div className="flex gap-2">
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t("board.replyPlaceholder")}
          className="h-8 flex-1 rounded-md border border-[var(--color-border-gray)] px-2.5 text-xs outline-none focus:border-[var(--color-brand-red)]"
        />
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-[var(--color-border-gray)] px-2.5 text-xs font-medium"
        >
          {t("common.cancel")}
        </button>
        <button
          disabled={posting || hasProfanity || !draft.trim()}
          className="relative rounded-md bg-[var(--color-brand-red)] px-3 text-xs font-medium text-white disabled:opacity-50 gg-glossy-btn"
        >
          {t("common.submit")}
        </button>
      </div>
    </form>
  );
}

interface CommentRowProps {
  comment: Comment;
  depth?: number;
  canReply?: boolean;
  onReply?: (parentId: string, body: string) => Promise<void>;
  renderBody?: React.ReactNode;
}

export function CommentRow({ comment, depth = 0, canReply, onReply, renderBody }: CommentRowProps) {
  const { t } = useLanguage();
  const [reportOpen, setReportOpen] = useState(false);
  const [replying, setReplying] = useState(false);

  return (
    <div className={depth > 0 ? "ml-9 border-l border-[var(--color-border-gray-light)] pl-3" : ""}>
      <div className="flex gap-2.5 py-3">
        <Avatar nickname={comment.author.nickname} avatarUrl={comment.author.avatarUrl} size={30} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <NicknamePopup author={comment.author} className="text-sm" />
            <span className="text-xs text-[var(--color-text-muted)]">
              {formatDate(comment.createdAt)}
            </span>
          </div>
          {comment.isDeleted ? (
            <p className="mt-0.5 text-sm text-[var(--color-text-muted)]">
              {t("board.commentDeleted")}
            </p>
          ) : (
            <>
              {renderBody ?? (
                <p className="mt-0.5 whitespace-pre-wrap break-words text-sm">{comment.body}</p>
              )}
              <div className="mt-1 flex items-center gap-3">
                {depth === 0 && canReply && onReply && (
                  <button
                    onClick={() => setReplying((v) => !v)}
                    className="text-xs font-medium text-[var(--color-text-muted)] hover:text-[var(--color-brand-red)]"
                  >
                    {t("board.reply")}
                  </button>
                )}
                <button
                  onClick={() => setReportOpen(true)}
                  className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-brand-red)]"
                >
                  {t("post.report")}
                </button>
              </div>
              {replying && onReply && (
                <ReplyInput
                  onCancel={() => setReplying(false)}
                  onSubmit={(body) => onReply(comment.id, body)}
                />
              )}
            </>
          )}
        </div>
      </div>
      {reportOpen && (
        <ReportModal
          target={{ type: "comment", id: comment.id }}
          onClose={() => setReportOpen(false)}
        />
      )}
    </div>
  );
}

export function CommentSection({
  comments,
  onReply,
  cardBodies,
}: {
  comments: Comment[];
  // 로그인한 사람만 답글을 달 수 있다 -- 넘기지 않으면(비로그인) 답글
  // 버튼 자체가 안 보인다.
  onReply?: (parentId: string, body: string) => Promise<void>;
  // "내 월급"/"내 생활비" 카드처럼 평범한 텍스트 대신 구조화된 내용을
  // 보여줘야 하는 최상위 댓글이 있을 때, comment.id -> 그 내용(JSX)으로
  // 넘긴다. 일반 댓글 목록에서는 넘기지 않는다.
  cardBodies?: Record<string, React.ReactNode>;
}) {
  const { user } = useAuth();
  const topLevel = comments.filter((c) => !c.parentId);
  const repliesOf = (id: string) => comments.filter((c) => c.parentId === id);

  return (
    <div className="divide-y divide-[var(--color-border-gray-light)]">
      {topLevel.map((c) => (
        <div key={c.id}>
          <CommentRow
            comment={c}
            canReply={Boolean(user)}
            onReply={onReply}
            renderBody={cardBodies?.[c.id]}
          />
          {repliesOf(c.id).map((r) => (
            <CommentRow key={r.id} comment={r} depth={1} />
          ))}
        </div>
      ))}
    </div>
  );
}
