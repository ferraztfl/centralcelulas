import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { NetworkBadge } from "@/components/NetworkBadge";
import { Switch } from "@/components/ui/switch";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Download,
  FilterX,
  MapPin,
  Pencil,
  Phone,
  PlusCircle,
  Search,
  Trash2,
  UsersRound,
} from "lucide-react";
import { toast } from "sonner";
import { useState, useMemo } from "react";
import { WEEKDAYS } from "@/lib/weekdays";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({ meta: [{ title: "Células • Admin" }] }),
  component: AdminCells,
});

const PAGE_SIZE = 20;

const GENDER_LABELS: Record<string, string> = {
  masculina: "Masculina",
  feminina: "Feminina",
  mista: "Mista",
};

function formatWeekday(day?: number | null) {
  if (day === null || day === undefined) return "-";
  return WEEKDAYS.find((d) => d.value === day)?.label ?? "-";
}

function formatTime(time?: string | null) {
  if (!time) return "-";
  return String(time).slice(0, 5);
}

function formatPhone(phone?: string | null) {
  if (!phone) return "-";

  const clean = phone.replace(/\D/g, "");

  if (clean.length === 13 && clean.startsWith("55")) {
    return `+${clean.slice(0, 2)} (${clean.slice(2, 4)}) ${clean.slice(4, 9)}-${clean.slice(9)}`;
  }

  if (clean.length === 11) {
    return `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7)}`;
  }

  if (clean.length === 10) {
    return `(${clean.slice(0, 2)}) ${clean.slice(2, 6)}-${clean.slice(6)}`;
  }

  return clean || phone;
}

