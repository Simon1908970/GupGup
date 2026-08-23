import { createClient } from "@/lib/supabase/client";

export async function fetchBlockedIds(userId: string): Promise<string[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("blocks")
    .select("blocked_id")
    .eq("blocker_id", userId);
  if (error) throw error;
  return (data ?? []).map((b) => b.blocked_id);
}

export async function blockUser(blockerId: string, blockedId: string) {
  const supabase = createClient();
  const { error } = await supabase
    .from("blocks")
    .insert({ blocker_id: blockerId, blocked_id: blockedId });
  if (error) throw error;
}
