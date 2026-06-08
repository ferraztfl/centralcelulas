import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AccessStatus = "pending" | "approved" | "rejected" | null;

type Ctx = {
  user: User | null;
  session: Session | null;
  isAdmin: boolean;
  accessStatus: AccessStatus;
  loading: boolean;
  signOut: () => Promise<void>;
};

const AuthCtx = createContext<Ctx | null>(null);

async function checkUserAccess(userId: string): Promise<{ isAdmin: boolean; accessStatus: AccessStatus }> {
  const [{ data: roleData, error: roleError }, { data: profileData, error: profileError }] = await Promise.all([
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("access_status")
      .eq("id", userId)
      .maybeSingle(),
  ]);

  if (roleError) {
    console.error("[useAuth] Failed to fetch admin role:", roleError);
  }

  if (profileError) {
    console.error("[useAuth] Failed to fetch profile access status:", profileError);
  }

  const accessStatus = (profileData?.access_status ?? null) as AccessStatus;
  const isAdmin = !!roleData && accessStatus === "approved";

  return { isAdmin, accessStatus };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [accessStatus, setAccessStatus] = useState<AccessStatus>(null);
  const [loading, setLoading] = useState(true);
  const lastCheckedUserId = useRef<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const resolveForUser = async (s: Session | null, force = false) => {
      if (!mounted) return;

      setSession(s);

      if (!s?.user) {
        lastCheckedUserId.current = null;
        setIsAdmin(false);
        setAccessStatus(null);
        setLoading(false);
        return;
      }

      if (!force && lastCheckedUserId.current === s.user.id) {
        setLoading(false);
        return;
      }

      setLoading(true);

      const access = await checkUserAccess(s.user.id);

      if (!mounted) return;

      lastCheckedUserId.current = s.user.id;
      setIsAdmin(access.isAdmin);
      setAccessStatus(access.accessStatus);
      setLoading(false);
    };

    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === "SIGNED_OUT") {
        lastCheckedUserId.current = null;
        setSession(null);
        setIsAdmin(false);
        setAccessStatus(null);
        setLoading(false);
        return;
      }

      setTimeout(() => {
        void resolveForUser(s, event === "SIGNED_IN" || event === "TOKEN_REFRESHED");
      }, 0);
    });

    supabase.auth.getSession().then(({ data }) => {
      void resolveForUser(data.session, true);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    lastCheckedUserId.current = null;
    setSession(null);
    setIsAdmin(false);
    setAccessStatus(null);
  };

  return (
    <AuthCtx.Provider value={{ user: session?.user ?? null, session, isAdmin, accessStatus, loading, signOut }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const c = useContext(AuthCtx);
  if (!c) throw new Error("useAuth must be used within AuthProvider");
  return c;
}
