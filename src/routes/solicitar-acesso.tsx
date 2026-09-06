import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { ArrowRight, CheckCircle2, ShieldCheck, UserPlus } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { AuthShell } from "@/components/auth/auth-shell";
import { AuthField } from "@/components/auth/auth-field";
import { AccessStatusCard } from "@/components/auth/access-status-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/solicitar-acesso")({
  head: () => ({
    meta: [
      {
        title: "Solicitar acesso | Central de Células - Igreja do Amor",
      },
      {
        name: "description",
        content: "Solicite acesso à Central de Células da Igreja do Amor - Campus Zona Norte.",
      },
    ],
  }),
  component: RequestAccessPage,
});

const signUpSchema = z
  .object({
    displayName: z
      .string()
      .trim()
      .min(3, "Informe seu nome completo.")
      .max(120, "Nome muito longo."),
    email: z.string().trim().email("Informe um e-mail válido.").max(255),
    password: z.string().min(8, "A senha deve ter pelo menos 8 caracteres.").max(72),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas não conferem.",
    path: ["confirmPassword"],
  });

function signupErrorMessage(error: unknown) {
  if (!(error instanceof Error)) {
    return "Não foi possível enviar sua solicitação.";
  }

  const normalized = error.message.toLowerCase();

  if (
    normalized.includes("user already registered") ||
    normalized.includes("already been registered")
  ) {
    return "Já existe uma conta cadastrada com este e-mail.";
  }

  return error.message;
}

function RequestAccessPage() {
  const navigate = useNavigate();

  const { user, role, isApprovedMember, isAdmin, accessStatus, loading, signOut } = useAuth();

  const [busy, setBusy] = useState(false);
  const [signupRequested, setSignupRequested] = useState(false);

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

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

  const handleSignUp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const parsed = signUpSchema.safeParse({
      displayName,
      email,
      password,
      confirmPassword,
    });

    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Verifique os dados informados.");
      return;
    }

    setBusy(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email: parsed.data.email,
        password: parsed.data.password,
        options: {
          emailRedirectTo: window.location.origin + "/auth",
          data: {
            display_name: parsed.data.displayName,
          },
        },
      });

      if (error) {
        throw error;
      }

      setSignupRequested(true);

      if (data.session) {
        toast.success("Solicitação enviada. Seu acesso está aguardando aprovação.");
      } else {
        toast.success("Cadastro recebido com sucesso.");
      }
    } catch (error) {
      toast.error(signupErrorMessage(error));
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

  if (signupRequested && !user) {
    return (
      <AuthShell>
        <Card className="border-border/60 shadow-xl">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <CheckCircle2 className="size-7" />
            </div>

            <CardTitle className="text-2xl">Solicitação recebida</CardTitle>

            <CardDescription className="mx-auto max-w-sm leading-6">
              Seu cadastro foi enviado. Caso a confirmação de e-mail esteja habilitada, confirme seu
              endereço antes de entrar.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-3">
            <div className="rounded-xl border bg-muted/40 p-4 text-sm leading-6 text-muted-foreground">
              Depois da confirmação e da aprovação por um administrador, utilize o mesmo e-mail e
              senha para acessar a Área de Membros.
            </div>

            <Button asChild className="w-full">
              <Link to="/auth">
                Ir para o login
                <ArrowRight className="ml-2 size-4" />
              </Link>
            </Button>

            <Button asChild variant="ghost" className="w-full">
              <Link to="/">Voltar ao início</Link>
            </Button>
          </CardContent>
        </Card>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <div className="mb-7">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          <UserPlus className="size-3.5 text-primary" />
          Novo cadastro
        </div>

        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Solicitar acesso</h1>

        <p className="mt-3 text-base leading-7 text-muted-foreground">
          Crie sua conta. Após o envio, seu cadastro será analisado antes da liberação das
          informações internas.
        </p>
      </div>

      <Card className="border-border/60 shadow-xl shadow-slate-950/5">
        <CardContent className="p-6 sm:p-7">
          <form className="space-y-5" onSubmit={(event) => void handleSignUp(event)}>
            <AuthField
              id="displayName"
              label="Nome completo"
              value={displayName}
              onChange={setDisplayName}
              autoComplete="name"
              placeholder="Seu nome completo"
              disabled={busy}
              autoFocus
            />

            <AuthField
              id="email"
              label="E-mail"
              value={email}
              onChange={setEmail}
              type="email"
              autoComplete="email"
              placeholder="seuemail@exemplo.com"
              disabled={busy}
            />

            <AuthField
              id="password"
              label="Senha"
              value={password}
              onChange={setPassword}
              type="password"
              autoComplete="new-password"
              placeholder="Mínimo de 8 caracteres"
              disabled={busy}
            />

            <AuthField
              id="confirmPassword"
              label="Confirmar senha"
              value={confirmPassword}
              onChange={setConfirmPassword}
              type="password"
              autoComplete="new-password"
              placeholder="Digite a senha novamente"
              disabled={busy}
            />

            <div className="flex gap-3 rounded-2xl border border-primary/15 bg-primary/5 p-4">
              <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" />

              <p className="text-sm leading-6 text-muted-foreground">
                O cadastro não libera acesso automaticamente. Um administrador precisa aprovar sua
                solicitação antes que os dados das células sejam disponibilizados.
              </p>
            </div>

            <Button type="submit" disabled={busy} className="h-11 w-full" size="lg">
              <UserPlus className="mr-2 size-4" />
              {busy ? "Enviando…" : "Enviar solicitação"}
            </Button>
          </form>

          <div className="mt-6 border-t pt-5 text-center">
            <p className="text-sm text-muted-foreground">Já possui cadastro?</p>

            <Button asChild variant="link" className="mt-1">
              <Link to="/auth">
                Entrar na Área de Membros
                <ArrowRight className="ml-1 size-4" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </AuthShell>
  );
}
