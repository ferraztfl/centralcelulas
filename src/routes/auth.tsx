import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Acesso administrativo • Localizador de Células" }] }),
  component: AuthPage,
});

const schema = z.object({
  email: z.string().trim().email("E-mail inválido").max(255),
  password: z.string().min(6, "Mínimo de 6 caracteres").max(72),
});

function AuthPage() {
  const navigate = useNavigate();
  const { user, isAdmin, accessStatus, loading, signOut } = useAuth();
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (!loading && user && isAdmin) navigate({ to: "/admin" });
  }, [user, isAdmin, loading, navigate]);

  const submit = async (mode: "signin" | "signup") => {
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }

    setBusy(true);

    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          options: { emailRedirectTo: window.location.origin + "/auth" },
        });

        if (error) throw error;

        toast.success("Conta criada. Aguarde a aprovação de um administrador.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: parsed.data.email,
          password: parsed.data.password,
        });

        if (error) throw error;

        toast.success("Login realizado. Verificando permissão de acesso…");
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Erro");
    } finally {
      setBusy(false);
    }
  };

  const hasBlockedLoggedUser = user && !isAdmin && !loading;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-accent/30 px-4 py-12">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-6 block text-sm text-muted-foreground hover:text-foreground">← Voltar ao site público</Link>

        {hasBlockedLoggedUser && (
          <Card className="border-border/60 shadow-xl mb-4">
            <CardHeader>
              <CardTitle>
                {accessStatus === "pending" ? "Conta aguardando aprovação" : accessStatus === "rejected" ? "Acesso negado" : "Acesso restrito"}
              </CardTitle>
              <CardDescription>
                {accessStatus === "pending"
                  ? "Seu cadastro foi recebido. Um administrador precisa aprovar seu acesso ao painel."
                  : accessStatus === "rejected"
                    ? "Sua solicitação de acesso ao painel administrativo foi negada."
                    : "Sua conta não tem permissão de administrador."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full" onClick={async () => { await signOut(); }}>
                Sair desta conta
              </Button>
            </CardContent>
          </Card>
        )}

        <Card className="border-border/60 shadow-xl">
          <CardHeader>
            <CardTitle className="text-2xl">Painel administrativo</CardTitle>
            <CardDescription>
              O primeiro cadastro vira administrador. Os próximos cadastros precisam de aprovação.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="signin">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Entrar</TabsTrigger>
                <TabsTrigger value="signup">Criar conta</TabsTrigger>
              </TabsList>
              <TabsContent value="signin" className="space-y-3 pt-4">
                <Field label="E-mail" value={email} onChange={setEmail} type="email" />
                <Field label="Senha" value={password} onChange={setPassword} type="password" />
                <Button disabled={busy} className="w-full" onClick={() => submit("signin")}>{busy ? "Entrando…" : "Entrar"}</Button>
              </TabsContent>
              <TabsContent value="signup" className="space-y-3 pt-4">
                <Field label="E-mail" value={email} onChange={setEmail} type="email" />
                <Field label="Senha" value={password} onChange={setPassword} type="password" />
                <Button disabled={busy} className="w-full" onClick={() => submit("signup")}>{busy ? "Criando…" : "Criar conta"}</Button>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input type={type} value={value} onChange={e => onChange(e.target.value)} />
    </div>
  );
}
