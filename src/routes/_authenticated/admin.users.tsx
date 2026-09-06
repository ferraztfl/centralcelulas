import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Ban,
  CheckCircle2,
  Crown,
  ShieldCheck,
  UserCheck,
  Users,
  UserX,
} from "lucide-react";
import { toast } from "sonner";
import {
  approveAdminUser,
  demoteAdminToUser,
  listAdminUsers,
  promoteUserToAdmin,
  rejectAdminUser,
} from "@/lib/admin-users.functions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/admin/users")({
  head: () => ({
    meta: [
      {
        title: "Usuários e Permissões | Central de Células",
      },
    ],
  }),
  component: UsersPage,
});

type EffectiveRole = "super_admin" | "admin" | "user" | null;

type AccessStatus = "pending" | "approved" | "rejected";

type AdminUser = {
  id: string;
  email: string;
  displayName: string;
  accessStatus: AccessStatus;
  roles: string[];
  effectiveRole: EffectiveRole;
  isSuperAdmin: boolean;
  createdAt: string | null;
  authCreatedAt: string | null;
  lastSignInAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
};

type ActionKind = "approve" | "reject" | "promote" | "demote";

function UsersPage() {
  const queryClient = useQueryClient();

  const listUsersFn = useServerFn(listAdminUsers);

  const approveUserFn = useServerFn(approveAdminUser);

  const rejectUserFn = useServerFn(rejectAdminUser);

  const promoteUserFn = useServerFn(promoteUserToAdmin);

  const demoteUserFn = useServerFn(demoteAdminToUser);

  const [busyUserId, setBusyUserId] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () =>
      listUsersFn({
        data: {},
      }),
  });

  const users: AdminUser[] = data?.users ?? [];

  const currentUserId = data?.currentUser.id ?? null;

  const currentIsSuperAdmin = data?.currentUser.isSuperAdmin ?? false;

  const pendingCount = users.filter((user) => user.accessStatus === "pending").length;

  const approvedCount = users.filter((user) => user.accessStatus === "approved").length;

  const adminCount = users.filter(
    (user) => user.effectiveRole === "admin" || user.effectiveRole === "super_admin",
  ).length;

  const rejectedCount = users.filter((user) => user.accessStatus === "rejected").length;

  const orderedUsers = [...users].sort((a, b) => {
    if (a.isSuperAdmin) return -1;
    if (b.isSuperAdmin) return 1;

    if (a.accessStatus === "pending" && b.accessStatus !== "pending") {
      return -1;
    }

    if (b.accessStatus === "pending" && a.accessStatus !== "pending") {
      return 1;
    }

    return (
      new Date(b.authCreatedAt ?? b.createdAt ?? 0).getTime() -
      new Date(a.authCreatedAt ?? a.createdAt ?? 0).getTime()
    );
  });

  const runAction = async (kind: ActionKind, user: AdminUser) => {
    const confirmation =
      kind === "reject"
        ? `Bloquear o acesso de ${user.displayName || user.email}?`
        : kind === "promote"
          ? `Promover ${user.displayName || user.email} para Administrador?`
          : kind === "demote"
            ? `Rebaixar ${user.displayName || user.email} para Consulta?`
            : null;

    if (confirmation && !confirm(confirmation)) {
      return;
    }

    setBusyUserId(user.id);

    try {
      if (kind === "approve") {
        await approveUserFn({
          data: {
            userId: user.id,
          },
        });

        toast.success(
          user.accessStatus === "rejected"
            ? "Usuário reativado como Consulta."
            : "Usuário aprovado como Consulta.",
        );
      }

      if (kind === "reject") {
        await rejectUserFn({
          data: {
            userId: user.id,
          },
        });

        toast.success("Acesso do usuário bloqueado.");
      }

      if (kind === "promote") {
        await promoteUserFn({
          data: {
            userId: user.id,
          },
        });

        toast.success("Usuário promovido a Administrador.");
      }

      if (kind === "demote") {
        await demoteUserFn({
          data: {
            userId: user.id,
          },
        });

        toast.success("Administrador rebaixado para Consulta.");
      }

      await queryClient.invalidateQueries({
        queryKey: ["admin-users"],
      });
    } catch (actionError) {
      toast.error(
        actionError instanceof Error
          ? actionError.message
          : "Não foi possível concluir a operação.",
      );
    } finally {
      setBusyUserId(null);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-5 md:p-10">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight">Usuários e permissões</h1>

          {currentIsSuperAdmin && (
            <Badge className="gap-1">
              <Crown className="size-3.5" />
              Super Admin
            </Badge>
          )}
        </div>

        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          Aprove novos cadastros, bloqueie acessos e gerencie os níveis de permissão da Central de
          Células.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard icon={<Users className="size-4" />} label="Total" value={users.length} />

        <SummaryCard
          icon={<UserCheck className="size-4" />}
          label="Aprovados"
          value={approvedCount}
        />

        <SummaryCard
          icon={<ShieldCheck className="size-4" />}
          label="Administradores"
          value={adminCount}
        />

        <SummaryCard
          icon={<UserX className="size-4" />}
          label={`Pendentes ${pendingCount} · Bloqueados ${rejectedCount}`}
          value={pendingCount + rejectedCount}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Contas cadastradas</CardTitle>

          <CardDescription>
            Administradores podem aprovar e bloquear usuários de Consulta. Somente o Super Admin
            pode promover, rebaixar ou bloquear administradores.
          </CardDescription>
        </CardHeader>

        <CardContent>
          {isLoading && <p className="text-sm text-muted-foreground">Carregando usuários…</p>}

          {error && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              {error instanceof Error ? error.message : "Erro ao carregar usuários."}
            </div>
          )}

          {!isLoading && !error && orderedUsers.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum usuário cadastrado.</p>
          )}

          {!isLoading && !error && orderedUsers.length > 0 && (
            <div className="divide-y">
              {orderedUsers.map((user) => {
                const isBusy = busyUserId === user.id;

                const isSelf = currentUserId === user.id;

                const isAdminTarget = user.effectiveRole === "admin";

                const isConsultTarget = user.effectiveRole === "user";

                const canApprove =
                  !user.isSuperAdmin && !isAdminTarget && user.accessStatus !== "approved";

                const canBlock =
                  !isSelf &&
                  !user.isSuperAdmin &&
                  user.accessStatus !== "rejected" &&
                  (!isAdminTarget || currentIsSuperAdmin);

                const canPromote =
                  currentIsSuperAdmin &&
                  !isSelf &&
                  isConsultTarget &&
                  user.accessStatus === "approved";

                const canDemote =
                  currentIsSuperAdmin &&
                  !isSelf &&
                  isAdminTarget &&
                  user.accessStatus === "approved";

                return (
                  <div
                    key={user.id}
                    className="flex flex-col gap-4 py-5 first:pt-0 last:pb-0 lg:flex-row lg:items-center lg:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">{user.displayName || "Usuário sem nome"}</p>

                        {statusBadge(user.accessStatus)}

                        {roleBadge(user.effectiveRole)}

                        {isSelf && <Badge variant="outline">Você</Badge>}
                      </div>

                      <p className="mt-1 truncate text-sm text-muted-foreground">{user.email}</p>

                      <p className="mt-2 text-xs text-muted-foreground">
                        Cadastro: {formatDate(user.authCreatedAt ?? user.createdAt)}
                        {" · "}
                        Último acesso: {formatDate(user.lastSignInAt)}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2 lg:justify-end">
                      {canApprove && (
                        <Button
                          type="button"
                          size="sm"
                          disabled={isBusy}
                          onClick={() => void runAction("approve", user)}
                        >
                          <CheckCircle2 className="mr-1 size-4" />
                          {user.accessStatus === "rejected" ? "Reativar" : "Aprovar"}
                        </Button>
                      )}

                      {canPromote && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={isBusy}
                          onClick={() => void runAction("promote", user)}
                        >
                          <ArrowUp className="mr-1 size-4" />
                          Promover para Admin
                        </Button>
                      )}

                      {canDemote && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={isBusy}
                          onClick={() => void runAction("demote", user)}
                        >
                          <ArrowDown className="mr-1 size-4" />
                          Rebaixar para Consulta
                        </Button>
                      )}

                      {canBlock && (
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          disabled={isBusy}
                          onClick={() => void runAction("reject", user)}
                        >
                          <Ban className="mr-1 size-4" />
                          Bloquear
                        </Button>
                      )}

                      {!canApprove && !canPromote && !canDemote && !canBlock && (
                        <span className="inline-flex items-center px-2 text-xs text-muted-foreground">
                          Nenhuma ação disponível
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function formatDate(value?: string | null) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function statusBadge(status: AccessStatus) {
  if (status === "approved") {
    return <Badge>Aprovado</Badge>;
  }

  if (status === "rejected") {
    return <Badge variant="destructive">Bloqueado</Badge>;
  }

  return <Badge variant="secondary">Pendente</Badge>;
}

function roleBadge(role: EffectiveRole) {
  if (role === "super_admin") {
    return (
      <Badge variant="outline" className="gap-1">
        <Crown className="size-3" />
        Super Admin
      </Badge>
    );
  }

  if (role === "admin") {
    return <Badge variant="outline">Administrador</Badge>;
  }

  if (role === "user") {
    return <Badge variant="outline">Consulta</Badge>;
  }

  return null;
}

function SummaryCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          {icon}
          {label}
        </div>

        <div className="mt-2 text-3xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}
