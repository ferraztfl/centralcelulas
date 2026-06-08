import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CellForm } from "@/components/admin/CellForm";

export const Route = createFileRoute("/_authenticated/admin/cells/$id")({
  head: () => ({ meta: [{ title: "Editar célula • Admin" }] }),
  component: EditCell,
});

function EditCell() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ["cell", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cells")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  return (
    <div className="p-6 md:p-10 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold tracking-tight mb-6">Editar célula</h1>
      {isLoading && <p className="text-muted-foreground">Carregando…</p>}
      {data && <CellForm initial={data} onDone={() => navigate({ to: "/admin" })} />}
    </div>
  );
}
