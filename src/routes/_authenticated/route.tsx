import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Link2,
  List,
  LogOut,
  PlusCircle,
  Search,
  Settings,
  Upload,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: AuthLayout,
});

type NavTarget =
  | "/membros"
  | "/admin"
  | "/admin/dashboard"
  | "/admin/cells/new"
  | "/admin/import"
  | "/admin/neighborhoods"
  | "/admin/settings";

type NavItem = {
  to: NavTarget;
  icon: LucideIcon;
  label: string;
  exact?: boolean;
};

function AuthLayout() {
  const { user, role, isApprovedMember, isAdmin, isSuperAdmin, accessStatus, loading, signOut } =
    useAuth();

  const navigate = useNavigate();

  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

  const tryingAdminRoute = pathname === "/admin" || pathname.startsWith("/admin/");

  useEffect(() => {
    if (loading) return;

    if (!user) {
      void navigate({ to: "/auth" });
      return;
    }

    if (isApprovedMember && tryingAdminRoute && !isAdmin) {
      void navigate({ to: "/membros" });
    }
  }, [user, loading, isApprovedMember, tryingAdminRoute, isAdmin, navigate]);

  const handleSignOut = async () => {
    await signOut();
    await navigate({ to: "/auth" });
  };

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Carregando…
      </div>
    );
  }

  if (!isApprovedMember) {
    const title =
      accessStatus === "pending"
        ? "Aguardando aprovação"
        : accessStatus === "rejected"
          ? "Acesso negado"
          : "Acesso restrito";

    const message =
      accessStatus === "pending"
        ? "Seu cadastro foi recebido e está aguardando aprovação."
        : accessStatus === "rejected"
          ? "Sua solicitação de acesso foi negada."
          : "Sua conta ainda não possui um perfil de acesso válido.";

    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-md space-y-4 text-center">
          <img
            src="/central-logo.png"
            alt="Central de Células"
            className="mx-auto h-20 w-auto object-contain"
          />

          <h1 className="text-2xl font-semibold">{title}</h1>

          <p className="text-muted-foreground">{message}</p>

          <Button variant="outline" onClick={handleSignOut}>
            Sair
          </Button>
        </div>
      </div>
    );
  }

  if (tryingAdminRoute && !isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Redirecionando para a Área de Membros…
      </div>
    );
  }

  const navItems: NavItem[] = [
    {
      to: "/membros",
      icon: Search,
      label: "Buscar células",
    },
  ];

  if (isAdmin) {
    navItems.push(
      {
        to: "/admin/dashboard",
        icon: LayoutDashboard,
        label: "Dashboard",
      },
      {
        to: "/admin",
        icon: List,
        label: "Células",
        exact: true,
      },
      {
        to: "/admin/cells/new",
        icon: PlusCircle,
        label: "Nova célula",
      },
      {
        to: "/admin/import",
        icon: Upload,
        label: "Importar CSV",
      },
      {
        to: "/admin/neighborhoods",
        icon: Link2,
        label: "Bairros vizinhos",
      },
      {
        to: "/admin/settings",
        icon: Settings,
        label: "Configurações",
      },
    );
  }

  const roleLabel = isSuperAdmin ? "Super Admin" : role === "admin" ? "Administrador" : "Consulta";

  const isActive = (item: NavItem) => {
    if (item.exact) {
      return pathname === item.to || pathname === `${item.to}/`;
    }

    return pathname.startsWith(item.to);
  };

  return (
    <div className="min-h-screen bg-background md:flex">
      <aside className="hidden w-64 shrink-0 flex-col border-r bg-card/70 md:flex">
        <div className="border-b px-5 py-5">
          <Link to="/membros" className="block">
            <img
              src="/central-logo.png"
              alt="Central de Células"
              className="h-16 w-auto object-contain"
            />
          </Link>

          <div className="mt-3">
            <div className="text-sm font-semibold">Campus Zona Norte</div>

            <div className="mt-1 inline-flex rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
              {roleLabel}
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item);

            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <Icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t p-3">
          <button
            type="button"
            onClick={handleSignOut}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <LogOut className="size-4" />
            Sair
          </button>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur md:hidden">
          <div className="flex h-16 items-center justify-between px-4">
            <Link to="/membros" className="font-semibold">
              Central de Células
            </Link>

            <button
              type="button"
              onClick={handleSignOut}
              className="inline-flex size-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent"
              aria-label="Sair"
            >
              <LogOut className="size-5" />
            </button>
          </div>

          <nav className="flex gap-2 overflow-x-auto border-t px-4 py-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item);

              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-2 text-xs font-medium",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  <Icon className="size-3.5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </header>

        <main className="min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
