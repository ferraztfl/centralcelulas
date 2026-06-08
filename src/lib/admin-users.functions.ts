import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type AccessStatus = "pending" | "approved" | "rejected";

const EmptyInput = z.object({});
const UserActionInput = z.object({
  userId: z.string().uuid(),
});

async function requireApprovedAdmin() {
  const request = getRequest();
  const authHeader = request?.headers?.get("authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("Não autorizado.");
  }

  const token = authHeader.replace("Bearer ", "").trim();

  if (!token) {
    throw new Error("Não autorizado.");
  }

  const { data: userResult, error: userError } = await supabaseAdmin.auth.getUser(token);

  if (userError || !userResult.user) {
    throw new Error("Sessão inválida.");
  }

  const userId = userResult.user.id;

  const [{ data: roleData, error: roleError }, { data: profileData, error: profileError }] = await Promise.all([
    supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle(),
    supabaseAdmin
      .from("profiles")
      .select("access_status")
      .eq("id", userId)
      .maybeSingle(),
  ]);

  if (roleError || profileError || !roleData || profileData?.access_status !== "approved") {
    throw new Error("Apenas administradores aprovados podem executar esta ação.");
  }

  return userId;
}

export const listAdminUsers = createServerFn({ method: "POST" })
  .inputValidator((d) => EmptyInput.parse(d ?? {}))
  .handler(async () => {
    await requireApprovedAdmin();

    const [{ data: profiles, error: profilesError }, { data: roles, error: rolesError }, { data: usersResult, error: usersError }] =
      await Promise.all([
        supabaseAdmin
          .from("profiles")
          .select("id, display_name, access_status, created_at, updated_at, approved_at, rejected_at")
          .order("created_at", { ascending: false }),
        supabaseAdmin
          .from("user_roles")
          .select("user_id, role"),
        supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
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
      users: (profiles ?? []).map((profile) => {
        const authUser = authUserMap.get(profile.id);

        return {
          id: profile.id,
          email: authUser?.email ?? "",
          displayName: profile.display_name ?? authUser?.email ?? "Usuário sem nome",
          accessStatus: (profile.access_status ?? "pending") as AccessStatus,
          roles: roleMap.get(profile.id) ?? [],
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
  .inputValidator((d) => UserActionInput.parse(d))
  .handler(async ({ data }) => {
    const currentAdminId = await requireApprovedAdmin();

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({
        access_status: "approved",
        approved_at: new Date().toISOString(),
        approved_by: currentAdminId,
        rejected_at: null,
        rejected_by: null,
      })
      .eq("id", data.userId);

    if (profileError) throw profileError;

    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .upsert(
        {
          user_id: data.userId,
          role: "admin",
        },
        { onConflict: "user_id,role" },
      );

    if (roleError) throw roleError;

    return { ok: true as const };
  });

export const rejectAdminUser = createServerFn({ method: "POST" })
  .inputValidator((d) => UserActionInput.parse(d))
  .handler(async ({ data }) => {
    const currentAdminId = await requireApprovedAdmin();

    if (data.userId === currentAdminId) {
      throw new Error("Você não pode negar o próprio acesso.");
    }

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({
        access_status: "rejected",
        rejected_at: new Date().toISOString(),
        rejected_by: currentAdminId,
      })
      .eq("id", data.userId);

    if (profileError) throw profileError;

    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.userId)
      .eq("role", "admin");

    if (roleError) throw roleError;

    return { ok: true as const };
  });
