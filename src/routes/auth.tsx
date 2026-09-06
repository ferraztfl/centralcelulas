import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { ArrowRight, LockKeyhole, ShieldCheck } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { AuthShell } from "@/components/auth/auth-shell";
import { AuthField } from "@/components/auth/auth-field";
import { AccessStatusCard } from "@/components/auth/access-status-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      {
        title: "Entrar | Central de Células - Igreja do Amor",
      },
      {
        name: "description",
        content: "Acesso à Área de Membros da Central de Células da Igreja do Amor.",
      },
    ],
  }),
  component: LoginPage,
});

const signInSchema = z.object({
  email: z.string().trim().email("Informe um e-mail válido.").max(255),
  password: z.string().min(1, "Informe sua senha.").max(72),
});

function loginErrorMessage(error: unknown) {
  if (!(error instanceof Error)) {
    return "Não foi possível realizar o login.";
  }

  const normalized = error.message.toLowerCase();

  if (normalized.includes("invalid login credentials")) {
    return "E-mail ou senha incorretos.";
  }

  if (normalized.includes("email not confirmed")) {
    return "Confirme seu endereço de e-mail antes de entrar.";
  }

  return error.message;
}

function LoginPage() {
  const navigate = useNavigate();

  const { user, role, isApprovedMember, isAdmin, accessStatus, loading, signOut } = useAuth();

  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (loading || !user || !isApprovedMember) {
      return;
    }

    if (isAdmin) {
      void navigate({ to: "/admin" });
      return;
    }

    void navigate({ to: "/membros" });
  }, [user, role, isApprovedMember, isAdmin, loading, navigate]);

  const handleSignIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const parsed = signInSchema.safeParse({
      email,
      password,
    });

    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Verifique os dados informados.");
      return;
    }

    setBusy(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: parsed.data.email,
        password: parsed.data.password,
      });

      if (error) {
        throw error;
      }

      toast.success("Login realizado. Verificando seu acesso…");
    } catch (error) {
      toast.error(loginErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  if (!loading && user && !isApprovedMember) {
    return (
      <AuthShell>
        <AccessStatusCard rejected={accessStatus === "rejected"} onSignOut={signOut} />
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <div className="mb-7">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          <ShieldCheck className="size-3.5 text-primary" />
          Acesso protegido
        </div>

        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Área de Membros</h1>

        <p className="mt-3 text-base leading-7 text-muted-foreground">
          Entre com sua conta aprovada para localizar células e acessar as informações internas.
        </p>
      </div>

      <Card className="border-border/60 shadow-xl shadow-slate-950/5">
        <CardContent className="p-6 sm:p-7">
          <form className="space-y-5" onSubmit={(event) => void handleSignIn(event)}>
            <AuthField
              id="email"
              label="E-mail"
              value={email}
              onChange={setEmail}
              type="email"
              autoComplete="email"
              placeholder="seuemail@exemplo.com"
              disabled={busy}
              autoFocus
            />

            <AuthField
              id="password"
              label="Senha"
              value={password}
              onChange={setPassword}
              type="password"
              autoComplete="current-password"
              placeholder="Digite sua senha"
              disabled={busy}
            />

            <Button type="submit" disabled={busy} className="h-11 w-full" size="lg">
              <LockKeyhole className="mr-2 size-4" />
              {busy ? "Entrando…" : "Entrar na Área de Membros"}
            </Button>
          </form>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">NOVO POR AQUI?</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <div className="rounded-2xl bg-muted/45 p-4">
            <p className="text-sm font-semibold">Ainda não possui acesso?</p>

            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Crie sua conta e envie uma solicitação para aprovação.
            </p>

            <Button asChild variant="outline" className="mt-4 w-full">
              <Link to="/solicitar-acesso">
                Solicitar acesso
                <ArrowRight className="ml-2 size-4" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <p className="mt-5 text-center text-xs leading-5 text-muted-foreground">
        Endereços, contatos e informações de líderes são protegidos e liberados somente para
        usuários aprovados.
      </p>
    </AuthShell>
  );
}
