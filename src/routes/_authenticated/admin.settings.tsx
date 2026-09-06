import { createFileRoute } from "@tanstack/react-router";
import { KeyRound, Map, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  head: () => ({
    meta: [
      {
        title: "Configurações | Central de Células",
      },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-5 md:p-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Configurações</h1>

        <p className="mt-2 text-sm text-muted-foreground">
          Informações técnicas e serviços utilizados pela Central de Células.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Map className="size-5 text-primary" />
            Mapas e geocodificação
          </CardTitle>

          <CardDescription>
            Serviços utilizados para localização e cálculo de proximidade das células.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <div className="flex gap-3">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" />

            <p className="leading-6">
              Os mapas usam Leaflet e OpenStreetMap. A geocodificação é realizada pelo servidor.
            </p>
          </div>

          <div className="flex gap-3">
            <KeyRound className="mt-0.5 size-5 shrink-0 text-primary" />

            <p className="leading-6">
              A chave do Geoapify permanece em
              <code className="mx-1 rounded bg-muted px-1.5 py-0.5">GEOAPIFY_API_KEY</code>
              no ambiente do servidor e não deve ser enviada ao navegador.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
