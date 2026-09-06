import { getRequest } from "@tanstack/react-start/server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

import { SUPER_ADMIN_EMAIL, type AppAccessRole } from "@/lib/access";

export { SUPER_ADMIN_EMAIL };
export type { AppAccessRole };

export type ApprovedAccess = {
  userId: string;
  email: string | null;
  role: AppAccessRole;
};

function getBearerToken() {
  const request = getRequest();
  const authHeader = request?.headers?.get("authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("Não autorizado. Faça login para continuar.");
  }

  const token = authHeader.slice("Bearer ".length).trim();

  if (!token) {
    throw new Error("Não autorizado. Faça login para continuar.");
  }

  return token;
}

export async function requireApprovedMember(): Promise<ApprovedAccess> {
  const token = getBearerToken();

  const { data: userResult, error: userError } = await supabaseAdmin.auth.getUser(token);

  if (userError || !userResult.user) {
    throw new Error("Sessão inválida ou expirada.");
  }

  const userId = userResult.user.id;
  const email = userResult.user.email?.trim().toLowerCase() ?? null;

  const [{ data: profile, error: profileError }, { data: roles, error: rolesError }] =
    await Promise.all([
      supabaseAdmin.from("profiles").select("access_status").eq("id", userId).maybeSingle(),

      supabaseAdmin.from("user_roles").select("role").eq("user_id", userId),
    ]);

  if (profileError || rolesError) {
    console.error("[authz] Failed to resolve access", {
      profileError,
      rolesError,
      userId,
    });

    throw new Error("Não foi possível validar sua permissão.");
  }

  if (profile?.access_status !== "approved") {
    throw new Error("Sua conta ainda não possui acesso aprovado.");
  }

  const roleNames = new Set((roles ?? []).map((entry) => entry.role));
  const hasAdminRole = roleNames.has("admin");

  const role: AppAccessRole | null =
    email === SUPER_ADMIN_EMAIL && hasAdminRole
      ? "super_admin"
      : hasAdminRole
        ? "admin"
        : roleNames.has("user")
          ? "user"
          : null;

  if (!role) {
    throw new Error("Sua conta não possui um perfil de acesso válido.");
  }

  return {
    userId,
    email,
    role,
  };
}

export async function requireApprovedAdmin(): Promise<ApprovedAccess> {
  const access = await requireApprovedMember();

  if (access.role !== "admin" && access.role !== "super_admin") {
    throw new Error("Esta operação é permitida somente para administradores.");
  }

  return access;
}

export async function requireSuperAdmin(): Promise<ApprovedAccess> {
  const access = await requireApprovedMember();

  if (access.role !== "super_admin" || access.email !== SUPER_ADMIN_EMAIL) {
    throw new Error("Esta operação é permitida somente para o Super Administrador.");
  }

  return access;
}
