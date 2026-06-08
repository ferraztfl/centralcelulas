import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { approveAdminUser, listAdminUsers, rejectAdminUser } from "@/lib/admin-users.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Clock3, ShieldCheck, UserCheck, UserX, XCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  head: () => ({ meta: [{ title: "Configurações • Admin" }] }),
  component: SettingsPage,
});

type AdminUser = {
  id: string;
  email: string;
  displayName: string;
  accessStatus: "pending" | "approved" | "rejected";
  roles: string[];
  createdAt: string | null;
  authCreatedAt: string | null;
  lastSignInAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
};

function formatDate(value?: string | null) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function statusLabel(status: AdminUser["accessStatus"]) {
  if (status === "approved") return "Aprovado";
  if (status === "rejected") return "Negado";
  return "Pendente";
}

function statusBadge(status: AdminUser["accessStatus"]) {
  if (status === "approved") return <Badge className="bg-green-600 hover:bg-green-600">Aprovado</Badge>;
  if (status === "rejected") return <Badge variant="destructive">Negado</Badge>;
  return <Badge variant="secondary">Pendente</Badge>;
}

function SettingsPage() {
  const qc = useQueryClient();
  const listUsersFn = useServerFn(listAdminUsers);
  const approveUserFn = useServerFn(approveAdminUser);
  const rejectUserFn = useServerFn(rejectAdminUser);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => listUsersFn({ data: {} }),
  });

  const users = data?.users ?? [];
  const pendingUsers = users.filter((user) => user.accessStatus === "pending");
  const approvedUsers = users.filter((user) => user.accessStatus === "approved");
  const rejectedUsers = users.filter((user) => user.accessStatus === "rejected");

  const approve = async (userId: string) => {
    setBusyUserId(userId);

    try {
      await approveUserFn({ data: { userId } });
      toast.success("Usuário aprovado.");
      await qc.invalidateQueries({ queryKey: ["admin-users"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao aprovar usuário.");
    } finally {
      setBusyUserId(null);
    }
  };

  const reject = async (userId: string) => {
    if (!confirm("Negar acesso deste usuário?")) return;

    setBusyUserId(userId);

    try {
      await rejectUserFn({ data: { userId } });
      toast.success("Usuário negado.");
      await qc.invalidateQueries({ queryKey: ["admin-users"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao negar usuário.");
    } finally {
      setBusyUserId(null);
    }
  };

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Configurações</h1>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-primary" />
            Usuários e aprovações
          </CardTitle>
          <CardDescription>
            Aprove ou negue novas contas criadas no sistema. Usuários pendentes ou negados não acessam o painel administrativo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid md:grid-cols-3 gap-3">
            <StatusCard icon={<Clock3 className="size-4" />} label="Pendentes" value={pendingUsers.length} />
            <StatusCard icon={<UserCheck className="size-4" />} label="Aprovados" value={approvedUsers.length} />
            <StatusCard icon={<UserX className="size-4" />} label="Negados" value={rejectedUsers.length} />
          </div>

          {isLoading && <p className="text-sm text-muted-foreground">Carregando usuários…</p>}

          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {(error as Error).message}
            </div>
          )}

          {!isLoading && !error && users.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum usuário encontrado.</p>
          )}

          {!isLoading && !error && users.length > 0 && (
            <div className="space-y-3">
              {users.map((user) => {
                const isBusy = busyUserId === user.id;
                const isApproved = user.accessStatus === "approved";
                const isRejected = user.accessStatus === "rejected";

                return (
                  <div key={user.id} className="rounded-lg border p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium truncate">{user.email || user.displayName}</p>
                        {statusBadge(user.accessStatus)}
                        {user.roles.includes("admin") && <Badge variant="outline">admin</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {user.displayName && user.displayName !== user.email ? user.displayName : "Sem nome informado"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Criado em {formatDate(user.authCreatedAt ?? user.createdAt)} · Último acesso {formatDate(user.lastSignInAt)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Status: {statusLabel(user.accessStatus)}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        type="button"
                        size="sm"
                        variant={isApproved ? "outline" : "default"}
                        disabled={isBusy || isApproved}
                        onClick={() => approve(user.id)}
                      >
                        <CheckCircle2 className="size-4 mr-1" />
                        Aprovar
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={isRejected ? "outline" : "destructive"}
                        disabled={isBusy || isRejected}
                        onClick={() => reject(user.id)}
                      >
                        <XCircle className="size-4 mr-1" />
                        Negar
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="size-5 text-net-start" />
            Mapas e geocodificação
          </CardTitle>
          <CardDescription>
            Mapas gratuitos com Leaflet/OpenStreetMap e geocodificação via Geoapify.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            A chave do Geoapify fica protegida somente no servidor em <code>GEOAPIFY_API_KEY</code>.
          </p>
          <p>
            O navegador não recebe nenhuma chave do Geoapify. Os mapas usam tiles públicos do OpenStreetMap via Leaflet.
          </p>
          <p>
            Se a geocodificação não funcionar na importação ou na busca pública, confira se <code>GEOAPIFY_API_KEY</code> está configurada no <code>.env</code> local e nas variáveis de ambiente da Vercel.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function StatusCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </div>
  );
}
