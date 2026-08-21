"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { COUNTRIES } from "@/lib/constants/countries";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import type { DictionaryKey } from "@/lib/i18n/dictionaries";
import { fetchPublicProfile } from "@/lib/supabase/profiles";
import { fetchPostsByAuthor } from "@/lib/supabase/posts";
import type { Author, Post } from "@/lib/types";
import { Avatar } from "@/components/common/Avatar";
import { PostListItem } from "@/components/board/PostListItem";
import { ReportModal } from "@/components/common/ReportModal";
import { formatDate } from "@/lib/utils";

export default function OtherProfilePage() {
  const { t } = useLanguage();
  const router = useRouter();
  const params = useParams<{ userId: string }>();
  const [reportOpen, setReportOpen] = useState(false);
  const [author, setAuthor] = useState<Author | null | undefined>(undefined);
  const [joinedAt, setJoinedAt] = useState<string | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);

  useEffect(() => {
    fetchPublicProfile(params.userId).then((result) => {
      setAuthor(result?.author ?? null);
      setJoinedAt(result?.joinedAt ?? null);
    });
    fetchPostsByAuthor(params.userId).then(setPosts);
  }, [params.userId]);

  if (author === null) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center text-sm text-[var(--color-text-muted)]">
        {t("error.userNotFound")}
      </div>
    );
  }

  if (author === undefined) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center text-sm text-[var(--color-text-muted)]">
        {t("common.loading")}
      </div>
    );
  }

  const countryOption = COUNTRIES.find((c) => c.code === author.country);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-4 flex items-center gap-4">
        <Avatar nickname={author.nickname} avatarUrl={author.avatarUrl} size={64} />
        <div>
          <p className="text-lg font-bold">{author.nickname}</p>
          <p className="text-sm text-[var(--color-text-muted)]">
            {countryOption?.flag} {countryOption && t(countryOption.labelKey as DictionaryKey)}
          </p>
          {joinedAt && (
            <p className="text-xs text-[var(--color-text-muted)]">
              {t("profile.joinedAt")} {formatDate(joinedAt)}
            </p>
          )}
        </div>
      </div>

      <div className="mb-6 flex gap-2">
        <button
          onClick={() => router.push(`/messages/${author.id}`)}
          className="flex-1 rounded-md bg-[var(--color-brand-red)] py-2 text-sm font-medium text-white"
        >
          {t("post.sendMessage")}
        </button>
        <button
          onClick={() => setReportOpen(true)}
          className="flex-1 rounded-md border border-[var(--color-border-gray)] py-2 text-sm font-medium"
        >
          {t("post.report")}
        </button>
      </div>

      <h2 className="mb-2 text-sm font-semibold">{t("profile.writtenPosts")}</h2>
      <ul className="rounded-lg border border-[var(--color-border-gray)] px-3">
        {posts.length === 0 && (
          <li className="py-8 text-center text-sm text-[var(--color-text-muted)]">
            {t("board.noPosts")}
          </li>
        )}
        {posts.map((post) => (
          <PostListItem key={post.id} post={post} />
        ))}
      </ul>

      {reportOpen && (
        <ReportModal target={{ type: "user", id: author.id }} onClose={() => setReportOpen(false)} />
      )}
    </div>
  );
}
