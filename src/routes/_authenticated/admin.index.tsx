import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { NetworkBadge } from "@/components/NetworkBadge";
import { Switch } from "@/components/ui/switch";
import { Pencil, Trash2, PlusCircle, MapPin, ChevronLeft, ChevronRight, Search, Download } from "lucide-react";
import { toast } from "sonner";
import { useState, useMemo } from "react";
import { WEEKDAYS } from "@/lib/weekdays";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export const Route = createFileRoute("/_authenticated/admin/")(
  {
    head: () => ({ meta: [{ title: "Células • Admin" }] }),
    component: AdminCells,
  }
);

const PAGE_SIZE = 20;

const GENDER_LABELS: Record<string, string> = { masculina: "Masculina", feminina: "Feminina", mista: "Mista" };

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
      const netMap = Object.fromEntries(nets.data.map(n => [n.id, n]));
      return { cells: cells.data, netMap, networks: nets.data };
    },
  });

  const onDelete = async (id: string) => {
    if (!confirm("Excluir esta célula?")) return;
    const { error } = await supabase.from("cells").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Célula excluída");
    qc.invalidateQueries({ queryKey: ["admin-cells"] });
    qc.invalidateQueries({ queryKey: ["dashboard-cells"] });
  };

  const onToggleActive = async (id: string, current: boolean) => {
    const { error } = await supabase.from("cells").update({ is_active: !current }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["admin-cells"] });
    qc.invalidateQueries({ queryKey: ["dashboard-cells"] });
  };

  const filtered = useMemo(() => {
    if (!data) return [];

    const normalizedSearch = searchTerm.trim().toLowerCase();

    return data.cells.filter(c => {
      if (filterNet && c.network_id !== filterNet) return false;
      if (filterGender && c.gender !== filterGender) return false;
      if (filterWeekday !== "" && String(c.meeting_weekday) !== filterWeekday) return false;

      if (normalizedSearch) {
        const searchableText = [
          c.name,
          c.neighborhood,
          c.address,
          c.leader_name,
          c.leader2_name,
        ]
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
    doc.text(
      `${filtered.length} célula(s) exportada(s) em ${exportedAt}`,
      14,
      21,
    );

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
      head: [[
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
      ]],
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
    const searchPart = searchTerm.trim() ? `-${sanitizeFilePart(searchTerm.trim()).slice(0, 30)}` : "";
    const fileName = hasActiveFilters
      ? `celulas-filtradas${searchPart}-${datePart}.pdf`
      : `celulas-completas-${datePart}.pdf`;

    doc.save(fileName);
  };

  const resetPage = () => setPage(1);

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Células</h1>
          <p className="text-muted-foreground mt-1">
            {data ? `${filtered.length} de ${data.cells.length} células` : "Carregando…"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={exportCellsToPdf}
            disabled={!data || filtered.length === 0}
          >
            <Download className="size-4 mr-2" />
            Baixar PDF
          </Button>
          <Button asChild>
            <Link to="/admin/cells/new">
              <PlusCircle className="size-4 mr-2" />
              Nova célula
            </Link>
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <Card className="p-4 mb-6">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <Select value={filterNet || "all"} onValueChange={v => { setFilterNet(v === "all" ? "" : v); resetPage(); }}>
              <SelectTrigger><SelectValue placeholder="Todas as redes" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as redes</SelectItem>
                {data?.networks.map(n => <SelectItem key={n.id} value={n.id}>{n.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Select value={filterGender || "all"} onValueChange={v => { setFilterGender(v === "all" ? "" : v); resetPage(); }}>
              <SelectTrigger><SelectValue placeholder="Todos os tipos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                <SelectItem value="masculina">Masculina</SelectItem>
                <SelectItem value="feminina">Feminina</SelectItem>
                <SelectItem value="mista">Mista</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Select value={filterWeekday === "" ? "all" : filterWeekday} onValueChange={v => { setFilterWeekday(v === "all" ? "" : v); resetPage(); }}>
              <SelectTrigger><SelectValue placeholder="Todos os dias" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os dias</SelectItem>
                {WEEKDAYS.map(d => <SelectItem key={d.value} value={String(d.value)}>{d.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input
              className="pl-8"
              placeholder="Buscar por nome, bairro, endereço ou líder…"
              value={searchTerm}
              onChange={e => { setSearchTerm(e.target.value); resetPage(); }}
            />
          </div>
        </div>
      </Card>

      {isLoading && <p className="text-muted-foreground">Carregando…</p>}
      {data && filtered.length === 0 && (
        <Card className="p-10 text-center border-dashed">
          <MapPin className="size-10 mx-auto mb-3 text-muted-foreground" />
          <p className="text-muted-foreground">Nenhuma célula encontrada com esses filtros.</p>
          {data.cells.length === 0 && (
            <Button asChild className="mt-4"><Link to="/admin/cells/new">Cadastrar primeira célula</Link></Button>
          )}
        </Card>
      )}

      <div className="grid gap-3">
        {paginated.map(c => {
          const net = data?.netMap[c.network_id];
          return (
            <Card key={c.id} className="p-4 flex items-center justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  {net && <NetworkBadge networkId={c.network_id} name={net.name} />}
                  <span className="text-xs text-muted-foreground uppercase tracking-wide">{GENDER_LABELS[c.gender]}</span>
                  {c.meeting_weekday != null && (
                    <span className="text-xs text-muted-foreground">{WEEKDAYS.find(d => d.value === c.meeting_weekday)?.label}</span>
                  )}
                  {!c.is_active && (
                    <Badge variant="secondary" className="text-xs">Inativa</Badge>
                  )}
                </div>
                <h3 className="font-semibold truncate">{c.name}</h3>
                <p className="text-sm text-muted-foreground truncate">{c.address} — {c.neighborhood}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Líder: {c.leader_name}
                  {c.leader2_name && ` / ${c.leader2_name}`}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Switch
                  checked={c.is_active}
                  onCheckedChange={() => onToggleActive(c.id, c.is_active)}
                  title={c.is_active ? "Desativar" : "Ativar"}
                />
                <Button size="icon" variant="ghost" asChild>
                  <Link to="/admin/cells/$id" params={{ id: c.id }}><Pencil className="size-4" /></Link>
                </Button>
                <Button size="icon" variant="ghost" onClick={() => onDelete(c.id)}>
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <Button size="icon" variant="outline" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
            <ChevronLeft className="size-4" />
          </Button>
          <span className="text-sm text-muted-foreground px-2">Página {page} de {totalPages}</span>
          <Button size="icon" variant="outline" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
