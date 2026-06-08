import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Plus, Trash2, Link2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/neighborhoods")({
  head: () => ({ meta: [{ title: "Bairros vizinhos • Admin" }] }),
  component: NeighborhoodsPage,
});

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
        .order("neighborhood_a", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const add = async () => {
    if (!a.trim() || !b.trim()) { toast.error("Informe ambos os bairros"); return; }
    if (a.trim().toLowerCase() === b.trim().toLowerCase()) { toast.error("Os bairros devem ser diferentes"); return; }
    setSaving(true);
    const { error } = await supabase.from("neighborhood_adjacencies").insert({
      neighborhood_a: a, neighborhood_b: b,
    });
    setSaving(false);
    if (error) {
      if (error.code === "23505") toast.error("Essa relação de vizinhança já existe");
      else toast.error(error.message);
      return;
    }
    toast.success("Vizinhança adicionada");
    setA(""); setB("");
    qc.invalidateQueries({ queryKey: ["adjacencies"] });
  };

  const remove = async (id: string) => {
    if (!confirm("Remover esta vizinhança?")) return;
    const { error } = await supabase.from("neighborhood_adjacencies").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Removida");
    qc.invalidateQueries({ queryKey: ["adjacencies"] });
  };

  return (
    <div className="p-6 md:p-10 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Bairros vizinhos</h1>
        <p className="text-muted-foreground mt-1">
          Cadastre pares de bairros próximos. Visitantes desses bairros recebem pontuação extra para células do bairro vizinho.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Plus className="size-5" /> Nova vizinhança</CardTitle>
          <CardDescription>A relação é bidirecional — registre apenas uma vez por par.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Bairro</Label>
              <Input value={a} onChange={e => setA(e.target.value)} placeholder="Ex: Moema" />
            </div>
            <div className="space-y-1.5">
              <Label>Bairro vizinho</Label>
              <Input value={b} onChange={e => setB(e.target.value)} placeholder="Ex: Vila Mariana" />
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={add} disabled={saving}>{saving ? "Salvando…" : "Adicionar"}</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Vizinhanças cadastradas</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && <p className="text-muted-foreground text-sm">Carregando…</p>}
          {data && data.length === 0 && (
            <p className="text-muted-foreground text-sm">Nenhuma vizinhança cadastrada ainda.</p>
          )}
          <ul className="divide-y">
            {data?.map(item => (
              <li key={item.id} className="flex items-center justify-between py-2.5">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium capitalize">{item.neighborhood_a}</span>
                  <Link2 className="size-4 text-muted-foreground" />
                  <span className="font-medium capitalize">{item.neighborhood_b}</span>
                </div>
                <Button size="icon" variant="ghost" onClick={() => remove(item.id)}>
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
