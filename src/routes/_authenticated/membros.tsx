import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
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
import {
  Calendar,
  Clock,
  Copy,
  Instagram,
  MessageCircle,
  MapPin,
  Phone,
  RotateCcw,
  Search,
  Sparkles,
  Star,
} from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { WEEKDAYS, weekdayLabel, formatMeetingTime } from "@/lib/weekdays";
import { useAuth } from "@/hooks/use-auth";

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

const MEMBER_SEARCH_STORAGE_VERSION = 1;
const MEMBER_SEARCH_MAX_AGE_MS = 2 * 60 * 60 * 1000;

function memberSearchStorageKey(userId: string) {
  return `centralcelulas:member-search:v${MEMBER_SEARCH_STORAGE_VERSION}:${userId}`;
}

function readStoredSearch<T>(userId: string) {
  if (typeof window === "undefined") return null;

  try {
    const key = memberSearchStorageKey(userId);
    const raw = window.sessionStorage.getItem(key);

    if (!raw) return null;

    const parsed = JSON.parse(raw) as {
      savedAt?: number;
      form?: Form;
      result?: T | null;
    };

    if (
      typeof parsed.savedAt !== "number" ||
      Date.now() - parsed.savedAt > MEMBER_SEARCH_MAX_AGE_MS ||
      !parsed.form
    ) {
      window.sessionStorage.removeItem(key);
      return null;
    }

    return {
      form: parsed.form,
      result: parsed.result ?? null,
    };
  } catch {
    return null;
  }
}

type SearchResultCell = {
  id: string;
  name: string;
  network_id: string;
  address: string;
  neighborhood: string;
  distanceKm?: number | null;
  meeting_weekday?: number | null;
  meeting_time?: string | null;
  leader_name: string;
  leader_whatsapp: string;
  leader2_name?: string | null;
  leader2_whatsapp?: string | null;
  leader_instagram?: string | null;
};

function normalizeBrazilianWhatsapp(value?: string | null) {
  if (!value) return "";

  const digits = value.replace(/\D/g, "");

  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    return digits;
  }

  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }

  return digits;
}

function formatBrazilianPhone(value?: string | null) {
  if (!value) return "Não informado";

  let digits = value.replace(/\D/g, "");

  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    digits = digits.slice(2);
  }

  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }

  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }

  return value;
}

async function copyToClipboard(text: string, successMessage: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();

      const copied = document.execCommand("copy");
      textarea.remove();

      if (!copied) {
        throw new Error("Falha ao copiar.");
      }
    }

    toast.success(successMessage);
  } catch {
    toast.error("Não foi possível copiar para a área de transferência.");
  }
}

function buildCellClipboardText(
  cell: SearchResultCell,
  networkName: string | undefined,
  position: number,
) {
  const meeting = [
    cell.meeting_weekday != null ? weekdayLabel(cell.meeting_weekday) : null,
    cell.meeting_time ? formatMeetingTime(cell.meeting_time) : null,
  ]
    .filter(Boolean)
    .join(" às ");

  const lines = [
    `${position}ª opção — ${cell.name}`,
    networkName ? `Rede: ${networkName}` : null,
    cell.distanceKm != null ? `Distância aproximada: ${cell.distanceKm.toFixed(1)} km` : null,
    meeting ? `Reunião: ${meeting}` : null,
    `Endereço: ${cell.address} — ${cell.neighborhood}`,
    `Líder: ${cell.leader_name}`,
    `Contato: ${formatBrazilianPhone(cell.leader_whatsapp)}`,
  ];

  if (cell.leader2_name) {
    lines.push(`Segundo líder: ${cell.leader2_name}`);
  }

  if (cell.leader2_whatsapp) {
    lines.push(`Contato: ${formatBrazilianPhone(cell.leader2_whatsapp)}`);
  }

  if (cell.leader_instagram) {
    const instagram = cell.leader_instagram.replace(/^@/, "");
    lines.push(`Instagram: @${instagram}`);
  }

  return lines.filter(Boolean).join("\n");
}

