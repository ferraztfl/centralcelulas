import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link2, MapPinned, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/neighborhoods")({
  head: () => ({
    meta: [
      {
        title: "Bairros vizinhos • Central de Células",
      },
    ],
  }),
  component: NeighborhoodsPage,
});

function normalizeNeighborhood(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function NeighborhoodsPage() {
  const qc = useQueryClient();

  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["adjacencies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("neighborhood_adjacencies")
        .select("*")
        .order("neighborhood_a", {
          ascending: true,
        });

      if (error) throw error;

      return data;
    },
  });

  const add = async () => {
    const neighborhoodA = normalizeNeighborhood(a);

    const neighborhoodB = normalizeNeighborhood(b);

    if (!neighborhoodA || !neighborhoodB) {
      toast.error("Informe os dois bairros.");
      return;
    }

    if (neighborhoodA.toLowerCase() === neighborhoodB.toLowerCase()) {
      toast.error("Os bairros precisam ser diferentes.");
      return;
    }

    const alreadyExists =
      data?.some((item) => {
        const itemA = item.neighborhood_a.trim().toLowerCase();

        const itemB = item.neighborhood_b.trim().toLowerCase();

        const newA = neighborhoodA.toLowerCase();

        const newB = neighborhoodB.toLowerCase();

        return (itemA === newA && itemB === newB) || (itemA === newB && itemB === newA);
      }) ?? false;

    if (alreadyExists) {
      toast.error("Essa relação de vizinhança já está cadastrada.");
      return;
    }

    setSaving(true);

    const { error } = await supabase.from("neighborhood_adjacencies").insert({
      neighborhood_a: neighborhoodA,
      neighborhood_b: neighborhoodB,
    });

    setSaving(false);

    if (error) {
      if (error.code === "23505") {
        toast.error("Essa relação de vizinhança já existe.");
      } else {
        toast.error(error.message);
      }

      return;
    }

    toast.success("Vizinhança adicionada.");

    setA("");
    setB("");

    void qc.invalidateQueries({
      queryKey: ["adjacencies"],
    });
  };

  const remove = async (id: string) => {
    if (!window.confirm("Remover esta relação de vizinhança?")) {
      return;
    }

    const { error } = await supabase.from("neighborhood_adjacencies").delete().eq("id", id);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Vizinhança removida.");

    void qc.invalidateQueries({
      queryKey: ["adjacencies"],
    });
  };

  return (
    <div className="mx-auto max-w-6xl space-y-7 p-5 md:p-8 lg:p-10">
      <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 px-6 py-7 text-white shadow-xl md:px-8 lg:px-10 lg:py-9">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-blue-100">
          <MapPinned className="size-3.5" />
          Inteligência geográfica
        </div>

        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Bairros vizinhos</h1>

        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 md:text-base">
          Cadastre relações entre bairros próximos para melhorar a relevância das recomendações
          feitas durante o atendimento de membros.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <Card className="border-border/60 shadow-sm">
          <CardContent className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Relações cadastradas
            </p>

            <p className="mt-2 text-3xl font-bold tracking-tight">{data?.length ?? 0}</p>

            <p className="mt-1 text-xs text-muted-foreground">Pares de bairros relacionados</p>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm">
          <CardContent className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Funcionamento
            </p>

            <p className="mt-2 text-lg font-bold">Relação bidirecional</p>

            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Cadastre cada par apenas uma vez. Bairro A ↔ Bairro B funciona nos dois sentidos.
            </p>
          </CardContent>
        </Card>
      </section>

      <div className="grid gap-6 lg:grid-cols-[0.78fr_1.22fr]">
        <Card className="border-border/60 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="size-5 text-primary" />
              Nova vizinhança
            </CardTitle>

            <CardDescription>Relacione dois bairros geograficamente próximos.</CardDescription>
          </CardHeader>

          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="neighborhood-a">Bairro</Label>

              <Input
                id="neighborhood-a"
                value={a}
                onChange={(event) => setA(event.target.value)}
                placeholder="Ex.: Casa Amarela"
              />
            </div>

            <div className="flex items-center justify-center">
              <div className="flex size-10 items-center justify-center rounded-full border bg-muted/30 text-muted-foreground">
                <Link2 className="size-4" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="neighborhood-b">Bairro vizinho</Label>

              <Input
                id="neighborhood-b"
                value={b}
                onChange={(event) => setB(event.target.value)}
                placeholder="Ex.: Tamarineira"
              />
            </div>

            <Button type="button" className="w-full" onClick={add} disabled={saving}>
              <Plus className="mr-2 size-4" />

              {saving ? "Salvando..." : "Adicionar vizinhança"}
            </Button>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-border/60 shadow-sm">
          <CardHeader className="border-b">
            <CardTitle>Vizinhanças cadastradas</CardTitle>

            <CardDescription>
              Relações utilizadas como apoio na classificação das melhores células.
            </CardDescription>
          </CardHeader>

          <CardContent className="p-0">
            {isLoading && (
              <div className="p-8 text-center text-sm text-muted-foreground">
                Carregando relações...
              </div>
            )}

            {data && data.length === 0 && (
              <div className="p-10 text-center">
                <MapPinned className="mx-auto mb-3 size-10 text-muted-foreground" />

                <p className="font-medium">Nenhuma vizinhança cadastrada</p>

                <p className="mt-1 text-sm text-muted-foreground">
                  Utilize o formulário ao lado para criar a primeira relação.
                </p>
              </div>
            )}

            <div className="divide-y">
              {data?.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-muted/20 md:px-6"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Link2 className="size-4" />
                    </div>

                    <div className="min-w-0 text-sm">
                      <span className="font-semibold capitalize">{item.neighborhood_a}</span>

                      <span className="mx-2 text-muted-foreground">↔</span>

                      <span className="font-semibold capitalize">{item.neighborhood_b}</span>
                    </div>
                  </div>

                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    title="Remover relação"
                    onClick={() => void remove(item.id)}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