function sanitizeFilePart(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function AdminCells() {
  const qc = useQueryClient();
  const [filterNet, setFilterNet] = useState("");
  const [filterGender, setFilterGender] = useState("");
  const [filterWeekday, setFilterWeekday] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-cells"],
    queryFn: async () => {
      const [cells, nets] = await Promise.all([
        supabase.from("cells").select("*").order("created_at", { ascending: false }),
        supabase.from("networks").select("*").order("sort_order"),
      ]);
      if (cells.error) throw cells.error;
      if (nets.error) throw nets.error;
      const netMap = Object.fromEntries(nets.data.map((n) => [n.id, n]));
      return { cells: cells.data, netMap, networks: nets.data };
    },
  });

  const onDelete = async (id: string) => {
    if (!confirm("Excluir esta célula?")) return;
    const { error } = await supabase.from("cells").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Célula excluída");
    qc.invalidateQueries({ queryKey: ["admin-cells"] });
    qc.invalidateQueries({ queryKey: ["dashboard-cells"] });
  };

  const onToggleActive = async (id: string, current: boolean) => {
    const { error } = await supabase.from("cells").update({ is_active: !current }).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["admin-cells"] });
    qc.invalidateQueries({ queryKey: ["dashboard-cells"] });
  };

  const filtered = useMemo(() => {
    if (!data) return [];

    const normalizedSearch = searchTerm.trim().toLowerCase();

    return data.cells.filter((c) => {
      if (filterNet && c.network_id !== filterNet) return false;
      if (filterGender && c.gender !== filterGender) return false;
      if (filterWeekday !== "" && String(c.meeting_weekday) !== filterWeekday) return false;

      if (normalizedSearch) {
        const searchableText = [c.name, c.neighborhood, c.address, c.leader_name, c.leader2_name]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        if (!searchableText.includes(normalizedSearch)) return false;
      }

      return true;
    });
  }, [data, filterNet, filterGender, filterWeekday, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const hasActiveFilters =
    Boolean(filterNet) ||
    Boolean(filterGender) ||
    Boolean(filterWeekday) ||
    searchTerm.trim().length > 0;

  const exportCellsToPdf = () => {
    if (!data || filtered.length === 0) {
      toast.error("Nenhuma célula disponível para exportar.");
      return;
    }

    const doc = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a4",
    });

    const now = new Date();
    const exportedAt = `${now.toLocaleDateString("pt-BR")} às ${now.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    })}`;

    const filterSummary = [
      filterNet ? `Rede: ${data.netMap[filterNet]?.name ?? filterNet}` : null,
      filterGender ? `Tipo: ${GENDER_LABELS[filterGender] ?? filterGender}` : null,
      filterWeekday ? `Dia: ${formatWeekday(Number(filterWeekday))}` : null,
      searchTerm.trim() ? `Busca: ${searchTerm.trim()}` : null,
    ].filter(Boolean);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("Lista de Células", 14, 14);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`${filtered.length} célula(s) exportada(s) em ${exportedAt}`, 14, 21);

    doc.setFontSize(8);
    doc.setTextColor(90);
    doc.text(
      filterSummary.length > 0
        ? `Filtros aplicados: ${filterSummary.join(" | ")}`
        : "Sem filtros aplicados — lista completa.",
      14,
      27,
    );

    autoTable(doc, {
      startY: 32,
      head: [
        [
          "Célula",
          "Rede",
          "Tipo",
          "Dia",
          "Horário",
          "Bairro",
          "Endereço",
          "Líder",
          "WhatsApp",
          "Líder 2",
          "WhatsApp 2",
          "Status",
        ],
      ],
      body: filtered.map((cell) => [
        cell.name ?? "-",
        data.netMap[cell.network_id]?.name ?? cell.network_id ?? "-",
        GENDER_LABELS[cell.gender] ?? cell.gender ?? "-",
        formatWeekday(cell.meeting_weekday),
        formatTime(cell.meeting_time),
        cell.neighborhood ?? "-",
        cell.address ?? "-",
        cell.leader_name ?? "-",
        formatPhone(cell.leader_whatsapp),
        cell.leader2_name ?? "-",
        formatPhone(cell.leader2_whatsapp),
        cell.is_active ? "Ativa" : "Inativa",
      ]),
      styles: {
        fontSize: 7,
        cellPadding: 1.6,
        overflow: "linebreak",
        valign: "top",
      },
      headStyles: {
        fontStyle: "bold",
        halign: "center",
        fillColor: [37, 99, 235],
        textColor: 255,
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      columnStyles: {
        0: { cellWidth: 28 },
        1: { cellWidth: 24 },
        2: { cellWidth: 17 },
        3: { cellWidth: 21 },
        4: { cellWidth: 15 },
        5: { cellWidth: 23 },
        6: { cellWidth: 43 },
        7: { cellWidth: 24 },
        8: { cellWidth: 23 },
        9: { cellWidth: 24 },
        10: { cellWidth: 23 },
        11: { cellWidth: 14 },
      },
      margin: {
        top: 32,
        right: 8,
        bottom: 12,
        left: 8,
      },
      didDrawPage: () => {
        const pageSize = doc.internal.pageSize;
        const pageWidth = pageSize.getWidth();
        const pageHeight = pageSize.getHeight();
        const pageNumber = doc.getCurrentPageInfo().pageNumber;

        doc.setFontSize(8);
        doc.setTextColor(120);
        doc.text(`Página ${pageNumber}`, pageWidth - 24, pageHeight - 8);
      },
    });

    const datePart = now.toISOString().slice(0, 10);
    const searchPart = searchTerm.trim()
      ? `-${sanitizeFilePart(searchTerm.trim()).slice(0, 30)}`
      : "";
    const fileName = hasActiveFilters
      ? `celulas-filtradas${searchPart}-${datePart}.pdf`
      : `celulas-completas-${datePart}.pdf`;

    doc.save(fileName);
  };

  const resetPage = () => setPage(1);

  const clearFilters = () => {
    setFilterNet("");
    setFilterGender("");
    setFilterWeekday("");
    setSearchTerm("");
    setPage(1);
  };

  const activeCount = data?.cells.filter((cell) => cell.is_active).length ?? 0;
  const inactiveCount = data?.cells.filter((cell) => !cell.is_active).length ?? 0;

  return (
    <div className="mx-auto max-w-7xl space-y-7 p-5 md:p-8 lg:p-10">
      <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 text-white shadow-xl">
        <div className="grid gap-7 px-6 py-7 md:px-8 lg:grid-cols-[1fr_auto] lg:items-center lg:px-10 lg:py-9">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-blue-100">
              <UsersRound className="size-3.5" />
              Gestão administrativa
            </div>

            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Células</h1>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 md:text-base">
              Consulte, filtre e mantenha atualizado o cadastro das células do Campus Zona Norte.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={exportCellsToPdf}
              disabled={!data || filtered.length === 0}
              className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white"
            >
              <Download className="mr-2 size-4" />
              Baixar PDF
            </Button>

            <Button
              asChild
              variant="secondary"
              className="bg-white text-slate-950 hover:bg-slate-100"
            >
              <Link to="/admin/cells/new">
                <PlusCircle className="mr-2 size-4" />
                Nova célula
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Total cadastradas"
          value={data?.cells.length ?? 0}
          detail="Todas as células"
        />

        <SummaryCard
          label="Ativas"
          value={activeCount}
          detail="Disponíveis nas buscas"
          tone="success"
        />

        <SummaryCard label="Inativas" value={inactiveCount} detail="Fora das recomendações" />

        <SummaryCard
          label="Resultados atuais"
          value={filtered.length}
          detail={hasActiveFilters ? "Com filtros aplicados" : "Sem filtros"}
          tone={hasActiveFilters ? "primary" : "default"}
        />
      </section>

      <Card className="overflow-hidden border-border/60 shadow-sm">
        <div className="flex flex-col gap-3 border-b px-5 py-4 md:flex-row md:items-center md:justify-between md:px-6">
          <div>
            <h2 className="font-semibold">Filtros e pesquisa</h2>

            <p className="mt-0.5 text-sm text-muted-foreground">
              Encontre rapidamente por rede, perfil, dia, endereço ou liderança.
            </p>
          </div>

          {hasActiveFilters && (
            <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
              <FilterX className="mr-2 size-4" />
              Limpar filtros
            </Button>
          )}
        </div>

        <div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-4 md:p-6">
          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Rede
            </p>

            <Select
              value={filterNet || "all"}
              onValueChange={(value) => {
                setFilterNet(value === "all" ? "" : value);
                resetPage();
              }}
            >
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Todas as redes" />
              </SelectTrigger>

              <SelectContent>
                <SelectItem value="all">Todas as redes</SelectItem>

                {data?.networks.map((network) => (
                  <SelectItem key={network.id} value={network.id}>
                    {network.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Tipo
            </p>

            <Select
              value={filterGender || "all"}
              onValueChange={(value) => {
                setFilterGender(value === "all" ? "" : value);
                resetPage();
              }}
            >
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Todos os tipos" />
              </SelectTrigger>

              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                <SelectItem value="masculina">Masculina</SelectItem>
                <SelectItem value="feminina">Feminina</SelectItem>
                <SelectItem value="mista">Mista</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Dia da reunião
            </p>

            <Select
              value={filterWeekday === "" ? "all" : filterWeekday}
              onValueChange={(value) => {
                setFilterWeekday(value === "all" ? "" : value);
                resetPage();
              }}
            >
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Todos os dias" />
              </SelectTrigger>

              <SelectContent>
                <SelectItem value="all">Todos os dias</SelectItem>

                {WEEKDAYS.map((day) => (
                  <SelectItem key={day.value} value={String(day.value)}>
                    {day.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Pesquisa
            </p>

            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

              <Input
                className="h-11 pl-9"
                placeholder="Nome, bairro, endereço ou líder…"
                value={searchTerm}
                onChange={(event) => {
                  setSearchTerm(event.target.value);
                  resetPage();
                }}
              />
            </div>
          </div>
        </div>
      </Card>

      <section>
        <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight">Resultados</h2>

            <p className="mt-1 text-sm text-muted-foreground">
              {data ? `${filtered.length} de ${data.cells.length} células` : "Carregando células…"}
            </p>
          </div>

          {totalPages > 1 && (
            <p className="text-xs text-muted-foreground">
              Página {page} de {totalPages}
            </p>
          )}
        </div>

        {isLoading && (
          <Card className="border-border/60">
            <div className="p-8 text-center text-muted-foreground">Carregando células…</div>
          </Card>
        )}

        {data && filtered.length === 0 && (
          <Card className="border-dashed p-10 text-center">
            <MapPin className="mx-auto mb-3 size-10 text-muted-foreground" />

            <p className="font-medium">Nenhuma célula encontrada</p>

            <p className="mt-1 text-sm text-muted-foreground">
              Ajuste os filtros ou utilize outra palavra na pesquisa.
            </p>

            {hasActiveFilters && (
              <Button type="button" variant="outline" className="mt-4" onClick={clearFilters}>
                Limpar filtros
              </Button>
            )}

            {data.cells.length === 0 && (
              <Button asChild className="mt-4">
                <Link to="/admin/cells/new">Cadastrar primeira célula</Link>
              </Button>
            )}
          </Card>
        )}

        <div className="grid gap-4">
          {paginated.map((cell) => {
            const network = data?.netMap[cell.network_id];

            return (
              <Card
                key={cell.id}
                className="overflow-hidden border-border/60 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                  <div className="min-w-0">
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      {network && <NetworkBadge networkId={cell.network_id} name={network.name} />}

                      <span className="rounded-full border bg-muted/30 px-2.5 py-1 text-xs font-medium">
                        {GENDER_LABELS[cell.gender] ?? cell.gender}
                      </span>

                      {cell.meeting_weekday != null && (
                        <span className="inline-flex items-center gap-1.5 rounded-full border bg-background px-2.5 py-1 text-xs text-muted-foreground">
                          <CalendarDays className="size-3.5" />
                          {formatWeekday(cell.meeting_weekday)}
                          {cell.meeting_time ? ` · ${formatTime(cell.meeting_time)}` : ""}
                        </span>
                      )}

                      <Badge
                        variant={cell.is_active ? "default" : "secondary"}
                        className={cell.is_active ? "bg-emerald-600 hover:bg-emerald-600" : ""}
                      >
                        {cell.is_active ? "Ativa" : "Inativa"}
                      </Badge>
                    </div>

                    <h3 className="text-lg font-bold tracking-tight">{cell.name}</h3>

                    <div className="mt-2 flex items-start gap-2 text-sm text-muted-foreground">
                      <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />

                      <span>
                        {cell.address} — {cell.neighborhood}
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <UsersRound className="size-4 text-muted-foreground" />

                        <span>
                          <span className="text-muted-foreground">Liderança:</span>{" "}
                          <strong>{cell.leader_name}</strong>
                          {cell.leader2_name && ` / ${cell.leader2_name}`}
                        </span>
                      </div>

                      {cell.leader_whatsapp && (
                        <div className="flex items-center gap-2">
                          <Phone className="size-4 text-muted-foreground" />

                          <span className="font-medium">{formatPhone(cell.leader_whatsapp)}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 border-t pt-4 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
                    <div className="mr-1 flex items-center gap-2 rounded-xl border bg-muted/20 px-3 py-2">
                      <Switch
                        checked={cell.is_active}
                        onCheckedChange={() => onToggleActive(cell.id, cell.is_active)}
                        title={cell.is_active ? "Desativar célula" : "Ativar célula"}
                      />

                      <span className="text-xs font-medium text-muted-foreground">
                        {cell.is_active ? "Ativa" : "Inativa"}
                      </span>
                    </div>

                    <Button size="sm" variant="outline" asChild>
                      <Link to="/admin/cells/$id" params={{ id: cell.id }}>
                        <Pencil className="mr-2 size-4" />
                        Editar
                      </Link>
                    </Button>

                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => onDelete(cell.id)}
                      title="Excluir célula"
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {totalPages > 1 && (
          <div className="mt-7 flex items-center justify-center gap-3">
            <Button
              size="icon"
              variant="outline"
              disabled={page === 1}
              onClick={() => setPage((current) => current - 1)}
            >
              <ChevronLeft className="size-4" />
            </Button>

            <div className="rounded-full border bg-background px-4 py-2 text-sm text-muted-foreground">
              Página <strong className="text-foreground">{page}</strong> de{" "}
              <strong className="text-foreground">{totalPages}</strong>
            </div>

            <Button
              size="icon"
              variant="outline"
              disabled={page === totalPages}
              onClick={() => setPage((current) => current + 1)}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  detail,
  tone = "default",
}: {
  label: string;
  value: number;
  detail: string;
  tone?: "default" | "success" | "primary";
}) {
  return (
    <Card className="border-border/60 shadow-sm">
      <div className="p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>

        <p
          className={`mt-2 text-3xl font-bold tracking-tight ${
            tone === "success" ? "text-emerald-600" : tone === "primary" ? "text-primary" : ""
          }`}
        >
          {value}
        </p>

        <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
      </div>
    </Card>
  );
}
