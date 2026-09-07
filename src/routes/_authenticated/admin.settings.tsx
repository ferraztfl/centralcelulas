import { createFileRoute } from "@tanstack/react-router";
import { Database, KeyRound, LockKeyhole, MapPinned, Settings2, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  head: () => ({
    meta: [
      {
        title: "Configurações • Central de Células",
      },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-7 p-5 md:p-8 lg:p-10">
      <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 px-6 py-7 text-white shadow-xl md:px-8 lg:px-10 lg:py-9">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-blue-100">
          <Settings2 className="size-3.5" />
          Administração do sistema
        </div>

        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Configurações</h1>

        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 md:text-base">
          Visão técnica dos serviços, segurança e infraestrutura utilizados pela Central de Células.
        </p>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <InfoCard
          icon={<MapPinned className="size-5" />}
          title="Mapas e geolocalização"
          description="Localização das células e cálculo de proximidade."
        >
          <p>
            Os mapas utilizam <strong>Leaflet + OpenStreetMap</strong>. A busca de endereços e
            coordenadas é realizada pelo servidor através do Geoapify.
          </p>

          <p>
            Endereços novos são armazenados de forma estruturada com rua, número, bairro, cidade, UF
            e CEP.
          </p>
        </InfoCard>

        <InfoCard
          icon={<KeyRound className="size-5" />}
          title="Credenciais do servidor"
          description="Segredos utilizados pelos serviços externos."
        >
          <p>
            A credencial de geocodificação utiliza a variável{" "}
            <code className="rounded bg-muted px-1.5 py-0.5">GEOAPIFY_API_KEY</code>.
          </p>

          <p>
            Segredos devem permanecer somente no ambiente do servidor e nunca ser incorporados ao
            código do navegador.
          </p>
        </InfoCard>

        <InfoCard
          icon={<LockKeyhole className="size-5" />}
          title="Controle de acesso"
          description="Proteção dos dados de células e liderança."
        >
          <p>A busca de células é restrita a usuários autenticados e com acesso aprovado.</p>

          <p>
            Operações administrativas exigem perfil de administrador e também são protegidas no
            servidor e pelas políticas do banco.
          </p>
        </InfoCard>

        <InfoCard
          icon={<Database className="size-5" />}
          title="Dados"
          description="Estrutura operacional utilizada pelo sistema."
        >
          <p>Células, redes, usuários e relações de bairros são armazenados no Supabase.</p>

          <p>
            Células antigas mantêm compatibilidade com o endereço legado enquanto os registros novos
            utilizam o modelo estruturado.
          </p>
        </InfoCard>
      </section>

      <Card className="overflow-hidden border-emerald-200 bg-emerald-50/60 shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
              <ShieldCheck className="size-5" />
            </div>

            <div>
              <h2 className="font-bold text-emerald-950">Proteção administrativa</h2>

              <p className="mt-1 max-w-3xl text-sm leading-6 text-emerald-800">
                Esta área exibe informações operacionais, mas não mostra valores de chaves privadas,
                tokens ou credenciais sensíveis.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function InfoCard({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="border-border/60 shadow-sm">
      <CardHeader>
        <div className="mb-2 flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          {icon}
        </div>

        <CardTitle>{title}</CardTitle>

        <CardDescription>{description}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
        {children}
      </CardContent>
    </Card>
  );
}
