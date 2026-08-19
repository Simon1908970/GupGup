import { createClient } from "@/lib/supabase/client";
import type { Author, CountryCode } from "@/lib/types";

export interface ThreadWithPartner {
  threadId: string;
  partner: Author;
  lastMessage?: { body: string; createdAt: string };
}

async function fetchProfilesByIds(ids: string[]): Promise<Map<string, Author>> {
  if (ids.length === 0) return new Map();
  const supabase = createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, nickname, country, avatar_url, is_withdrawn")
    .in("id", ids);
  if (error) throw error;
  const map = new Map<string, Author>();
  for (const row of data ?? []) {
    map.set(row.id, {
      id: row.id,
      nickname: row.nickname,
      country: row.country as CountryCode,
      avatarUrl: row.avatar_url ?? undefined,
      isWithdrawn: row.is_withdrawn,
    });
  }
  return map;
}

export async function fetchThreads(userId: string): Promise<ThreadWithPartner[]> {
  const supabase = createClient();
  const { data: threads, error } = await supabase
    .from("message_threads")
    .select("id, participant_a, participant_b")
    .or(`participant_a.eq.${userId},participant_b.eq.${userId}`);
  if (error) throw error;
  if (!threads || threads.length === 0) return [];

  const partnerIds = threads.map((t) =>
    t.participant_a === userId ? t.participant_b : t.participant_a,
  );
  const profileMap = await fetchProfilesByIds(partnerIds);

  const results: ThreadWithPartner[] = [];
  for (const t of threads) {
    const partnerId = t.participant_a === userId ? t.participant_b : t.participant_a;
    const partner = profileMap.get(partnerId);
    if (!partner) continue;
    const { data: lastMsg } = await supabase
      .from("messages")
      .select("body, created_at")
      .eq("thread_id", t.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    results.push({
      threadId: t.id,
      partner,
      lastMessage: lastMsg ? { body: lastMsg.body, createdAt: lastMsg.created_at } : undefined,
    });
  }
  return results;
}

export async function findOrCreateThread(userId: string, partnerId: string): Promise<string> {
  const supabase = createClient();
  const { data: existing } = await supabase
    .from("message_threads")
    .select("id")
    .or(
      `and(participant_a.eq.${userId},participant_b.eq.${partnerId}),and(participant_a.eq.${partnerId},participant_b.eq.${userId})`,
    )
    .maybeSingle();
  if (existing) return existing.id;

  const { data: created, error } = await supabase
    .from("message_threads")
    .insert({ participant_a: userId, participant_b: partnerId })
    .select("id")
    .single();
  if (error) throw error;
  return created.id;
}

export interface MessageRow {
  id: string;
  threadId: string;
  senderId: string;
  body: string;
  createdAt: string;
}

export async function fetchMessages(threadId: string): Promise<MessageRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("messages")
    .select("id, thread_id, sender_id, body, created_at")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((m) => ({
    id: m.id,
    threadId: m.thread_id,
    senderId: m.sender_id,
    body: m.body,
    createdAt: m.created_at,
  }));
}

export async function sendMessage(threadId: string, senderId: string, body: string) {
  const supabase = createClient();
  const { error } = await supabase
    .from("messages")
    .insert({ thread_id: threadId, sender_id: senderId, body });
  if (error) throw error;
}
