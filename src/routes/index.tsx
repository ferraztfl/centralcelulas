import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { searchCells } from "@/lib/search.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { NetworkBadge } from "@/components/NetworkBadge";
import { CellMap } from "@/components/CellMap";
import { Instagram, MessageCircle, Search, Sparkles, MapPin, Calendar, Clock } from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { WEEKDAYS, weekdayLabel, formatMeetingTime } from "@/lib/weekdays";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Central de Células - Igreja do Amor" },
      { name: "description", content: "Encontre a célula ideal pertinho de você na Igreja do Amor." },
    ],
  }),
  component: PublicSearch,
});

type Form = {
  address: string; neighborhood: string; age: string;
  gender: "masculino" | "feminino" | ""; marital: "solteiro" | "casado" | "outro" | "";
  spouseConverted: "sim" | "nao" | "";
  weekday: string;
};

function PublicSearch() {
  const searchFn = useServerFn(searchCells);
  const [form, setForm] = useState<Form>({
    address: "", neighborhood: "", age: "", gender: "", marital: "", spouseConverted: "", weekday: "",
  });
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Awaited<ReturnType<typeof searchFn>> | null>(null);

  const { data: networks } = useQuery({
    queryKey: ["networks"],
    queryFn: async () => {
      const { data } = await supabase.from("networks").select("*").order("sort_order");
      return data ?? [];
    },
  });
  const netMap = Object.fromEntries((networks ?? []).map(n => [n.id, n]));

  const update = (p: Partial<Form>) => setForm(f => ({ ...f, ...p }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.address || !form.neighborhood || !form.age || !form.gender || !form.marital) {
      toast.error("Preencha todos os campos"); return;
    }
    if (form.marital === "casado" && !form.spouseConverted) {
      toast.error("Indique se o cônjuge é convertido"); return;
    }
    setBusy(true);
    try {
      const r = await searchFn({
        data: {
          address: form.address, neighborhood: form.neighborhood,
          age: Number(form.age), gender: form.gender as any, marital: form.marital as any,
          spouseConverted: form.spouseConverted === "sim",
          weekday: form.weekday === "" ? null : Number(form.weekday),
        },
      });
      setResult(r);
      if (r.ok && r.results.length === 0) toast.info("Nenhuma célula encontrada com esses critérios.");
    } catch (e: any) { toast.error(e?.message ?? "Erro"); }
    finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/30">
      <header className="border-b bg-background/70 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="size-9 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-primary-foreground">
              <MapPin className="size-5" />
            </div>
            <div>
              <h1 className="font-bold leading-tight">Central de Células - Igreja do Amor</h1>
              <p className="text-xs text-muted-foreground">Encontre uma célula perto de você</p>
            </div>
          </div>
          <Link to="/auth" className="text-sm text-muted-foreground hover:text-foreground">Admin →</Link>
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-4 pt-12 pb-8 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-accent text-accent-foreground px-3 py-1 text-xs font-medium">
          <Sparkles className="size-3" /> Algoritmo inteligente de sugestão
        </span>
        <h2 className="mt-4 text-4xl md:text-5xl font-bold tracking-tight">
          Vamos encontrar sua <span className="bg-gradient-to-r from-primary to-net-impulse bg-clip-text text-transparent">célula ideal</span>
        </h2>
        <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
          Responda algumas perguntas e mostraremos as 3 melhores opções perto de você.
        </p>
      </section>

      <section className="max-w-3xl mx-auto px-4 pb-12">
        <Card className="p-6 md:p-8 shadow-xl border-border/60">
          <form onSubmit={submit} className="space-y-5">
            <div className="grid md:grid-cols-2 gap-4">
              <Field label="Endereço: Rua, número e cidade">
                <Input value={form.address} onChange={e => update({ address: e.target.value })} placeholder="Rua, número, cidade" />
              </Field>
              <Field label="Bairro">
                <Input value={form.neighborhood} onChange={e => update({ neighborhood: e.target.value })} />
              </Field>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <Field label="Idade">
                <Input type="number" min={0} max={120} value={form.age} onChange={e => update({ age: e.target.value })} />
              </Field>
              <Field label="Gênero">
                <Select value={form.gender} onValueChange={v => update({ gender: v as any })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="masculino">Masculino</SelectItem>
                    <SelectItem value="feminino">Feminino</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Field label="Estado civil">
              <Select value={form.marital} onValueChange={v => update({ marital: v as any, spouseConverted: "" })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="solteiro">Solteiro(a)</SelectItem>
                  <SelectItem value="casado">Casado(a)</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            {form.marital === "casado" && (
              <Field label="Seu cônjuge é cristão convertido?">
                <RadioGroup value={form.spouseConverted} onValueChange={v => update({ spouseConverted: v as any })} className="flex gap-6">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <RadioGroupItem value="sim" /> Sim
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <RadioGroupItem value="nao" /> Não
                  </label>
                </RadioGroup>
              </Field>
            )}

            <Field label="Dia da semana preferido (opcional)">
              <Select value={form.weekday || "any"} onValueChange={v => update({ weekday: v === "any" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Qualquer dia" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Qualquer dia</SelectItem>
                  {WEEKDAYS.map(d => <SelectItem key={d.value} value={String(d.value)}>{d.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>

            <Button type="submit" disabled={busy} className="w-full" size="lg">
              <Search className="size-4 mr-2" />{busy ? "Buscando…" : "Buscar células"}
            </Button>
          </form>
        </Card>
      </section>

      {result && result.ok && result.results.length > 0 && (
        <section className="max-w-6xl mx-auto px-4 pb-16">
          <div className="mb-6">
            <h3 className="text-2xl font-bold">Top {result.results.length} para você</h3>
            <p className="text-sm text-muted-foreground">Ordenado por proximidade e afinidade.</p>
          </div>
          <div className="grid lg:grid-cols-[1fr_1fr] gap-6">
            <div className="space-y-4">
              {result.results.map((c, i) => {
                const net = netMap[c.network_id];
                const wa = c.leader_whatsapp.replace(/\D/g, "");
                const wa2 = c.leader2_whatsapp?.replace(/\D/g, "");
                const ig = c.leader_instagram?.replace(/^@/, "");
                return (
                  <Card key={c.id} className="p-5 hover:shadow-md transition-shadow">
                    <div className="flex items-start gap-3">
                      <div className="size-10 shrink-0 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">{i + 1}</div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          {net && <NetworkBadge networkId={c.network_id} name={net.name} />}
                          <span className="text-xs text-muted-foreground">{c.distanceKm != null ? `${c.distanceKm.toFixed(1)} km` : ""}</span>
                        </div>
                        <h4 className="font-semibold text-lg">{c.name}</h4>
                        <p className="text-sm text-muted-foreground">{c.address} — {c.neighborhood}</p>
                        {(c.meeting_weekday != null || c.meeting_time) && (
                          <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
                            {c.meeting_weekday != null && (
                              <span className="inline-flex items-center gap-1"><Calendar className="size-3" />{weekdayLabel(c.meeting_weekday)}</span>
                            )}
                            {c.meeting_time && (
                              <span className="inline-flex items-center gap-1"><Clock className="size-3" />{formatMeetingTime(c.meeting_time)}</span>
                            )}
                          </div>
                        )}
                        <div className="mt-2 space-y-1">
                          <p className="text-sm">Líder: <strong>{c.leader_name}</strong></p>
                          {c.leader2_name && (
                            <p className="text-sm">Líder 2: <strong>{c.leader2_name}</strong></p>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2 mt-3">
                          <Button asChild size="sm">
                            <a href={`https://wa.me/${wa}?text=${encodeURIComponent(`Olá ${c.leader_name}, vim pelo Localizador de Células!`)}`} target="_blank" rel="noreferrer">
                              <MessageCircle className="size-4 mr-1" /> WhatsApp
                            </a>
                          </Button>
                          {wa2 && c.leader2_name && (
                            <Button asChild size="sm" variant="outline">
                              <a href={`https://wa.me/${wa2}?text=${encodeURIComponent(`Olá ${c.leader2_name}, vim pelo Localizador de Células!`)}`} target="_blank" rel="noreferrer">
                                <MessageCircle className="size-4 mr-1" /> WA {c.leader2_name.split(" ")[0]}
                              </a>
                            </Button>
                          )}
                          {ig && (
                            <Button asChild size="sm" variant="outline">
                              <a href={`https://instagram.com/${ig}`} target="_blank" rel="noreferrer">
                                <Instagram className="size-4 mr-1" /> @{ig}
                              </a>
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
            <div className="lg:sticky lg:top-24 self-start">
              <CellMap
                visitor={{ lat: result.visitor.lat, lng: result.visitor.lng }}
                cells={result.results
                  .filter(c => c.latitude != null && c.longitude != null)
                  .map(c => ({ id: c.id, lat: c.latitude!, lng: c.longitude!, name: c.name, network_id: c.network_id }))}
                className="h-[500px] w-full"
              />
            </div>
          </div>
        </section>
      )}

      {result && !result.ok && (
        <section className="max-w-3xl mx-auto px-4 pb-12">
          <Card className="p-6 border-destructive/40 bg-destructive/5">
            <p className="text-destructive font-medium">{result.error}</p>
          </Card>
        </section>
      )}

      {result && result.ok && result.results.length === 0 && (
        <section className="max-w-3xl mx-auto px-4 pb-12">
          <Card className="p-6 text-center">
            <p className="text-muted-foreground">Nenhuma célula compatível foi encontrada. Tente novamente em breve!</p>
          </Card>
        </section>
      )}

      <footer className="border-t mt-10">
        <div className="max-w-6xl mx-auto px-4 py-6 text-center text-xs text-muted-foreground space-y-1">
          <p>Central de Células - Igreja do Amor © {new Date().getFullYear()}</p>
          <p>Desenvolvido por Thiago Ferraz de Lima - (81) 99745-1960</p>
        </div>
      </footer>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}
