import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { importCells } from "@/lib/cells-import.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Upload, FileDown, CheckCircle2, AlertTriangle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/_authenticated/admin/import")({
  head: () => ({ meta: [{ title: "Importar CSV • Admin" }] }),
  component: ImportPage,
});

const HEADERS = [
  "name", "network_id", "gender", "address", "neighborhood",
  "leader_name", "leader_whatsapp", "leader_instagram",
  "leader2_name", "leader2_whatsapp",
  "meeting_weekday", "meeting_time", "is_active",
] as const;

const OPTIONAL_HEADERS = new Set([
  "leader_instagram", "leader2_name", "leader2_whatsapp",
  "meeting_weekday", "meeting_time", "is_active",
]);

const SAMPLE_CSV = `name,network_id,gender,address,neighborhood,leader_name,leader_whatsapp,leader_instagram,leader2_name,leader2_whatsapp,meeting_weekday,meeting_time,is_active
Célula Esperança,connect,mista,"Rua das Flores, 100, Recife, PE",Boa Viagem,Maria Silva,5581999999999,@mariasilva,João Costa,5581988888888,3,19:30,true
Célula Vitória,connect_up,feminina,"Av Brasil, 500, Recife, PE",Afogados,Ana Santos,5581977777777,,,,,20:00,true
`;

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") { cur.push(field); field = ""; }
      else if (c === "\r") { /* skip */ }
      else if (c === "\n") { cur.push(field); rows.push(cur); cur = []; field = ""; }
      else field += c;
    }
  }
  if (field.length > 0 || cur.length > 0) { cur.push(field); rows.push(cur); }
  return rows.filter(r => r.length > 1 || (r.length === 1 && r[0].trim() !== ""));
}

function ImportPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const importFn = useServerFn(importCells);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Array<Record<string, string>>>([]);
  const [geocode, setGeocode] = useState(true);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ imported: number; errors: Array<{ line: number; error: string }> } | null>(null);

  const REQUIRED_HEADERS = HEADERS.filter(h => !OPTIONAL_HEADERS.has(h));

  const onFile = async (f: File) => {
    setFile(f);
    setResult(null);
    const text = await f.text();
    const rows = parseCSV(text);
    if (rows.length < 2) { toast.error("CSV vazio ou sem cabeçalho"); setPreview([]); return; }
    const header = rows[0].map(h => h.trim().toLowerCase());
    const missing = REQUIRED_HEADERS.filter(h => !header.includes(h));
    if (missing.length) { toast.error(`Colunas faltando: ${missing.join(", ")}`); setPreview([]); return; }
    const parsed = rows.slice(1).map(r => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? "").trim()])));
    setPreview(parsed);
  };

  const submit = async () => {
    if (preview.length === 0) { toast.error("Selecione um CSV válido"); return; }
    setBusy(true);
    try {
      const r = await importFn({
        data: {
          rows: preview.map(p => {
            const wd = p.meeting_weekday?.trim();
            const mt = p.meeting_time?.trim();
            const active = p.is_active?.trim().toLowerCase();
            return {
              name: p.name,
              network_id: p.network_id,
              gender: (p.gender || "mista") as any,
              address: p.address,
              neighborhood: p.neighborhood,
              leader_name: p.leader_name,
              leader_whatsapp: p.leader_whatsapp,
              leader_instagram: p.leader_instagram || null,
              leader2_name: p.leader2_name || null,
              leader2_whatsapp: p.leader2_whatsapp || null,
              meeting_weekday: wd ? Number(wd) : null,
              meeting_time: mt || null,
              is_active: active === "false" ? false : true,
            };
          }),
          geocode,
        },
      });
      setResult(r);
      if (r.ok) {
        toast.success(`${r.imported} célula(s) importada(s)`);
        qc.invalidateQueries({ queryKey: ["admin-cells"] });
        qc.invalidateQueries({ queryKey: ["dashboard-cells"] });
      } else {
        toast.error("Falha na importação");
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Erro");
    } finally {
      setBusy(false);
    }
  };

  const downloadSample = () => {
    const blob = new Blob([SAMPLE_CSV], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "modelo-celulas.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  // Show only visible headers in the preview table
  const VISIBLE_HEADERS = HEADERS.slice(0, 10);

  return (
    <div className="p-6 md:p-10 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Importar células (CSV)</h1>
        <p className="text-muted-foreground mt-1">Cadastre várias células de uma vez enviando um arquivo CSV.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Modelo do arquivo</CardTitle>
          <CardDescription>
            Obrigatórias: <code>name, network_id, gender, address, neighborhood, leader_name, leader_whatsapp</code>.<br />
            Opcionais: <code>leader_instagram</code>, <code>leader2_name</code>, <code>leader2_whatsapp</code>,{" "}
            <code>meeting_weekday</code> (0=Dom … 6=Sáb), <code>meeting_time</code> (HH:MM), <code>is_active</code> (true/false, padrão true).<br />
            <code>gender</code>: masculina, feminina, mista. <code>network_id</code>: decolar, start, connect, connect_up, acelere, impulse, amor_a2.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={downloadSample}>
            <FileDown className="size-4 mr-2" /> Baixar CSV de exemplo
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Enviar arquivo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Arquivo CSV</Label>
            <Input type="file" accept=".csv,text/csv" onChange={e => e.target.files?.[0] && onFile(e.target.files[0])} />
          </div>

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox checked={geocode} onCheckedChange={v => setGeocode(!!v)} />
            Geocodificar endereços automaticamente (recomendado)
          </label>

          {preview.length > 0 && (
            <div className="rounded-lg border overflow-hidden">
              <div className="px-4 py-2 bg-muted text-xs font-medium">{preview.length} linha(s) detectada(s){file ? ` — ${file.name}` : ""}</div>
              <div className="max-h-72 overflow-auto text-xs">
                <table className="w-full">
                  <thead className="bg-muted/40">
                    <tr>{VISIBLE_HEADERS.map(h => <th key={h} className="text-left px-3 py-2 font-medium">{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {preview.slice(0, 50).map((r, i) => (
                      <tr key={i} className="border-t">
                        {VISIBLE_HEADERS.map(h => <td key={h} className="px-3 py-1.5 truncate max-w-[160px]">{r[h]}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {preview.length > 50 && <div className="px-3 py-2 text-muted-foreground">+ {preview.length - 50} linhas…</div>}
              </div>
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => navigate({ to: "/admin" })}>Cancelar</Button>
            <Button disabled={busy || preview.length === 0} onClick={submit}>
              <Upload className="size-4 mr-2" /> {busy ? "Importando…" : `Importar ${preview.length || ""}`}
            </Button>
          </div>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {result.errors.length === 0 ? <CheckCircle2 className="size-5 text-net-start" /> : <AlertTriangle className="size-5 text-net-acelere" />}
              Resultado
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p><strong>{result.imported}</strong> célula(s) importada(s) com sucesso.</p>
            {result.errors.length > 0 && (
              <div>
                <p className="font-medium mb-1">Erros:</p>
                <ul className="list-disc pl-5 space-y-0.5 text-muted-foreground">
                  {result.errors.map((e, i) => <li key={i}>Linha {e.line}: {e.error}</li>)}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
