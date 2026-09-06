import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, FileDown, FileSpreadsheet, Info, Upload } from "lucide-react";
import { importCells } from "@/lib/cells-import.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/import")({
  head: () => ({
    meta: [
      {
        title: "Importar CSV • Central de Células",
      },
    ],
  }),
  component: ImportPage,
});

const HEADERS = [
  "name",
  "network_id",
  "gender",

  // Compatibilidade antiga
  "address",

  // Novo endereço estruturado
  "street",
  "street_number",
  "address_complement",
  "neighborhood",
  "city",
  "state",
  "postal_code",

  "leader_name",
  "leader_whatsapp",
  "leader_instagram",
  "leader2_name",
  "leader2_whatsapp",
  "meeting_weekday",
  "meeting_time",
  "is_active",
] as const;

const BASE_REQUIRED_HEADERS = [
  "name",
  "network_id",
  "gender",
  "neighborhood",
  "leader_name",
  "leader_whatsapp",
] as const;

const STRUCTURED_REQUIRED_HEADERS = ["street", "street_number", "city", "state"] as const;

const SAMPLE_CSV = `name,network_id,gender,street,street_number,address_complement,neighborhood,city,state,postal_code,leader_name,leader_whatsapp,leader_instagram,leader2_name,leader2_whatsapp,meeting_weekday,meeting_time,is_active
Célula Esperança,connect,mista,Rua das Flores,100,,Boa Viagem,Recife,PE,51000-000,Maria Silva,5581999999999,@mariasilva,João Costa,5581988888888,3,19:30,true
Célula Vitória,connect_up,feminina,Avenida Brasil,500,,Afogados,Recife,PE,,Ana Santos,5581977777777,,,,5,20:00,true
`;

type ImportResult = {
  imported: number;
  errors: Array<{
    line: number;
    error: string;
  }>;
  warnings: Array<{
    line: number;
    warning: string;
  }>;
};

function detectDelimiter(text: string) {
  const firstLine = text.split(/\r?\n/).find((line) => line.trim()) ?? "";

  let commas = 0;
  let semicolons = 0;
  let quoted = false;

  for (const character of firstLine) {
    if (character === '"') {
      quoted = !quoted;
      continue;
    }

    if (quoted) continue;

    if (character === ",") commas++;
    if (character === ";") semicolons++;
  }

  return semicolons > commas ? ";" : ",";
}

function parseCSV(text: string): string[][] {
  const delimiter = detectDelimiter(text);

  const rows: string[][] = [];
  let currentRow: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index++) {
    const character = text[index];

    if (inQuotes) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"';
        index++;
      } else if (character === '"') {
        inQuotes = false;
      } else {
        field += character;
      }

      continue;
    }

    if (character === '"') {
      inQuotes = true;
    } else if (character === delimiter) {
      currentRow.push(field);
      field = "";
    } else if (character === "\r") {
      // Ignora CR.
    } else if (character === "\n") {
      currentRow.push(field);
      rows.push(currentRow);
      currentRow = [];
      field = "";
    } else {
      field += character;
    }
  }

  if (field.length > 0 || currentRow.length > 0) {
    currentRow.push(field);
    rows.push(currentRow);
  }

  return rows.filter((row) => row.length > 1 || (row.length === 1 && row[0].trim() !== ""));
}

function ImportPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const importFn = useServerFn(importCells);

  const [file, setFile] = useState<File | null>(null);

  const [detectedHeaders, setDetectedHeaders] = useState<string[]>([]);

  const [preview, setPreview] = useState<Array<Record<string, string>>>([]);

  const [geocode, setGeocode] = useState(true);

  const [busy, setBusy] = useState(false);

  const [result, setResult] = useState<ImportResult | null>(null);

  const onFile = async (selectedFile: File) => {
    setFile(selectedFile);
    setResult(null);

    const text = await selectedFile.text();

    const rows = parseCSV(text);

    if (rows.length < 2) {
      toast.error("CSV vazio ou sem cabeçalho.");

      setPreview([]);
      setDetectedHeaders([]);
      return;
    }

    const header = rows[0].map((value, index) =>
      value
        .replace(index === 0 ? /^\uFEFF/ : /$^/, "")
        .trim()
        .toLowerCase(),
    );

    const missingBase = BASE_REQUIRED_HEADERS.filter((required) => !header.includes(required));

    if (missingBase.length > 0) {
      toast.error(`Colunas obrigatórias ausentes: ${missingBase.join(", ")}`);

      setPreview([]);
      setDetectedHeaders(header);
      return;
    }

    const hasLegacyAddress = header.includes("address");

    const hasStructuredAddress = STRUCTURED_REQUIRED_HEADERS.every((required) =>
      header.includes(required),
    );

    if (!hasLegacyAddress && !hasStructuredAddress) {
      toast.error(
        "O CSV precisa conter a coluna address ou as colunas street, street_number, city e state.",
      );

      setPreview([]);
      setDetectedHeaders(header);
      return;
    }

    const parsed = rows
      .slice(1)
      .map((row) =>
        Object.fromEntries(header.map((column, index) => [column, (row[index] ?? "").trim()])),
      );

    setDetectedHeaders(header);
    setPreview(parsed);

    toast.success(`${parsed.length} linha(s) detectada(s).`);
  };

  const submit = async () => {
    if (preview.length === 0) {
      toast.error("Selecione um CSV válido.");
      return;
    }

    setBusy(true);

    try {
      const response = await importFn({
        data: {
          rows: preview.map((row) => {
            const weekday = row.meeting_weekday?.trim();

            const meetingTime = row.meeting_time?.trim();

            const active = row.is_active?.trim().toLowerCase();

            return {
              name: row.name,
              network_id: row.network_id,

              gender: (row.gender || "mista") as "masculina" | "feminina" | "mista",

              address: row.address || null,

              street: row.street || null,

              street_number: row.street_number || null,

              address_complement: row.address_complement || null,

              neighborhood: row.neighborhood,

              city: row.city || null,

              state: row.state || null,

              postal_code: row.postal_code || null,

              leader_name: row.leader_name,

              leader_whatsapp: row.leader_whatsapp,

              leader_instagram: row.leader_instagram || null,

              leader2_name: row.leader2_name || null,

              leader2_whatsapp: row.leader2_whatsapp || null,

              meeting_weekday: weekday ? Number(weekday) : null,

              meeting_time: meetingTime || null,

              is_active: active === "false" ? false : true,
            };
          }),

          geocode,
        },
      });

      setResult(response);

      if (response.ok) {
        toast.success(`${response.imported} célula(s) importada(s).`);

        void qc.invalidateQueries({
          queryKey: ["admin-cells"],
        });

        void qc.invalidateQueries({
          queryKey: ["dashboard-cells"],
        });
      } else {
        toast.error("A importação não pôde ser concluída.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro durante a importação.");
    } finally {
      setBusy(false);
    }
  };

  const downloadSample = () => {
    const blob = new Blob(["\uFEFF", SAMPLE_CSV], {
      type: "text/csv;charset=utf-8",
    });

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");

    link.href = url;
    link.download = "modelo-celulas-estruturado.csv";

    link.click();

    URL.revokeObjectURL(url);
  };

  const visibleHeaders = HEADERS.filter((header) => detectedHeaders.includes(header)).slice(0, 11);

  return (
    <div className="mx-auto max-w-6xl space-y-7 p-5 md:p-8 lg:p-10">
      <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 px-6 py-7 text-white shadow-xl md:px-8 lg:px-10 lg:py-9">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-blue-100">
          <FileSpreadsheet className="size-3.5" />
          Importação em lote
        </div>

        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Importar células</h1>

        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 md:text-base">
          Cadastre diversas células através de um arquivo CSV. O formato novo utiliza endereço
          estruturado e o formato antigo continua compatível.
        </p>
      </section>

      <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
        <Card className="border-border/60 shadow-sm">
          <CardHeader>
            <CardTitle>Modelo recomendado</CardTitle>

            <CardDescription>
              Utilize o novo formato para que endereço, cidade, UF e CEP sejam armazenados
              separadamente.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-5">
            <Button type="button" variant="outline" onClick={downloadSample}>
              <FileDown className="mr-2 size-4" />
              Baixar modelo CSV
            </Button>

            <div className="rounded-xl border bg-muted/20 p-4">
              <p className="text-sm font-semibold">Campos obrigatórios</p>

              <p className="mt-2 text-xs leading-6 text-muted-foreground">
                name, network_id, gender, street, street_number, neighborhood, city, state,
                leader_name e leader_whatsapp.
              </p>
            </div>

            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-blue-950">
              <div className="flex gap-3">
                <Info className="mt-0.5 size-5 shrink-0 text-blue-600" />

                <div>
                  <p className="text-sm font-semibold">Arquivos antigos continuam aceitos</p>

                  <p className="mt-1 text-xs leading-5 text-blue-800">
                    Se o CSV possuir a coluna
                    <code className="mx-1">address</code>
                    em vez de rua/número/cidade/UF, ele será importado no modo legado.
                  </p>
                </div>
              </div>
            </div>

            <div className="text-xs leading-6 text-muted-foreground">
              <p>
                <strong>gender:</strong> masculina, feminina ou mista
              </p>

              <p>
                <strong>network_id:</strong> decolar, start, connect, connect_up, acelere, impulse
                ou amor_a2
              </p>

              <p>
                <strong>meeting_weekday:</strong> 0=Domingo até 6=Sábado
              </p>

              <p>
                <strong>meeting_time:</strong> HH:MM
              </p>

              <p>
                <strong>is_active:</strong> true/false
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm">
          <CardHeader>
            <CardTitle>Enviar arquivo</CardTitle>

            <CardDescription>
              Arquivos CSV separados por vírgula ou ponto e vírgula são aceitos.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label>Arquivo CSV</Label>

              <Input
                type="file"
                accept=".csv,text/csv"
                onChange={(event) => {
                  const selected = event.target.files?.[0];

                  if (selected) {
                    void onFile(selected);
                  }
                }}
              />
            </div>

            <label className="flex cursor-pointer items-start gap-3 rounded-xl border bg-muted/20 p-4 text-sm">
              <Checkbox
                className="mt-0.5"
                checked={geocode}
                onCheckedChange={(value) => setGeocode(Boolean(value))}
              />

              <span>
                <strong>Geolocalizar automaticamente</strong>

                <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                  Recomendado. O sistema tentará gerar latitude e longitude para cada endereço
                  importado.
                </span>
              </span>
            </label>

            {preview.length > 0 && (
              <div className="overflow-hidden rounded-xl border">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/40 px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold">Pré-visualização</p>

                    <p className="text-xs text-muted-foreground">
                      {preview.length} linha(s) detectada(s)
                      {file ? ` · ${file.name}` : ""}
                    </p>
                  </div>

                  <CheckCircle2 className="size-5 text-emerald-600" />
                </div>

                <div className="max-h-80 overflow-auto text-xs">
                  <table className="min-w-full">
                    <thead className="sticky top-0 bg-background">
                      <tr>
                        {visibleHeaders.map((header) => (
                          <th
                            key={header}
                            className="whitespace-nowrap border-b px-3 py-2 text-left font-semibold"
                          >
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>

                    <tbody>
                      {preview.slice(0, 50).map((row, index) => (
                        <tr key={index} className="border-b last:border-0">
                          {visibleHeaders.map((header) => (
                            <td key={header} className="max-w-[180px] truncate px-3 py-2">
                              {row[header]}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {preview.length > 50 && (
                    <div className="px-4 py-3 text-muted-foreground">
                      + {preview.length - 50} linha(s)
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  navigate({
                    to: "/admin",
                  })
                }
                disabled={busy}
              >
                Cancelar
              </Button>

              <Button type="button" disabled={busy || preview.length === 0} onClick={submit}>
                <Upload className="mr-2 size-4" />

                {busy ? "Importando..." : `Importar ${preview.length || ""}`}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {result && (
        <Card className="border-border/60 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {result.errors.length === 0 ? (
                <CheckCircle2 className="size-5 text-emerald-600" />
              ) : (
                <AlertTriangle className="size-5 text-amber-600" />
              )}
              Resultado da importação
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-5">
            <div className="rounded-xl border bg-muted/20 p-4">
              <p className="text-sm">
                <strong className="text-lg">{result.imported}</strong> célula(s) importada(s) com
                sucesso.
              </p>
            </div>

            {result.warnings.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p className="mb-2 text-sm font-semibold text-amber-900">Avisos</p>

                <ul className="space-y-1 text-sm text-amber-800">
                  {result.warnings.map((warning, index) => (
                    <li key={index}>
                      Linha {warning.line}: {warning.warning}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {result.errors.length > 0 && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                <p className="mb-2 text-sm font-semibold text-red-900">Erros</p>

                <ul className="space-y-1 text-sm text-red-800">
                  {result.errors.map((error, index) => (
                    <li key={index}>
                      {error.line > 0 ? `Linha ${error.line}: ` : ""}
                      {error.error}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
