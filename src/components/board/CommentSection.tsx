"use client";

import { useState } from "react";
import type { Comment } from "@/lib/types";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { formatDate } from "@/lib/utils";
import { Avatar } from "@/components/common/Avatar";
import { NicknamePopup } from "@/components/common/NicknamePopup";
import { ReportModal } from "@/components/common/ReportModal";

function CommentRow({ comment, depth = 0 }: { comment: Comment; depth?: number }) {
  const { t } = useLanguage();
  const [reportOpen, setReportOpen] = useState(false);

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
              <p className="mt-0.5 whitespace-pre-wrap text-sm">{comment.body}</p>
              <button
                onClick={() => setReportOpen(true)}
                className="mt-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-brand-red)]"
              >
                {t("post.report")}
              </button>
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

export function CommentSection({ comments }: { comments: Comment[] }) {
  const topLevel = comments.filter((c) => !c.parentId);
  const repliesOf = (id: string) => comments.filter((c) => c.parentId === id);

  return (
    <div className="divide-y divide-[var(--color-border-gray-light)]">
      {topLevel.map((c) => (
        <div key={c.id}>
          <CommentRow comment={c} />
          {repliesOf(c.id).map((r) => (
            <CommentRow key={r.id} comment={r} depth={1} />
          ))}
        </div>
      ))}
    </div>
  );
}