function MemberSearch() {
  const searchFn = useServerFn(searchCells);
  const { user } = useAuth();

  type SearchResult = Awaited<ReturnType<typeof searchFn>>;

  const defaultForm: Form = {
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
  };

  const [restoredSearch] = useState(() =>
    user?.id ? readStoredSearch<SearchResult>(user.id) : null,
  );

  const [form, setForm] = useState<Form>(restoredSearch?.form ?? defaultForm);

  const [busy, setBusy] = useState(false);

  const [result, setResult] = useState<SearchResult | null>(restoredSearch?.result ?? null);

  const resultAnchorRef = useRef<HTMLDivElement>(null);
  const searchFormRef = useRef<HTMLElement>(null);

  const { data: networks } = useQuery({
    queryKey: ["networks"],
    queryFn: async () => {
      const { data } = await supabase.from("networks").select("*").order("sort_order");
      return data ?? [];
    },
  });
  const netMap = Object.fromEntries((networks ?? []).map((n) => [n.id, n]));

  const update = (p: Partial<Form>) => setForm((f) => ({ ...f, ...p }));

  const startNewService = () => {
    const confirmed = window.confirm(
      "Iniciar um novo atendimento? Os dados e resultados da busca atual serão limpos.",
    );

    if (!confirmed) return;

    if (user?.id) {
      try {
        window.sessionStorage.removeItem(memberSearchStorageKey(user.id));
      } catch {
        // A limpeza visual continua mesmo se o storage estiver indisponível.
      }
    }

    setForm({
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

    setResult(null);
    setBusy(false);

    window.requestAnimationFrame(() => {
      searchFormRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });

    toast.success("Novo atendimento iniciado.");
  };

  useEffect(() => {
    if (!user?.id || typeof window === "undefined") return;

    try {
      window.sessionStorage.setItem(
        memberSearchStorageKey(user.id),
        JSON.stringify({
          savedAt: Date.now(),
          form,
          result,
        }),
      );
    } catch {
      // Falhas de storage não devem impedir a busca.
    }
  }, [user?.id, form, result]);

  useEffect(() => {
    if (!result) return;

    const frame = window.requestAnimationFrame(() => {
      resultAnchorRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [result]);

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

      <section ref={searchFormRef} className="mx-auto max-w-4xl scroll-mt-24 px-5 pb-14 md:px-8">
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

      <div ref={resultAnchorRef} className="scroll-mt-24" aria-hidden="true" />

      {result && result.ok && result.results.length > 0 && (
        <section className="mx-auto max-w-6xl px-5 pb-16 md:px-8">
          <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-primary">
                <Sparkles className="size-3.5" />
                Atendimento de células
              </div>

              <h3 className="text-2xl font-bold tracking-tight md:text-3xl">
                Melhores opções encontradas
              </h3>

              <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                Selecionamos as células mais compatíveis com a localização, perfil e disponibilidade
                informados.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" className="shrink-0" onClick={startNewService}>
                <RotateCcw className="mr-2 size-4" />
                Novo atendimento
              </Button>

              <Button
                type="button"
                variant="outline"
                className="shrink-0"
                onClick={() => {
                  const summary = result.results
                    .map((cell, index) =>
                      buildCellClipboardText(cell, netMap[cell.network_id]?.name, index + 1),
                    )
                    .join("\n\n------------------------------\n\n");

                  void copyToClipboard(summary, "Resumo das opções copiado.");
                }}
              >
                <Copy className="mr-2 size-4" />
                Copiar resumo das opções
              </Button>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(380px,0.95fr)]">
            <div className="space-y-4">
              {result.results.map((c, i) => {
                const net = netMap[c.network_id];

                const whatsapp = normalizeBrazilianWhatsapp(c.leader_whatsapp);

                const whatsapp2 = normalizeBrazilianWhatsapp(c.leader2_whatsapp);

                const instagram = c.leader_instagram?.replace(/^@/, "");

                const recommendationLabel = i === 0 ? "Mais indicada" : `${i + 1}ª opção`;

                const summary = buildCellClipboardText(c, net?.name, i + 1);

                return (
                  <Card
                    key={c.id}
                    className={`overflow-hidden transition-shadow hover:shadow-md ${
                      i === 0 ? "border-primary/30 shadow-md shadow-primary/5" : ""
                    }`}
                  >
                    <div
                      className={`border-b px-5 py-3 ${i === 0 ? "bg-primary/5" : "bg-muted/25"}`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <div
                            className={`flex size-9 items-center justify-center rounded-full font-bold ${
                              i === 0
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted text-foreground"
                            }`}
                          >
                            {i + 1}
                          </div>

                          {i === 0 && (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground">
                              <Star className="size-3 fill-current" />
                              Mais indicada
                            </span>
                          )}

                          {i > 0 && (
                            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              {recommendationLabel}
                            </span>
                          )}
                        </div>

                        {c.distanceKm != null && (
                          <span className="rounded-full border bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground">
                            {c.distanceKm.toFixed(1)} km
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="p-5">
                      <div className="flex flex-wrap items-center gap-2">
                        {net && <NetworkBadge networkId={c.network_id} name={net.name} />}
                      </div>

                      <h4 className="mt-3 text-xl font-bold tracking-tight">{c.name}</h4>

                      <div className="mt-3 flex items-start gap-2 text-sm leading-6 text-muted-foreground">
                        <MapPin className="mt-1 size-4 shrink-0 text-primary" />

                        <span>
                          {c.address}
                          <br />
                          <span className="text-xs">{c.neighborhood}</span>
                        </span>
                      </div>

                      {(c.meeting_weekday != null || c.meeting_time) && (
                        <div className="mt-4 flex flex-wrap gap-2">
                          {c.meeting_weekday != null && (
                            <span className="inline-flex items-center gap-1.5 rounded-lg border bg-background px-2.5 py-1.5 text-xs font-medium">
                              <Calendar className="size-3.5 text-primary" />
                              {weekdayLabel(c.meeting_weekday)}
                            </span>
                          )}

                          {c.meeting_time && (
                            <span className="inline-flex items-center gap-1.5 rounded-lg border bg-background px-2.5 py-1.5 text-xs font-medium">
                              <Clock className="size-3.5 text-primary" />
                              {formatMeetingTime(c.meeting_time)}
                            </span>
                          )}
                        </div>
                      )}

                      <div className="mt-5 rounded-2xl border bg-muted/25 p-4">
                        <div className="mb-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                            Contatos da liderança
                          </p>
                        </div>

                        <div className="space-y-4">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="text-sm font-semibold">{c.leader_name}</p>

                              <p className="mt-1 flex items-center gap-1.5 text-base font-bold tracking-tight">
                                <Phone className="size-4 text-primary" />
                                {formatBrazilianPhone(c.leader_whatsapp)}
                              </p>
                            </div>

                            <div className="flex flex-wrap gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  void copyToClipboard(
                                    formatBrazilianPhone(c.leader_whatsapp),
                                    "Contato do líder copiado.",
                                  )
                                }
                              >
                                <Copy className="mr-1.5 size-3.5" />
                                Copiar
                              </Button>

                              {whatsapp && (
                                <Button asChild size="sm" variant="outline">
                                  <a
                                    href={`https://wa.me/${whatsapp}?text=${encodeURIComponent(
                                      `Olá ${c.leader_name}, estou entrando em contato através da Central de Células da Igreja do Amor - Campus Zona Norte.`,
                                    )}`}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    <MessageCircle className="mr-1.5 size-3.5" />
                                    WhatsApp
                                  </a>
                                </Button>
                              )}
                            </div>
                          </div>

                          {c.leader2_name && (
                            <div className="border-t pt-4">
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                  <p className="text-sm font-semibold">{c.leader2_name}</p>

                                  {c.leader2_whatsapp && (
                                    <p className="mt-1 flex items-center gap-1.5 text-base font-bold tracking-tight">
                                      <Phone className="size-4 text-primary" />
                                      {formatBrazilianPhone(c.leader2_whatsapp)}
                                    </p>
                                  )}
                                </div>

                                {c.leader2_whatsapp && (
                                  <div className="flex flex-wrap gap-2">
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      onClick={() =>
                                        void copyToClipboard(
                                          formatBrazilianPhone(c.leader2_whatsapp),
                                          "Contato do segundo líder copiado.",
                                        )
                                      }
                                    >
                                      <Copy className="mr-1.5 size-3.5" />
                                      Copiar
                                    </Button>

                                    {whatsapp2 && (
                                      <Button asChild size="sm" variant="outline">
                                        <a
                                          href={`https://wa.me/${whatsapp2}?text=${encodeURIComponent(
                                            `Olá ${c.leader2_name}, estou entrando em contato através da Central de Células da Igreja do Amor - Campus Zona Norte.`,
                                          )}`}
                                          target="_blank"
                                          rel="noreferrer"
                                        >
                                          <MessageCircle className="mr-1.5 size-3.5" />
                                          WhatsApp
                                        </a>
                                      </Button>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => void copyToClipboard(summary, "Dados da célula copiados.")}
                        >
                          <Copy className="mr-1.5 size-4" />
                          Copiar dados da célula
                        </Button>

                        {instagram && (
                          <Button asChild size="sm" variant="ghost">
                            <a
                              href={`https://instagram.com/${instagram}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <Instagram className="mr-1.5 size-4" />@{instagram}
                            </a>
                          </Button>
                        )}
                      </div>

                      <p className="mt-4 text-xs leading-5 text-muted-foreground">
                        Recomendação baseada em rede, proximidade e disponibilidade informadas na
                        busca.
                      </p>
                    </div>
                  </Card>
                );
              })}
            </div>

            <div className="self-start lg:sticky lg:top-24">
              <div className="overflow-hidden rounded-2xl border bg-background shadow-sm">
                <div className="border-b px-4 py-3">
                  <p className="text-sm font-semibold">Localização das opções</p>

                  <p className="mt-0.5 text-xs text-muted-foreground">
                    O ponto escuro representa o endereço informado no atendimento.
                  </p>
                </div>

                <CellMap
                  visitor={{
                    lat: result.visitor.lat,
                    lng: result.visitor.lng,
                  }}
                  cells={result.results
                    .filter((c) => c.latitude != null && c.longitude != null)
                    .map((c) => ({
                      id: c.id,
                      lat: c.latitude!,
                      lng: c.longitude!,
                      name: c.name,
                      network_id: c.network_id,
                    }))}
                  className="h-[520px] w-full"
                />
              </div>
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
