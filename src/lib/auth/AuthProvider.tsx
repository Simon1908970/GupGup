"use client";

import type { Session, User } from "@supabase/supabase-js";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { createClient } from "@/lib/supabase/client";

export interface Profile {
  id: string;
  nickname: string;
  country: string;
  avatar_url: string | null;
}

interface AuthContextValue {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  unreadCount: number;
  signOut: () => Promise<void>;
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
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);

  const supabase = useMemo(
    () => (isSupabaseConfigured ? createClient() : null),
    [],
  );

  useEffect(() => {
    if (!supabase) return;
    const client = supabase;

    async function loadProfile(nextUser: User | null) {
      setUser(nextUser);
      if (!nextUser) {
        setProfile(null);
        setLoading(false);
        return;
      }
      const { data } = await client
        .from("profiles")
        .select("id, nickname, country, avatar_url")
        .eq("id", nextUser.id)
        .single();
      setProfile(data ?? null);
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
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
