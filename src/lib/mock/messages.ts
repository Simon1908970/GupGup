import { getAllPosts } from "@/lib/mock/posts";
import type { Author } from "@/lib/types";

export interface MockMessage {
  id: string;
  senderId: string;
  body: string;
  createdAt: string;
}

const CURRENT_USER_ID = "me";

function partnerCandidates(): Author[] {
  const seen = new Map<string, Author>();
  for (const post of getAllPosts()) {
    if (!seen.has(post.author.id) && post.author.id !== "gupgup-admin") {
      seen.set(post.author.id, post.author);
    }
  }
  return Array.from(seen.values());
}

export function getThreadPartners(): Author[] {
  return partnerCandidates().slice(0, 3);
}

export function getPartnerById(id: string): Author | undefined {
  return partnerCandidates().find((a) => a.id === id);
}

export function getThreadMessages(partnerId: string): MockMessage[] {
  const partner = getPartnerById(partnerId);
  if (!partner) return [];

  const seed = partnerId.length;
  return [
    {
      id: `${partnerId}-1`,
      senderId: partnerId,
      body: "안녕하세요! 게시글 보고 연락드려요.",
      createdAt: new Date(Date.now() - (seed + 2) * 3600_000).toISOString(),
    },
    {
      id: `${partnerId}-2`,
      senderId: CURRENT_USER_ID,
      body: "네 안녕하세요, 편하게 문의 주세요!",
      createdAt: new Date(Date.now() - (seed + 1) * 3600_000).toISOString(),
    },
  ];
}

export function getLastMessagePreview(partnerId: string): MockMessage | undefined {
  const messages = getThreadMessages(partnerId);
  return messages[messages.length - 1];
}

export { CURRENT_USER_ID };
