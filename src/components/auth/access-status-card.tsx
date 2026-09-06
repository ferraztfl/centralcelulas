import { Link } from "@tanstack/react-router";
import { Clock3, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function AccessStatusCard({
  rejected,
  onSignOut,
}: {
  rejected: boolean;
  onSignOut: () => Promise<void>;
}) {
  return (
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
          <div className="rounded-xl border bg-muted/40 p-4 text-sm leading-6 text-muted-foreground">
            Você não precisa criar outra conta. Depois da aprovação, entre normalmente usando o
            mesmo e-mail e senha.
          </div>
        )}

        <Button type="button" variant="outline" className="w-full" onClick={() => void onSignOut()}>
          Sair desta conta
        </Button>

        <Button asChild variant="ghost" className="w-full">
          <Link to="/">Voltar ao início</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
