import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type Profile = {
  id: string;
  display_name: string;
  avatar_url: string | null;
};

type AuthCtx = {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signUp: (email: string, password: string, displayName?: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateDisplayName: (name: string) => Promise<{ error: string | null }>;
};

const AuthContext = createContext<AuthCtx | undefined>(undefined);

async function loadProfile(uid: string): Promise<Profile | null> {
  const { data } = await supabase.from("profiles").select("*").eq("id", uid).single();
  return data ?? null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]       = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Safety: never hang on loading longer than 5s
    const timeout = setTimeout(() => setLoading(false), 5000);

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s); setUser(s?.user ?? null);
      if (s?.user) {
        loadProfile(s.user.id).then(setProfile).finally(() => {
          clearTimeout(timeout);
          setLoading(false);
        });
      } else {
        clearTimeout(timeout);
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, s) => {
      setSession(s); setUser(s?.user ?? null);
      if (s?.user) setProfile(await loadProfile(s.user.id));
      else setProfile(null);
      setLoading(false);
    });

    return () => { subscription.unsubscribe(); clearTimeout(timeout); };
  }, []);

  const signUp = async (email: string, password: string, displayName?: string) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return { error: error.message };
    if (data.user && displayName) {
      await supabase.from("profiles").upsert({
        id: data.user.id,
        display_name: displayName,
        avatar_url: null,
      });
    }
    return { error: null };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };

  const signOut = async () => { await supabase.auth.signOut(); };

  const refreshProfile = async () => {
    if (user) setProfile(await loadProfile(user.id));
  };

  const updateDisplayName = async (name: string): Promise<{ error: string | null }> => {
    if (!user) return { error: "Not logged in" };
    const { error } = await supabase.from("profiles").update({ display_name: name.trim() }).eq("id", user.id);
    if (error) return { error: error.message };
    setProfile((p) => p ? { ...p, display_name: name.trim() } : p);
    return { error: null };
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, signUp, signIn, signOut, refreshProfile, updateDisplayName }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
