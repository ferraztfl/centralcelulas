import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { ArrowLeft, CheckCircle2, Clock3, LockKeyhole, ShieldCheck, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      {
        title: "Área de Membros | Central de Células - Igreja do Amor",
      },
      {
        name: "description",
        content: "Acesso à Central de Células da Igreja do Amor - Campus Zona Norte.",
      },
    ],
  }),
  component: AuthPage,
});

const signInSchema = z.object({
  email: z.string().trim().email("Informe um e-mail válido.").max(255),
  password: z.string().min(1, "Informe sua senha.").max(72),
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

function errorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Não foi possível concluir a operação.";
}

function AuthPage() {
  const navigate = useNavigate();

  const { user, role, isApprovedMember, isAdmin, accessStatus, loading, signOut } = useAuth();

  const [busy, setBusy] = useState(false);
  const [signupRequested, setSignupRequested] = useState(false);

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const [displayName, setDisplayName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
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

  const handleSignIn = async () => {
    const parsed = signInSchema.safeParse({
      email: loginEmail,
      password: loginPassword,
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
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const handleSignUp = async () => {
    const parsed = signUpSchema.safeParse({
      displayName,
      email: signupEmail,
      password: signupPassword,
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
        toast.success("Cadastro recebido. Verifique também seu e-mail, se solicitado.");
      }
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    setSignupRequested(false);
  };

  const loggedButNotApproved = !loading && user && !isApprovedMember;

  if (loggedButNotApproved) {
    const rejected = accessStatus === "rejected";

    return (
      <AuthShell>
        <Card className="border-border/60 shadow-xl">
          <CardHeader className="text-center">
            <div
              className={
                rejected
                  ? "mx-auto mb-2 flex size-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive"
                  : "mx-auto mb-2 flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"
              }
            >
              {rejected ? <LockKeyhole className="size-6" /> : <Clock3 className="size-6" />}
            </div>

            <CardTitle className="text-2xl">
              {rejected ? "Acesso não autorizado" : "Aguardando aprovação"}
            </CardTitle>

            <CardDescription className="mx-auto max-w-sm leading-6">
              {rejected
                ? "Sua solicitação de acesso não está autorizada neste momento."
                : "Seu cadastro foi recebido. Um administrador precisa aprovar seu acesso antes que você possa consultar as células."}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-3">
            {!rejected && (
              <div className="rounded-xl border bg-muted/40 p-4 text-sm text-muted-foreground">
                Você não precisa criar outra conta. Assim que seu cadastro for aprovado, poderá
                entrar com o mesmo e-mail e senha.
              </div>
            )}

            <Button variant="outline" className="w-full" onClick={handleSignOut}>
              Sair desta conta
            </Button>

            <Button asChild variant="ghost" className="w-full">
              <Link to="/">Voltar ao início</Link>
            </Button>
          </CardContent>
        </Card>
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
              endereço de e-mail antes de entrar.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-3">
            <Button className="w-full" onClick={() => setSignupRequested(false)}>
              Ir para o login
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
      <div className="mb-6 text-center">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border bg-background/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          <ShieldCheck className="size-3.5 text-primary" />
          Acesso protegido
        </div>

        <h1 className="text-3xl font-bold tracking-tight">Área de Membros</h1>

        <p className="mt-2 text-sm text-muted-foreground">Igreja do Amor · Campus Zona Norte</p>
      </div>

      <Card className="border-border/60 shadow-xl">
        <CardContent className="pt-6">
          <Tabs defaultValue="signin">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Entrar</TabsTrigger>

              <TabsTrigger value="signup">Solicitar acesso</TabsTrigger>
            </TabsList>

            <TabsContent value="signin" className="space-y-4 pt-5">
              <div>
                <h2 className="text-lg font-semibold">Bem-vindo de volta</h2>

                <p className="mt-1 text-sm text-muted-foreground">Entre com sua conta aprovada.</p>
              </div>

              <Field
                label="E-mail"
                value={loginEmail}
                onChange={setLoginEmail}
                type="email"
                autoComplete="email"
                placeholder="seuemail@exemplo.com"
              />

              <Field
                label="Senha"
                value={loginPassword}
                onChange={setLoginPassword}
                type="password"
                autoComplete="current-password"
                placeholder="Sua senha"
              />

              <Button disabled={busy} className="w-full" size="lg" onClick={handleSignIn}>
                <LockKeyhole className="mr-2 size-4" />
                {busy ? "Entrando…" : "Entrar"}
              </Button>
            </TabsContent>

            <TabsContent value="signup" className="space-y-4 pt-5">
              <div>
                <h2 className="text-lg font-semibold">Solicitar acesso</h2>

                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Novos cadastros precisam ser aprovados por um administrador.
                </p>
              </div>

              <Field
                label="Nome completo"
                value={displayName}
                onChange={setDisplayName}
                autoComplete="name"
                placeholder="Seu nome completo"
              />

              <Field
                label="E-mail"
                value={signupEmail}
                onChange={setSignupEmail}
                type="email"
                autoComplete="email"
                placeholder="seuemail@exemplo.com"
              />

              <Field
                label="Senha"
                value={signupPassword}
                onChange={setSignupPassword}
                type="password"
                autoComplete="new-password"
                placeholder="Mínimo de 8 caracteres"
              />

              <Field
                label="Confirmar senha"
                value={confirmPassword}
                onChange={setConfirmPassword}
                type="password"
                autoComplete="new-password"
                placeholder="Digite a senha novamente"
              />

              <div className="rounded-xl border bg-muted/40 p-4 text-xs leading-5 text-muted-foreground">
                Após o cadastro, seu acesso ficará pendente até a aprovação de um administrador.
              </div>

              <Button disabled={busy} className="w-full" size="lg" onClick={handleSignUp}>
                <UserPlus className="mr-2 size-4" />
                {busy ? "Enviando…" : "Enviar solicitação"}
              </Button>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </AuthShell>
  );
}

function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/10 via-background to-accent/40" />

      <div className="mx-auto flex min-h-screen max-w-7xl items-center px-4 py-10 md:px-8">
        <div className="grid w-full items-center gap-12 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="mx-auto hidden max-w-lg lg:block">
            <img
              src="/central-logo.png"
              alt="Central de Células"
              className="h-24 w-auto object-contain"
            />

            <h2 className="mt-8 text-4xl font-bold tracking-tight">
              Encontre conexão.
              <br />
              Viva comunhão.
            </h2>

            <p className="mt-5 max-w-md text-lg leading-8 text-muted-foreground">
              A Central de Células facilita o encontro entre pessoas e células da Igreja do Amor,
              preservando a privacidade das informações internas.
            </p>

            <div className="mt-8 flex items-center gap-3 rounded-2xl border bg-background/70 p-4">
              <ShieldCheck className="size-6 shrink-0 text-primary" />

              <p className="text-sm leading-6 text-muted-foreground">
                Endereços e contatos ficam disponíveis somente para usuários autenticados e
                aprovados.
              </p>
            </div>
          </div>

          <div className="mx-auto w-full max-w-md">
            <Link
              to="/"
              className="mb-5 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="size-4" />
              Voltar ao início
            </Link>

            <div className="mb-6 flex justify-center lg:hidden">
              <img
                src="/central-logo.png"
                alt="Central de Células"
                className="h-16 w-auto object-contain"
              />
            </div>

            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  autoComplete,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  autoComplete?: string;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>

      <Input
        type={type}
        value={value}
        autoComplete={autoComplete}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
