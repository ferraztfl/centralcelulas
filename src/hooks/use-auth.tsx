import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { SUPER_ADMIN_EMAIL, type AccessStatus, type AppAccessRole } from "@/lib/access";

type UserAccess = {
  role: AppAccessRole | null;
  accessStatus: AccessStatus;
};

type Ctx = {
  user: User | null;
  session: Session | null;
  role: AppAccessRole | null;
  isApprovedMember: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  accessStatus: AccessStatus;
  loading: boolean;
  signOut: () => Promise<void>;
};

const AuthCtx = createContext<Ctx | null>(null);

async function checkUserAccess(userId: string, email: string | null): Promise<UserAccess> {
  const [{ data: rolesData, error: rolesError }, { data: profileData, error: profileError }] =
    await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", userId),

      supabase.from("profiles").select("access_status").eq("id", userId).maybeSingle(),
    ]);

  if (rolesError) {
    console.error("[useAuth] Failed to fetch user roles:", rolesError);
  }

  if (profileError) {
    console.error("[useAuth] Failed to fetch profile access status:", profileError);
  }

  const accessStatus = (profileData?.access_status ?? null) as AccessStatus;

  if (rolesError || profileError || accessStatus !== "approved") {
    return {
      role: null,
      accessStatus,
    };
  }

  const roleNames = new Set((rolesData ?? []).map((entry) => entry.role));

  const normalizedEmail = email?.trim().toLowerCase() ?? null;

  const role: AppAccessRole | null =
    normalizedEmail === SUPER_ADMIN_EMAIL && roleNames.has("admin")
      ? "super_admin"
      : roleNames.has("admin")
        ? "admin"
        : roleNames.has("user")
          ? "user"
          : null;

  return {
    role,
    accessStatus,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);

  const [role, setRole] = useState<AppAccessRole | null>(null);

  const [accessStatus, setAccessStatus] = useState<AccessStatus>(null);

  const [loading, setLoading] = useState(true);

  const lastCheckedUserId = useRef<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const resolveForUser = async (currentSession: Session | null, force = false) => {
      if (!mounted) return;

      setSession(currentSession);

      if (!currentSession?.user) {
        lastCheckedUserId.current = null;
        setRole(null);
        setAccessStatus(null);
        setLoading(false);
        return;
      }

      if (!force && lastCheckedUserId.current === currentSession.user.id) {
        setLoading(false);
        return;
      }

      setLoading(true);

      const access = await checkUserAccess(
        currentSession.user.id,
        currentSession.user.email ?? null,
      );

      if (!mounted) return;

      lastCheckedUserId.current = currentSession.user.id;

      setRole(access.role);
      setAccessStatus(access.accessStatus);
      setLoading(false);
    };

    const { data: subscription } = supabase.auth.onAuthStateChange((event, currentSession) => {
      if (event === "SIGNED_OUT") {
        lastCheckedUserId.current = null;
        setSession(null);
        setRole(null);
        setAccessStatus(null);
        setLoading(false);
        return;
      }

      setTimeout(() => {
        void resolveForUser(currentSession, event === "SIGNED_IN" || event === "TOKEN_REFRESHED");
      }, 0);
    });

    void supabase.auth.getSession().then(({ data }) => {
      void resolveForUser(data.session, true);
    });

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();

    lastCheckedUserId.current = null;
    setSession(null);
    setRole(null);
    setAccessStatus(null);
  };

  const isApprovedMember = accessStatus === "approved" && role !== null;

  const isAdmin = role === "admin" || role === "super_admin";

  const isSuperAdmin = role === "super_admin";

  return (
    <AuthCtx.Provider
      value={{
        user: session?.user ?? null,
        session,
        role,
        isApprovedMember,
        isAdmin,
        isSuperAdmin,
        accessStatus,
        loading,
        signOut,
      }}
    >
      {children}
    </AuthCtx.Provider>
  );
}

// O hook é exportado junto do Provider intencionalmente.
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthCtx);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}
