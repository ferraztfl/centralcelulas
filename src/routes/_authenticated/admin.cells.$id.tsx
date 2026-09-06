import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CellForm } from "@/components/admin/CellForm";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/admin/cells/$id")({
  head: () => ({
    meta: [
      {
        title: "Editar célula • Central de Células",
      },
    ],
  }),
  component: EditCell,
});

function EditCell() {
  const { id } = Route.useParams();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ["cell", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("cells").select("*").eq("id", id).maybeSingle();

      if (error) throw error;

      return data;
    },
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  return (
    <div className="mx-auto max-w-5xl space-y-7 p-5 md:p-8 lg:p-10">
      <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 px-6 py-7 text-white shadow-xl md:px-8 lg:px-10 lg:py-9">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-blue-100">
          <Pencil className="size-3.5" />
          Gestão de células
        </div>

        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Editar célula</h1>

        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 md:text-base">
          {data?.name
            ? `Atualizando o cadastro da célula ${data.name}.`
            : "Atualize as informações operacionais da célula."}
        </p>
      </section>

      {isLoading && (
        <Card className="p-8 text-center text-muted-foreground">Carregando cadastro…</Card>
      )}

      {data && <CellForm initial={data} onDone={() => navigate({ to: "/admin" })} />}
    </div>
  );
}
