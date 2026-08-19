import { createClient } from "@/lib/supabase/client";
import type { Author, CountryCode } from "@/lib/types";

export interface PublicProfile {
  author: Author;
  joinedAt: string;
}

export async function fetchPublicProfile(id: string): Promise<PublicProfile | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, nickname, country, avatar_url, is_withdrawn, created_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    author: {
      id: data.id,
      nickname: data.nickname,
      country: data.country as CountryCode,
      avatarUrl: data.avatar_url ?? undefined,
      isWithdrawn: data.is_withdrawn,
    },
    joinedAt: data.created_at,
  };
}
