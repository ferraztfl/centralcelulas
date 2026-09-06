import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireApprovedAdmin, requireSuperAdmin, SUPER_ADMIN_EMAIL } from "@/lib/authz.server";

type AccessStatus = "pending" | "approved" | "rejected";

const EmptyInput = z.object({});

const UserActionInput = z.object({
  userId: z.string().uuid(),
});

async function getTargetIdentity(userId: string) {
  const [{ data: authResult, error: authError }, { data: roles, error: rolesError }] =
    await Promise.all([
      supabaseAdmin.auth.admin.getUserById(userId),

      supabaseAdmin.from("user_roles").select("role").eq("user_id", userId),
    ]);

  if (authError || !authResult.user) {
    throw new Error("Usuário não encontrado.");
  }

  if (rolesError) {
    throw new Error("Não foi possível consultar as permissões do usuário.");
  }

  const email = authResult.user.email?.trim().toLowerCase() ?? null;
  const roleNames = new Set((roles ?? []).map((entry) => entry.role));

  return {
    email,
    isAdmin: roleNames.has("admin"),
    isSuperAdmin: email === SUPER_ADMIN_EMAIL,
  };
}

export const listAdminUsers = createServerFn({ method: "POST" })
  .validator((d) => EmptyInput.parse(d ?? {}))
  .handler(async () => {
    const currentAccess = await requireApprovedAdmin();

    const [
      { data: profiles, error: profilesError },
      { data: roles, error: rolesError },
      { data: usersResult, error: usersError },
    ] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("id, display_name, access_status, created_at, updated_at, approved_at, rejected_at")
        .order("created_at", { ascending: false }),

      supabaseAdmin.from("user_roles").select("user_id, role"),

      supabaseAdmin.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      }),
    ]);

    if (profilesError) throw profilesError;
    if (rolesError) throw rolesError;
    if (usersError) throw usersError;

    const roleMap = new Map<string, string[]>();

    for (const role of roles ?? []) {
      const list = roleMap.get(role.user_id) ?? [];
      list.push(role.role);
      roleMap.set(role.user_id, list);
    }

    const authUserMap = new Map(
      (usersResult?.users ?? []).map((user) => [
        user.id,
        {
          email: user.email ?? "",
          lastSignInAt: user.last_sign_in_at ?? null,
          createdAt: user.created_at ?? null,
        },
      ]),
    );

    return {
      currentUser: {
        id: currentAccess.userId,
        role: currentAccess.role,
        isSuperAdmin: currentAccess.role === "super_admin",
      },

      users: (profiles ?? []).map((profile) => {
        const authUser = authUserMap.get(profile.id);
        const email = authUser?.email?.trim().toLowerCase() ?? "";
        const databaseRoles = roleMap.get(profile.id) ?? [];

        const effectiveRole =
          email === SUPER_ADMIN_EMAIL && databaseRoles.includes("admin")
            ? "super_admin"
            : databaseRoles.includes("admin")
              ? "admin"
              : databaseRoles.includes("user")
                ? "user"
                : null;

        return {
          id: profile.id,
          email: authUser?.email ?? "",
          displayName: profile.display_name ?? authUser?.email ?? "Usuário sem nome",
          accessStatus: (profile.access_status ?? "pending") as AccessStatus,
          roles: databaseRoles,
          effectiveRole,
          isSuperAdmin: effectiveRole === "super_admin",
          createdAt: profile.created_at,
          authCreatedAt: authUser?.createdAt ?? null,
          lastSignInAt: authUser?.lastSignInAt ?? null,
          approvedAt: profile.approved_at ?? null,
          rejectedAt: profile.rejected_at ?? null,
        };
      }),
    };
  });

