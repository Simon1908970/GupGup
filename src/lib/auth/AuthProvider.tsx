"use client";

import type { Session, User } from "@supabase/supabase-js";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export interface Profile {
  id: string;
  nickname: string;
  country: string;
  avatar_url: string | null;
  points: number;
}

interface ProfileRow {
  id: string;
  nickname: string;
  country: string;
  avatar_url: string | null;
  is_withdrawn: boolean;
}

interface AuthContextValue {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  unreadCount: number;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const isSupabaseConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

const AuthContext = createContext<AuthContextValue>({
  user: null,
  profile: null,
  loading: false,
  unreadCount: 0,
  signOut: async () => {},
  refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const router = useRouter();

  const supabase = useMemo(
    () => (isSupabaseConfigured ? createClient() : null),
    [],
  );

  useEffect(() => {
    if (!supabase) return;
    const client = supabase;

    async function loadProfile(nextUser: User | null) {
      if (!nextUser) {
        setUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }
      const { data } = await client
        .from("profiles")
        .select("id, nickname, country, avatar_url, is_withdrawn")
        .eq("id", nextUser.id)
        .single();
      const row = data as ProfileRow | null;
      if (row?.is_withdrawn) {
        await client.auth.signOut();
        setUser(null);
        setProfile(null);
        setLoading(false);
        router.push("/login?withdrawn=1");
        return;
      }
      setUser(nextUser);
      if (row) {
        const { data: points } = await client.rpc("get_my_points");
        setProfile({ ...row, points: points ?? 0 });
      } else {
        setProfile(null);
      }
      setLoading(false);
    }

    client.auth.getSession().then(({ data }: { data: { session: Session | null } }) => {
      loadProfile(data.session?.user ?? null);
    });

    const { data: listener } = client.auth.onAuthStateChange((_event, session) => {
      loadProfile(session?.user ?? null);
    });

    return () => listener.subscription.unsubscribe();
  }, [supabase]);

  const value: AuthContextValue = {
    user,
    profile,
    loading,
    unreadCount: 0,
    signOut: async () => {
      await supabase?.auth.signOut();
    },
    refreshProfile: async () => {
      if (!supabase || !user) return;
      const { data: row } = await supabase
        .from("profiles")
        .select("id, nickname, country, avatar_url")
        .eq("id", user.id)
        .single();
      if (!row) {
        setProfile(null);
        return;
      }
      const { data: points } = await supabase.rpc("get_my_points");
      setProfile({ ...row, points: points ?? 0 });
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
