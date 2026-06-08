import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NetworkBadge } from "@/components/NetworkBadge";
import { DashboardMap } from "@/components/admin/DashboardMap";
import { LayoutDashboard, Radio, Users, ToggleLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard • Admin" }] }),
  component: DashboardPage,
});

function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-cells"],
    queryFn: async () => {
      const [cells, nets] = await Promise.all([
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
      if (nets.error) throw nets.error;
      return { cells: cells.data ?? [], networks: nets.data ?? [] };
    },
  });

  const active = data?.cells.filter(c => c.is_active) ?? [];
  const inactive = data?.cells.filter(c => !c.is_active) ?? [];

  const countByNetwork = data
    ? data.networks.map(n => ({
        ...n,
        total: data.cells.filter(c => c.network_id === n.id).length,
        activeCount: data.cells.filter(c => c.network_id === n.id && c.is_active).length,
      }))
    : [];

  const networkNameById = new Map((data?.networks ?? []).map((network) => [network.id, network.name]));

  const mapCells = active
    .filter(c => c.latitude != null && c.longitude != null)
    .map(c => ({
      id: c.id,
      lat: c.latitude!,
      lng: c.longitude!,
      name: c.name,
      network_id: c.network_id,
      network_name: networkNameById.get(c.network_id) ?? c.network_id,
      gender: c.gender,
      address: c.address,
      neighborhood: c.neighborhood,
      leader_name: c.leader_name,
      leader_whatsapp: c.leader_whatsapp,
      leader2_name: c.leader2_name,
      leader2_whatsapp: c.leader2_whatsapp,
      meeting_weekday: c.meeting_weekday,
      meeting_time: c.meeting_time,
    }));

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <LayoutDashboard className="size-7" /> Dashboard
        </h1>
        <p className="text-muted-foreground mt-1">Visão geral das células cadastradas.</p>
      </div>

      {isLoading && <p className="text-muted-foreground">Carregando…</p>}

      {data && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard icon={<Radio className="size-5" />} label="Total de células" value={data.cells.length} />
            <KpiCard icon={<ToggleLeft className="size-5 text-green-600" />} label="Células ativas" value={active.length} color="text-green-600" />
            <KpiCard icon={<ToggleLeft className="size-5 text-muted-foreground" />} label="Inativas" value={inactive.length} />
            <KpiCard icon={<Users className="size-5" />} label="Redes com células" value={countByNetwork.filter(n => n.total > 0).length} />
          </div>

          {/* Por rede */}
          <Card>
            <CardHeader>
              <CardTitle>Células por rede</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {countByNetwork.map(n => {
                  const pct = data.cells.length > 0 ? Math.round((n.total / data.cells.length) * 100) : 0;
                  return (
                    <div key={n.id} className="flex items-center gap-3">
                      <div className="w-36 shrink-0">
                        <NetworkBadge networkId={n.id} name={n.name} />
                      </div>
                      <div className="flex-1 h-3 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${pct}%`, backgroundColor: n.color }}
                        />
                      </div>
                      <div className="text-sm text-muted-foreground w-28 shrink-0 text-right">
                        {n.activeCount} ativas / {n.total} total
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Mapa geral */}
          <Card>
            <CardHeader>
              <CardTitle>Mapa geral das células ativas</CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-hidden rounded-b-lg">
              <DashboardMap cells={mapCells} className="h-[520px] w-full" />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function KpiCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color?: string }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-center gap-2 text-muted-foreground mb-1">
          {icon}
          <span className="text-xs">{label}</span>
        </div>
        <p className={`text-3xl font-bold ${color ?? ""}`}>{value}</p>
      </CardContent>
    </Card>
  );
}