export const approveAdminUser = createServerFn({ method: "POST" })
  .validator((d) => UserActionInput.parse(d))
  .handler(async ({ data }) => {
    const currentAdmin = await requireApprovedAdmin();
    const target = await getTargetIdentity(data.userId);

    if (target.isSuperAdmin) {
      throw new Error("A conta do Super Administrador não pode ser alterada.");
    }

    if (target.isAdmin && currentAdmin.role !== "super_admin") {
      throw new Error("Administradores não podem alterar outro administrador.");
    }

    if (target.isAdmin) {
      throw new Error("Este usuário já é administrador. Use o controle de permissões.");
    }

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({
        access_status: "approved",
        approved_at: new Date().toISOString(),
        approved_by: currentAdmin.userId,
        rejected_at: null,
        rejected_by: null,
      })
      .eq("id", data.userId);

    if (profileError) throw profileError;

    const { error: roleError } = await supabaseAdmin.from("user_roles").upsert(
      {
        user_id: data.userId,
        role: "user",
      },
      {
        onConflict: "user_id,role",
      },
    );

    if (roleError) throw roleError;

    return {
      ok: true as const,
      role: "user" as const,
    };
  });

export const rejectAdminUser = createServerFn({ method: "POST" })
  .validator((d) => UserActionInput.parse(d))
  .handler(async ({ data }) => {
    const currentAdmin = await requireApprovedAdmin();

    if (data.userId === currentAdmin.userId) {
      throw new Error("Você não pode negar o próprio acesso.");
    }

    const target = await getTargetIdentity(data.userId);

    if (target.isSuperAdmin) {
      throw new Error("A conta do Super Administrador não pode ser bloqueada.");
    }

    if (target.isAdmin && currentAdmin.role !== "super_admin") {
      throw new Error("Somente o Super Administrador pode bloquear um administrador.");
    }

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({
        access_status: "rejected",
        rejected_at: new Date().toISOString(),
        rejected_by: currentAdmin.userId,
      })
      .eq("id", data.userId);

    if (profileError) throw profileError;

    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.userId);

    if (roleError) throw roleError;

    return { ok: true as const };
  });

export const promoteUserToAdmin = createServerFn({
  method: "POST",
})
  .validator((d) => UserActionInput.parse(d))
  .handler(async ({ data }) => {
    const superAdmin = await requireSuperAdmin();

    if (data.userId === superAdmin.userId) {
      throw new Error("Você já é o Super Administrador do sistema.");
    }

    const target = await getTargetIdentity(data.userId);

    if (target.isSuperAdmin) {
      throw new Error("A conta do Super Administrador não pode ser alterada.");
    }

    if (target.isAdmin) {
      throw new Error("Este usuário já é administrador.");
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("access_status")
      .eq("id", data.userId)
      .maybeSingle();

    if (profileError) throw profileError;

    if (profile?.access_status !== "approved") {
      throw new Error("Apenas usuários aprovados podem ser promovidos a administrador.");
    }

    const { error: deleteRoleError } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.userId);

    if (deleteRoleError) throw deleteRoleError;

    const { error: insertRoleError } = await supabaseAdmin.from("user_roles").insert({
      user_id: data.userId,
      role: "admin",
    });

    if (insertRoleError) throw insertRoleError;

    return {
      ok: true as const,
      role: "admin" as const,
    };
  });

export const demoteAdminToUser = createServerFn({
  method: "POST",
})
  .validator((d) => UserActionInput.parse(d))
  .handler(async ({ data }) => {
    const superAdmin = await requireSuperAdmin();

    if (data.userId === superAdmin.userId) {
      throw new Error("O Super Administrador não pode ser rebaixado.");
    }

    const target = await getTargetIdentity(data.userId);

    if (target.isSuperAdmin) {
      throw new Error("O Super Administrador não pode ser rebaixado.");
    }

    if (!target.isAdmin) {
      throw new Error("Este usuário não é administrador.");
    }

    const { error: deleteRoleError } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.userId);

    if (deleteRoleError) throw deleteRoleError;

    const { error: insertRoleError } = await supabaseAdmin.from("user_roles").insert({
      user_id: data.userId,
      role: "user",
    });

    if (insertRoleError) throw insertRoleError;

    return {
      ok: true as const,
      role: "user" as const,
    };
  });
