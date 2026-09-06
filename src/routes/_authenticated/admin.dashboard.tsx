import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import {
  Activity,
  CirclePlus,
  FileUp,
  LayoutDashboard,
  MapPinned,
  Network,
  Radio,
  Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { NetworkBadge } from "@/components/NetworkBadge";
import { DashboardMap } from "@/components/admin/DashboardMap";

export const Route = createFileRoute("/_authenticated/admin/dashboard")({
  head: () => ({
    meta: [{ title: "Dashboard • Central de Células" }],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-cells"],
    queryFn: async () => {
      const [cells, networks] = await Promise.all([
        supabase.from("cells").select(`
          id,
          name,
          network_id,
          gender,
          address,
          neighborhood,
          latitude,
          longitude,
          leader_name,
          leader_whatsapp,
          leader2_name,
          leader2_whatsapp,
          meeting_weekday,
          meeting_time,
          is_active
        `),
        supabase.from("networks").select("*").order("sort_order"),
      ]);

      if (cells.error) throw cells.error;
      if (networks.error) throw networks.error;

      return {
        cells: cells.data ?? [],
        networks: networks.data ?? [],
      };
    },
  });

  const active = data?.cells.filter((cell) => cell.is_active) ?? [];
  const inactive = data?.cells.filter((cell) => !cell.is_active) ?? [];

  const activeWithCoordinates = active.filter(
    (cell) => cell.latitude != null && cell.longitude != null,
  );

  const activeWithoutCoordinates = active.filter(
    (cell) => cell.latitude == null || cell.longitude == null,
  );

  const countByNetwork = data
    ? data.networks.map((network) => ({
        ...network,
        total: data.cells.filter((cell) => cell.network_id === network.id).length,
        activeCount: data.cells.filter((cell) => cell.network_id === network.id && cell.is_active)
          .length,
      }))
    : [];

  const networksWithCells = countByNetwork.filter((network) => network.total > 0).length;

  const networkNameById = new Map(
    (data?.networks ?? []).map((network) => [network.id, network.name]),
  );

  const mapCells = activeWithCoordinates.map((cell) => ({
    id: cell.id,
    lat: cell.latitude!,
    lng: cell.longitude!,
    name: cell.name,
    network_id: cell.network_id,
    network_name: networkNameById.get(cell.network_id) ?? cell.network_id,
    gender: cell.gender,
    address: cell.address,
    neighborhood: cell.neighborhood,
    leader_name: cell.leader_name,
    leader_whatsapp: cell.leader_whatsapp,
    leader2_name: cell.leader2_name,
    leader2_whatsapp: cell.leader2_whatsapp,
    meeting_weekday: cell.meeting_weekday,
    meeting_time: cell.meeting_time,
  }));

  return (
    <div className="mx-auto max-w-7xl space-y-7 p-5 md:p-8 lg:p-10">
      <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 text-white shadow-xl">
        <div className="grid gap-8 px-6 py-7 md:px-8 lg:grid-cols-[1fr_auto] lg:items-center lg:px-10 lg:py-9">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-blue-100">
              <LayoutDashboard className="size-3.5" />
              Gestão de células
            </div>

            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Dashboard</h1>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 md:text-base">
              Visão operacional da Central de Células do Campus Zona Norte. Acompanhe o cadastro,
              distribuição das redes e cobertura geográfica das células ativas.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              asChild
              variant="secondary"
              className="bg-white text-slate-950 hover:bg-slate-100"
            >
              <Link to="/admin/cells/new">
                <CirclePlus className="mr-2 size-4" />
                Nova célula
              </Link>
            </Button>

            <Button
              asChild
              variant="outline"
              className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white"
            >
              <Link to="/admin/import">
                <FileUp className="mr-2 size-4" />
                Importar CSV
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {isLoading && (
        <Card className="border-border/60">
          <CardContent className="p-8 text-center text-muted-foreground">
            Carregando indicadores…
          </CardContent>
        </Card>
      )}

      {data && (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              icon={<Radio className="size-5" />}
              label="Total de células"
              value={data.cells.length}
              description={`${inactive.length} inativa${inactive.length === 1 ? "" : "s"}`}
            />

            <MetricCard
              icon={<Activity className="size-5" />}
              label="Células ativas"
              value={active.length}
              description={`${
                data.cells.length > 0 ? Math.round((active.length / data.cells.length) * 100) : 0
              }% do cadastro`}
              accent
            />

            <MetricCard
              icon={<Network className="size-5" />}
              label="Redes com células"
              value={networksWithCells}
              description={`${data.networks.length} redes cadastradas`}
            />

            <MetricCard
              icon={<MapPinned className="size-5" />}
              label="Geolocalizadas"
              value={activeWithCoordinates.length}
              description={`${activeWithoutCoordinates.length} ativa${
                activeWithoutCoordinates.length === 1 ? "" : "s"
              } sem coordenadas`}
              warning={activeWithoutCoordinates.length > 0}
            />
          </section>

          <section className="grid gap-6 xl:grid-cols-[1fr_0.72fr]">
            <Card className="overflow-hidden border-border/60 shadow-sm">
              <div className="border-b px-6 py-5">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Network className="size-5" />
                  </div>

                  <div>
                    <h2 className="font-semibold">Distribuição por rede</h2>

                    <p className="mt-0.5 text-sm text-muted-foreground">
                      Quantidade de células cadastradas e ativas.
                    </p>
                  </div>
                </div>
              </div>

              <CardContent className="space-y-5 p-6">
                {countByNetwork.map((network) => {
                  const percentage =
                    data.cells.length > 0
                      ? Math.round((network.total / data.cells.length) * 100)
                      : 0;

                  return (
                    <div key={network.id}>
                      <div className="mb-2 flex items-center justify-between gap-4">
                        <NetworkBadge networkId={network.id} name={network.name} />

                        <div className="text-right">
                          <p className="text-sm font-semibold">{network.activeCount} ativas</p>

                          <p className="text-xs text-muted-foreground">{network.total} total</p>
                        </div>
                      </div>

                      <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${percentage}%`,
                            backgroundColor: network.color,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <Card className="overflow-hidden border-border/60 shadow-sm">
              <div className="border-b px-6 py-5">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Users className="size-5" />
                  </div>

                  <div>
                    <h2 className="font-semibold">Situação do cadastro</h2>

                    <p className="mt-0.5 text-sm text-muted-foreground">
                      Pontos que merecem atenção administrativa.
                    </p>
                  </div>
                </div>
              </div>

              <CardContent className="space-y-4 p-6">
                <StatusRow
                  label="Ativas"
                  value={active.length}
                  description="Disponíveis para recomendação"
                />

                <StatusRow
                  label="Inativas"
                  value={inactive.length}
                  description="Fora das buscas de membros"
                />

                <StatusRow
                  label="Com coordenadas"
                  value={activeWithCoordinates.length}
                  description="Aparecem corretamente no mapa"
                />

                <StatusRow
                  label="Sem coordenadas"
                  value={activeWithoutCoordinates.length}
                  description={
                    activeWithoutCoordinates.length > 0
                      ? "Precisam de revisão no cadastro"
                      : "Nenhuma pendência"
                  }
                  warning={activeWithoutCoordinates.length > 0}
                />

                <Button asChild variant="outline" className="mt-2 w-full">
                  <Link to="/admin">Gerenciar células</Link>
                </Button>
              </CardContent>
            </Card>
          </section>

          <Card className="overflow-hidden border-border/60 shadow-sm">
            <div className="flex flex-col gap-3 border-b px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <MapPinned className="size-5" />
                </div>

                <div>
                  <h2 className="font-semibold">Mapa das células ativas</h2>

                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {activeWithCoordinates.length} célula
                    {activeWithCoordinates.length === 1 ? "" : "s"} com localização disponível.
                  </p>
                </div>
              </div>

              {activeWithoutCoordinates.length > 0 && (
                <div className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800">
                  {activeWithoutCoordinates.length} sem localização
                </div>
              )}
            </div>

            <div className="overflow-hidden">
              <DashboardMap cells={mapCells} className="h-[560px] w-full" />
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  description,
  accent = false,
  warning = false,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  description: string;
  accent?: boolean;
  warning?: boolean;
}) {
  return (
    <Card className="border-border/60 shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div
            className={`flex size-10 items-center justify-center rounded-xl ${
              accent
                ? "bg-emerald-50 text-emerald-600"
                : warning
                  ? "bg-amber-50 text-amber-600"
                  : "bg-primary/10 text-primary"
            }`}
          >
            {icon}
          </div>

          <p
            className={`text-3xl font-bold tracking-tight ${
              accent ? "text-emerald-600" : warning ? "text-amber-700" : ""
            }`}
          >
            {value}
          </p>
        </div>

        <p className="mt-4 text-sm font-semibold">{label}</p>

        <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

function StatusRow({
  label,
  value,
  description,
  warning = false,
}: {
  label: string;
  value: number;
  description: string;
  warning?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border bg-muted/20 p-4">
      <div>
        <p className="text-sm font-semibold">{label}</p>

        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>

      <div className={`text-2xl font-bold ${warning ? "text-amber-700" : ""}`}>{value}</div>
    </div>
  );
}
