import { createFileRoute, Outlet, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, Settings, LogOut, PlusCircle, Search, Upload, Link2, List } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: AuthLayout,
});

function AuthLayout() {
  const { user, isAdmin, accessStatus, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: s => s.location.pathname });

  useEffect(() => {
    if (loading) return;
    if (!user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  if (loading || !user) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Carregando…</div>;
  }

  if (!isAdmin) {
    const title =
      accessStatus === "pending"
        ? "Aguardando aprovação"
        : accessStatus === "rejected"
          ? "Acesso negado"
          : "Acesso restrito";

    const message =
      accessStatus === "pending"
        ? "Sua conta foi criada, mas ainda precisa ser aprovada por um administrador."
        : accessStatus === "rejected"
          ? "Sua solicitação de acesso ao painel administrativo foi negada."
          : "Sua conta não tem permissão de administrador.";

    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md text-center space-y-4">
          <h1 className="text-2xl font-semibold">{title}</h1>
          <p className="text-muted-foreground">{message}</p>
          <Button variant="outline" onClick={async () => { await signOut(); navigate({ to: "/auth" }); }}>Sair</Button>
        </div>
      </div>
    );
  }

  const navItems = [
    { to: "/admin/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { to: "/admin", icon: List, label: "Células", exact: true },
    { to: "/admin/cells/new", icon: PlusCircle, label: "Nova célula" },
    { to: "/admin/import", icon: Upload, label: "Importar CSV" },
    { to: "/admin/neighborhoods", icon: Link2, label: "Bairros vizinhos" },
    { to: "/admin/settings", icon: Settings, label: "Configurações" },
  ] as const;

  return (
    <div className="min-h-screen flex">
      <aside className="w-64 border-r bg-card/50 hidden md:flex md:flex-col">
        <div className="px-6 py-5 border-b">
          <div className="font-bold text-lg tracking-tight">Localizador</div>
          <div className="text-xs text-muted-foreground">Painel administrativo</div>

          <div className="mt-4 space-y-1">
            <Link to="/" className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground">
              <Search className="size-4" /> Ver página pública
            </Link>
            <button onClick={async () => { await signOut(); navigate({ to: "/auth" }); }}
              className="w-full flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground">
              <LogOut className="size-4" /> Sair
            </button>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(item => {
            const Icon = item.icon;
            const active = (item as any).exact
              ? (pathname === item.to || pathname === "/admin/")
              : pathname.startsWith(item.to);
            return (
              <Link key={item.to} to={item.to} className={cn(
                "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}>
                <Icon className="size-4" /> {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <main className="flex-1 min-w-0"><Outlet /></main>
    </div>
  );
}
