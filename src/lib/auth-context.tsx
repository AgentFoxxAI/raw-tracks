import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export interface Profile {
  id: string;
  username: string | null;
  display_name: string | null;
  email: string | null;
  avatar_url: string | null;
  bio: string | null;
  instruments: string[];
  influences: string | null;
  location: string | null;
  collab_status: "open" | "selective" | "closed";
  links: Array<{ label: string; url: string }>;
  follower_count: number;
  following_count: number;
  tier: "free" | "paid";
  terms_accepted: boolean;
}

interface AuthCtx {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = async (uid: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", uid)
      .maybeSingle();
    if (!data) {
      setProfile(null);
      return;
    }
    setProfile({
      id: data.id,
      username: data.username,
      display_name: (data as { display_name?: string | null }).display_name ?? data.username,
      email: data.email,
      avatar_url: data.avatar_url,
      bio: (data as { bio?: string | null }).bio ?? null,
      instruments: ((data as { instruments?: string[] }).instruments ?? []) as string[],
      influences: (data as { influences?: string | null }).influences ?? null,
      location: (data as { location?: string | null }).location ?? null,
      collab_status:
        ((data as { collab_status?: string }).collab_status as Profile["collab_status"]) ?? "closed",
      links: (((data as { links?: unknown }).links ?? []) as Profile["links"]),
      follower_count: (data as { follower_count?: number }).follower_count ?? 0,
      following_count: (data as { following_count?: number }).following_count ?? 0,
      tier: (data.tier as Profile["tier"]) ?? "free",
      terms_accepted: data.terms_accepted ?? false,
    });
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession?.user) {
        setTimeout(() => {
          void loadProfile(newSession.user.id);
        }, 0);
      } else {
        setProfile(null);
      }
    });

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) void loadProfile(s.user.id);
      setLoading(false);
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  const refreshProfile = async () => {
    if (user) await loadProfile(user.id);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, refreshProfile, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
