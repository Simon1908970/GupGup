"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { deletePost, fetchPostsByAuthor } from "@/lib/supabase/posts";
import type { Post } from "@/lib/types";
import { PostListItem } from "@/components/board/PostListItem";
import { ConfirmModal } from "@/components/common/ConfirmModal";

export default function MyPostsPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const { user, loading, refreshProfile } = useAuth();
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Post | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    fetchPostsByAuthor(user.id).then(setPosts);
  }, [user]);

  async function handleConfirmDelete() {
    if (!user || !pendingDelete) return;
    const postId = pendingDelete.id;
    setPendingDelete(null);
    await deletePost(postId, user.id, pendingDelete.pointsAwarded);
    setPosts((prev) => prev?.filter((p) => p.id !== postId) ?? null);
    await refreshProfile();
  }

  if (loading || !user || posts === null) {
    return <div className="px-4 py-16 text-center text-sm text-[var(--color-text-muted)]">{t("common.loading")}</div>;
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-4 text-lg font-bold">{t("profile.myPosts")}</h1>
      <ul className="relative rounded-lg border border-[var(--color-border-gray)] px-3 gg-glossy">
        {posts.length === 0 && (
          <li className="py-8 text-center text-sm text-[var(--color-text-muted)]">
            {t("board.noPosts")}
          </li>
        )}
        {posts.map((post) => (
          <PostListItem key={post.id} post={post} onDelete={() => setPendingDelete(post)} />
        ))}
      </ul>
      {pendingDelete && (
        <ConfirmModal
          message={
            pendingDelete.pointsAwarded !== 0
              ? `${t("points.deleteConfirmMessage")} (${pendingDelete.pointsAwarded > 0 ? "-" : "+"}${Math.abs(pendingDelete.pointsAwarded)}P)\n${t("post.deleteConfirm")}`
              : t("post.deleteConfirm")
          }
          onConfirm={handleConfirmDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
}
