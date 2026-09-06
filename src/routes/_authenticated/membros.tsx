import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { searchCells } from "@/lib/search.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { NetworkBadge } from "@/components/NetworkBadge";
import { CellMap } from "@/components/CellMap";
import { Instagram, MessageCircle, Search, Sparkles, MapPin, Calendar, Clock } from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { WEEKDAYS, weekdayLabel, formatMeetingTime } from "@/lib/weekdays";

export const Route = createFileRoute("/_authenticated/membros")({
  head: () => ({
    meta: [
      { title: "Buscar Células | Área de Membros" },
      {
        name: "description",
        content: "Encontre a célula ideal pertinho de você na Igreja do Amor.",
      },
    ],
  }),
  component: MemberSearch,
});

type Form = {
  street: string;
  number: string;
  neighborhood: string;
  city: string;
  state: string;
  postalCode: string;
  age: string;
  gender: "masculino" | "feminino" | "";
  participation: "individual" | "casal" | "";
  bothConverted: "sim" | "nao" | "";
  weekday: string;
};

const BRAZIL_STATES = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
] as const;

function MemberSearch() {
  const searchFn = useServerFn(searchCells);
  const [form, setForm] = useState<Form>({
    street: "",
    number: "",
    neighborhood: "",
    city: "Recife",
    state: "PE",
    postalCode: "",
    age: "",
    gender: "",
    participation: "",
    bothConverted: "",
    weekday: "",
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
  const netMap = Object.fromEntries((networks ?? []).map((n) => [n.id, n]));

  const update = (p: Partial<Form>) => setForm((f) => ({ ...f, ...p }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !form.street.trim() ||
      !form.number.trim() ||
      !form.neighborhood.trim() ||
      !form.city.trim() ||
      !form.state ||
      !form.age ||
      !form.gender ||
      !form.participation
    ) {
      toast.error("Preencha os campos obrigatórios.");
      return;
    }

    if (form.participation === "casal" && !form.bothConverted) {
      toast.error("Indique se ambos são cristãos convertidos.");
      return;
    }
    setBusy(true);
    try {
      const r = await searchFn({
        data: {
          street: form.street.trim(),
          number: form.number.trim(),
          neighborhood: form.neighborhood.trim(),
          city: form.city.trim(),
          state: form.state,
          postalCode: form.postalCode.trim() || null,
          age: Number(form.age),
          gender: form.gender as "masculino" | "feminino",
          participation: form.participation as "individual" | "casal",
          bothConverted: form.participation === "casal" && form.bothConverted === "sim",
          weekday: form.weekday === "" ? null : Number(form.weekday),
        },
      });
      setResult(r);
      if (r.ok && r.results.length === 0)
        toast.info("Nenhuma célula encontrada com esses critérios.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/30">
      <section className="mx-auto max-w-6xl px-5 pb-8 pt-10 text-center md:px-8 md:pt-14">
        <span className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-primary">
          <Sparkles className="size-3.5" />
          Localizador inteligente
        </span>

        <h2 className="mx-auto mt-5 max-w-3xl text-4xl font-bold tracking-tight md:text-5xl">
          Encontre a célula mais adequada
          <span className="text-primary"> para você</span>
        </h2>

        <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
          Informe sua localização e seu perfil. Cruzaremos proximidade, rede e disponibilidade para
          sugerir as melhores opções.
        </p>
      </section>

      <section className="mx-auto max-w-4xl px-5 pb-14 md:px-8">
        <Card className="overflow-hidden border-border/60 shadow-xl shadow-slate-950/5">
          <div className="border-b bg-gradient-to-r from-slate-950 to-blue-950 px-6 py-5 text-white md:px-8">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-white/10">
                <Search className="size-5" />
              </div>

              <div>
                <h3 className="font-semibold">Busca personalizada</h3>
                <p className="mt-0.5 text-sm text-white/65">
                  Campos separados aumentam a precisão da localização.
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={submit} className="space-y-8 p-6 md:p-8">
            <div className="space-y-4">
              <div>
                <h3 className="flex items-center gap-2 text-base font-semibold">
                  <MapPin className="size-4 text-primary" />
                  Sua localização
                </h3>

                <p className="mt-1 text-sm text-muted-foreground">
                  Informe o endereço onde você mora ou a região de onde pretende sair para a célula.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-12">
                <div className="md:col-span-9">
                  <Field label="Rua / Avenida *">
                    <Input
                      className="h-11"
                      value={form.street}
                      onChange={(event) => update({ street: event.target.value })}
                      placeholder="Ex.: Rua da Harmonia"
                      autoComplete="address-line1"
                    />
                  </Field>
                </div>

                <div className="md:col-span-3">
                  <Field label="Número *">
                    <Input
                      className="h-11"
                      value={form.number}
                      onChange={(event) => update({ number: event.target.value })}
                      placeholder="Ex.: 120"
                    />
                  </Field>
                </div>

                <div className="md:col-span-6">
                  <Field label="Bairro *">
                    <Input
                      className="h-11"
                      value={form.neighborhood}
                      onChange={(event) => update({ neighborhood: event.target.value })}
                      placeholder="Ex.: Casa Forte"
                      autoComplete="address-level3"
                    />
                  </Field>
                </div>

                <div className="md:col-span-6">
                  <Field label="Cidade *">
                    <Input
                      className="h-11"
                      value={form.city}
                      onChange={(event) => update({ city: event.target.value })}
                      placeholder="Ex.: Recife"
                      autoComplete="address-level2"
                    />
                  </Field>
                </div>

                <div className="md:col-span-4">
                  <Field label="UF *">
                    <Select value={form.state} onValueChange={(value) => update({ state: value })}>
                      <SelectTrigger className="h-11">
                        <SelectValue />
                      </SelectTrigger>

                      <SelectContent>
                        {BRAZIL_STATES.map((state) => (
                          <SelectItem key={state} value={state}>
                            {state}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>

                <div className="md:col-span-8">
                  <Field label="CEP (opcional)">
                    <Input
                      className="h-11"
                      value={form.postalCode}
                      onChange={(event) => update({ postalCode: event.target.value })}
                      placeholder="Ex.: 52060-000"
                      inputMode="numeric"
                      autoComplete="postal-code"
                    />
                  </Field>

                  <p className="mt-1.5 text-xs text-muted-foreground">
                    Se souber o CEP, informe-o para aumentar ainda mais a precisão.
                  </p>
                </div>
              </div>
            </div>

            <div className="border-t pt-7">
              <div>
                <h3 className="text-base font-semibold">Seu perfil</h3>

                <p className="mt-1 text-sm text-muted-foreground">
                  Usamos essas informações apenas para indicar a rede mais adequada.
                </p>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <Field label="Idade *">
                  <Input
                    className="h-11"
                    type="number"
                    min={1}
                    max={120}
                    value={form.age}
                    onChange={(event) => update({ age: event.target.value })}
                    placeholder="Sua idade"
                  />
                </Field>

                <Field label="Gênero *">
                  <Select
                    value={form.gender}
                    onValueChange={(value) => update({ gender: value as Form["gender"] })}
                  >
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>

                    <SelectContent>
                      <SelectItem value="masculino">Masculino</SelectItem>
                      <SelectItem value="feminino">Feminino</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              <div className="mt-5">
                <Field label="Para quem é esta busca? *">
                  <RadioGroup
                    value={form.participation}
                    onValueChange={(value) =>
                      update({
                        participation: value as Form["participation"],
                        bothConverted: "",
                      })
                    }
                    className="grid gap-3 sm:grid-cols-2"
                  >
                    <label
                      className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition ${
                        form.participation === "individual"
                          ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                          : "hover:bg-muted/40"
                      }`}
                    >
                      <RadioGroupItem value="individual" className="mt-1" />

                      <div>
                        <p className="font-medium">Busca individual</p>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          Estou procurando uma célula para mim.
                        </p>
                      </div>
                    </label>

                    <label
                      className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition ${
                        form.participation === "casal"
                          ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                          : "hover:bg-muted/40"
                      }`}
                    >
                      <RadioGroupItem value="casal" className="mt-1" />

                      <div>
                        <p className="font-medium">Busca para casal</p>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          Estamos procurando uma célula para participarmos juntos.
                        </p>
                      </div>
                    </label>
                  </RadioGroup>
                </Field>
              </div>

              {form.participation === "casal" && (
                <div className="mt-5 rounded-2xl border border-primary/15 bg-primary/5 p-5">
                  <Field label="Vocês dois são cristãos convertidos? *">
                    <RadioGroup
                      value={form.bothConverted}
                      onValueChange={(value) =>
                        update({ bothConverted: value as Form["bothConverted"] })
                      }
                      className="flex flex-wrap gap-6"
                    >
                      <label className="flex cursor-pointer items-center gap-2 text-sm">
                        <RadioGroupItem value="sim" />
                        Sim
                      </label>

                      <label className="flex cursor-pointer items-center gap-2 text-sm">
                        <RadioGroupItem value="nao" />
                        Não
                      </label>
                    </RadioGroup>
                  </Field>

                  <p className="mt-3 text-xs leading-5 text-muted-foreground">
                    Quando ambos são convertidos, a Rede Amor A2 recebe prioridade na recomendação.
                  </p>
                </div>
              )}
            </div>

            <div className="border-t pt-7">
              <Field label="Dia da semana preferido (opcional)">
                <Select
                  value={form.weekday || "any"}
                  onValueChange={(value) => update({ weekday: value === "any" ? "" : value })}
                >
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Qualquer dia" />
                  </SelectTrigger>

                  <SelectContent>
                    <SelectItem value="any">Qualquer dia</SelectItem>

                    {WEEKDAYS.map((day) => (
                      <SelectItem key={day.value} value={String(day.value)}>
                        {day.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <Button type="submit" disabled={busy} className="h-12 w-full" size="lg">
              <Search className="mr-2 size-4" />
              {busy ? "Analisando opções…" : "Encontrar minhas melhores opções"}
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
                      <div className="size-10 shrink-0 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                        {i + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          {net && <NetworkBadge networkId={c.network_id} name={net.name} />}
                          <span className="text-xs text-muted-foreground">
                            {c.distanceKm != null ? `${c.distanceKm.toFixed(1)} km` : ""}
                          </span>
                        </div>
                        <h4 className="font-semibold text-lg">{c.name}</h4>
                        <p className="text-sm text-muted-foreground">
                          {c.address} — {c.neighborhood}
                        </p>
                        {(c.meeting_weekday != null || c.meeting_time) && (
                          <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
                            {c.meeting_weekday != null && (
                              <span className="inline-flex items-center gap-1">
                                <Calendar className="size-3" />
                                {weekdayLabel(c.meeting_weekday)}
                              </span>
                            )}
                            {c.meeting_time && (
                              <span className="inline-flex items-center gap-1">
                                <Clock className="size-3" />
                                {formatMeetingTime(c.meeting_time)}
                              </span>
                            )}
                          </div>
                        )}
                        <div className="mt-2 space-y-1">
                          <p className="text-sm">
                            Líder: <strong>{c.leader_name}</strong>
                          </p>
                          {c.leader2_name && (
                            <p className="text-sm">
                              Líder 2: <strong>{c.leader2_name}</strong>
                            </p>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2 mt-3">
                          <Button asChild size="sm">
                            <a
                              href={`https://wa.me/${wa}?text=${encodeURIComponent(`Olá ${c.leader_name}, vim pelo Localizador de Células!`)}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <MessageCircle className="size-4 mr-1" /> WhatsApp
                            </a>
                          </Button>
                          {wa2 && c.leader2_name && (
                            <Button asChild size="sm" variant="outline">
                              <a
                                href={`https://wa.me/${wa2}?text=${encodeURIComponent(`Olá ${c.leader2_name}, vim pelo Localizador de Células!`)}`}
                                target="_blank"
                                rel="noreferrer"
                              >
                                <MessageCircle className="size-4 mr-1" /> WA{" "}
                                {c.leader2_name.split(" ")[0]}
                              </a>
                            </Button>
                          )}
                          {ig && (
                            <Button asChild size="sm" variant="outline">
                              <a
                                href={`https://instagram.com/${ig}`}
                                target="_blank"
                                rel="noreferrer"
                              >
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
                  .filter((c) => c.latitude != null && c.longitude != null)
                  .map((c) => ({
                    id: c.id,
                    lat: c.latitude!,
                    lng: c.longitude!,
                    name: c.name,
                    network_id: c.network_id,
                  }))}
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
            <p className="text-muted-foreground">
              Nenhuma célula compatível foi encontrada. Tente novamente em breve!
            </p>
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
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
