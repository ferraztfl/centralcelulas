import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  geocodeAddress,
  reverseGeocodeCoordinates,
} from "@/lib/geocode.functions";
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
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { MapPin } from "lucide-react";
import { WEEKDAYS } from "@/lib/weekdays";

type Cell = {
  id?: string;
  name: string;
  network_id: string;
  gender: "masculina" | "feminina" | "mista";
  address: string;
  neighborhood: string;
  latitude: number | null;
  longitude: number | null;
  leader_name: string;
  leader_whatsapp: string;
  leader_instagram: string | null;
  leader2_name: string | null;
  leader2_whatsapp: string | null;
  meeting_weekday: number | null;
  meeting_time: string | null;
  is_active: boolean;
};

type LeafletModule = typeof import("leaflet");

function coordinateMarkerIcon(L: LeafletModule) {
  return L.divIcon({
    className: "",
    html: `<div style="width:28px;height:28px;border-radius:9999px;background:#2563eb;border:3px solid #fff;box-shadow:0 2px 10px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;color:#fff;font-size:14px;font-weight:800;">📍</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -28],
  });
}

function CoordinatePickerMap({
  latitude,
  longitude,
  onChange,
}: {
  latitude: number;
  longitude: number;
  onChange: (latitude: number, longitude: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const markerRef = useRef<import("leaflet").Marker | null>(null);
  const onChangeRef = useRef(onChange);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (typeof window === "undefined" || !ref.current) return;

    let cancelled = false;

    (async () => {
      try {
        const L = await import("leaflet");
        await import("leaflet/dist/leaflet.css");

        if (cancelled || !ref.current || mapRef.current) return;

        const initialPosition: [number, number] = [latitude, longitude];

        const map = L.map(ref.current, {
          center: initialPosition,
          zoom: 17,
          scrollWheelZoom: true,
          zoomControl: true,
        });

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>',
        }).addTo(map);

        const marker = L.marker(initialPosition, {
          draggable: true,
          icon: coordinateMarkerIcon(L),
          title: "Local da célula",
        })
          .addTo(map)
          .bindPopup("Arraste o pin até o local exato da célula.");

        marker.on("dragend", () => {
          const position = marker.getLatLng();
          onChangeRef.current(
            Number(position.lat.toFixed(7)),
            Number(position.lng.toFixed(7)),
          );
        });

        map.on("click", (event: import("leaflet").LeafletMouseEvent) => {
          marker.setLatLng(event.latlng);
          onChangeRef.current(
            Number(event.latlng.lat.toFixed(7)),
            Number(event.latlng.lng.toFixed(7)),
          );
        });

        mapRef.current = map;
        markerRef.current = marker;

        window.setTimeout(() => map.invalidateSize(), 0);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Erro ao carregar o mapa");
      }
    })();

    return () => {
      cancelled = true;
      markerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // A inicialização deve acontecer uma única vez quando o mapa aparece.
    // A sincronização das coordenadas acontece no efeito abaixo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const position: [number, number] = [latitude, longitude];
    markerRef.current?.setLatLng(position);
    mapRef.current?.setView(position, Math.max(mapRef.current.getZoom(), 16));
  }, [latitude, longitude]);

  if (error) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-dashed bg-muted/40 p-4 text-sm text-muted-foreground">
        {error}
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className="h-72 w-full overflow-hidden rounded-lg border bg-muted"
    />
  );
}

function parseCoordinate(value: string) {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatCoordinate(value: number | null) {
  return value == null ? "" : String(value);
}


const CELL_FORM_DRAFT_VERSION = 1;

function getDraftStorageKey(cellId?: string) {
  if (!cellId) return null;
  return `iacelulas:cell-form-draft:v${CELL_FORM_DRAFT_VERSION}:${cellId}`;
}

function readFormDraft(key: string | null): Partial<Cell> | null {
  if (!key || typeof window === "undefined") return null;

  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<Cell>;
    if (!parsed || typeof parsed !== "object") return null;

    return parsed;
  } catch {
    return null;
  }
}

function saveFormDraft(key: string | null, form: Cell) {
  if (!key || typeof window === "undefined") return;

  try {
    window.sessionStorage.setItem(key, JSON.stringify(form));
  } catch {
    // Ignora falhas de storage para não quebrar o formulário.
  }
}

function clearFormDraft(key: string | null) {
  if (!key || typeof window === "undefined") return;

  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // Ignora falhas de storage para não quebrar o formulário.
  }
}

function buildInitialForm(initial?: Partial<Cell>): Cell {
  const base = {
    name: "",
    network_id: "decolar",
    gender: "mista",
    address: "",
    neighborhood: "",
    latitude: null,
    longitude: null,
    leader_name: "",
    leader_whatsapp: "",
    leader_instagram: "",
    leader2_name: "",
    leader2_whatsapp: "",
    meeting_weekday: null,
    meeting_time: null,
    is_active: true,
    ...initial,
  } as Cell;

  const draft = readFormDraft(getDraftStorageKey(initial?.id));

  if (!draft) return base;

  return {
    ...base,
    ...draft,
    id: base.id,
  } as Cell;
}

export function CellForm({
  initial,
  onDone,
}: {
  initial?: Partial<Cell>;
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const geocodeFn = useServerFn(geocodeAddress);
  const reverseGeocodeFn = useServerFn(reverseGeocodeCoordinates);

  const draftStorageKey = getDraftStorageKey(initial?.id);
  const [form, setForm] = useState<Cell>(() => buildInitialForm(initial));
  const [saving, setSaving] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [reverseGeocoding, setReverseGeocoding] = useState(false);
  const lastReverseGeocodedKey = useRef<string | null>(null);
  const manualCoordinateTimer = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const { data: networks } = useQuery({
    queryKey: ["networks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("networks")
        .select("*")
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const update = (patch: Partial<Cell>) =>
    setForm((current) => ({ ...current, ...patch }));

  const applyReverseGeocode = async (
    latitude: number,
    longitude: number,
    options?: { silent?: boolean },
  ) => {
    const key = `${latitude.toFixed(7)},${longitude.toFixed(7)}`;

    if (lastReverseGeocodedKey.current === key) return;

    lastReverseGeocodedKey.current = key;
    setReverseGeocoding(true);

    try {
      const result = await reverseGeocodeFn({ data: { latitude, longitude } });

      if (!result.ok) {
        if (!options?.silent) toast.error(result.error);
        return;
      }

      const patch: Partial<Cell> = {};

      if (result.address?.trim()) patch.address = result.address.trim();
      if (result.neighborhood?.trim())
        patch.neighborhood = result.neighborhood.trim();

      if (Object.keys(patch).length > 0) {
        update(patch);
        if (!options?.silent)
          toast.success("Endereço e bairro atualizados pelo local do pin.");
      }
    } catch (e: any) {
      if (!options?.silent)
        toast.error(e?.message ?? "Erro ao buscar endereço pelo pin");
    } finally {
      setReverseGeocoding(false);
    }
  };

  const updateCoordinates = (
    latitude: number | null,
    longitude: number | null,
    options?: { reverseAddress?: boolean; debounceReverse?: boolean },
  ) => {
    update({ latitude, longitude });

    if (manualCoordinateTimer.current) {
      clearTimeout(manualCoordinateTimer.current);
      manualCoordinateTimer.current = null;
    }

    if (latitude == null || longitude == null || !options?.reverseAddress)
      return;

    if (options.debounceReverse) {
      manualCoordinateTimer.current = setTimeout(() => {
        void applyReverseGeocode(latitude, longitude, { silent: true });
      }, 800);
      return;
    }

    void applyReverseGeocode(latitude, longitude);
  };

  const updateLatitudeFromInput = (value: string) => {
    const latitude = parseCoordinate(value);
    updateCoordinates(latitude, form.longitude, {
      reverseAddress: latitude != null && form.longitude != null,
      debounceReverse: true,
    });
  };

  const updateLongitudeFromInput = (value: string) => {
    const longitude = parseCoordinate(value);
    updateCoordinates(form.latitude, longitude, {
      reverseAddress: form.latitude != null && longitude != null,
      debounceReverse: true,
    });
  };

  const handleGeocode = async () => {
    if (!form.address.trim()) {
      toast.error("Informe o endereço");
      return;
    }

    setGeocoding(true);

    try {
      const result = await geocodeFn({ data: { address: form.address } });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      updateCoordinates(result.latitude, result.longitude);
      toast.success(
        "Coordenadas obtidas! Confira no mapa e ajuste o pin se necessário.",
      );
    } catch (e: any) {
      toast.error(e?.message ?? "Erro");
    } finally {
      setGeocoding(false);
    }
  };

  const save = async () => {
    if (
      !form.name ||
      !form.address ||
      !form.neighborhood ||
      !form.leader_name ||
      !form.leader_whatsapp
    ) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    if (
      (form.latitude == null && form.longitude != null) ||
      (form.latitude != null && form.longitude == null)
    ) {
      toast.error(
        "Informe latitude e longitude juntas, ou deixe as duas vazias.",
      );
      return;
    }

    setSaving(true);

    try {
      const payload = { ...form };

      if (payload.latitude == null || payload.longitude == null) {
        const result = await geocodeFn({ data: { address: payload.address } });
        if (result.ok) {
          payload.latitude = result.latitude;
          payload.longitude = result.longitude;
        }
      } else {
        const reverseResult = await reverseGeocodeFn({
          data: {
            latitude: payload.latitude,
            longitude: payload.longitude,
          },
        });

        if (reverseResult.ok) {
          if (reverseResult.address?.trim())
            payload.address = reverseResult.address.trim();
          if (reverseResult.neighborhood?.trim())
            payload.neighborhood = reverseResult.neighborhood.trim();
        }
      }

      const row = {
        name: payload.name,
        network_id: payload.network_id,
        gender: payload.gender,
        address: payload.address,
        neighborhood: payload.neighborhood,
        latitude: payload.latitude,
        longitude: payload.longitude,
        leader_name: payload.leader_name,
        leader_whatsapp: payload.leader_whatsapp.replace(/\D/g, ""),
        leader_instagram: payload.leader_instagram || null,
        leader2_name: payload.leader2_name || null,
        leader2_whatsapp: payload.leader2_whatsapp
          ? payload.leader2_whatsapp.replace(/\D/g, "")
          : null,
        meeting_weekday: payload.meeting_weekday,
        meeting_time: payload.meeting_time,
        is_active: payload.is_active,
      };

      const operation = payload.id
        ? supabase.from("cells").update(row).eq("id", payload.id)
        : supabase.from("cells").insert(row);

      const { error } = await operation;
      if (error) throw error;

      toast.success("Salvo!");
      qc.invalidateQueries({ queryKey: ["admin-cells"] });
      qc.invalidateQueries({ queryKey: ["dashboard-cells"] });
      finishAndClearDraft();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    return () => {
      if (manualCoordinateTimer.current)
        clearTimeout(manualCoordinateTimer.current);
    };
  }, []);

  useEffect(() => {
    saveFormDraft(draftStorageKey, form);
  }, [draftStorageKey, form]);

  const finishAndClearDraft = () => {
    clearFormDraft(draftStorageKey);
    onDone();
  };

  // Lock kids network to mista
  useEffect(() => {
    if (form.network_id === "decolar" && form.gender !== "mista")
      update({ gender: "mista" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.network_id]);

  return (
    <Card className="p-6 space-y-4">
      {/* Status ativo/inativo */}
      <div className="flex items-center gap-3 rounded-lg border p-3 bg-muted/30">
        <Switch
          checked={form.is_active}
          onCheckedChange={(value) => update({ is_active: value })}
          id="is-active"
        />
        <Label htmlFor="is-active" className="cursor-pointer">
          {form.is_active ? (
            <span className="text-green-600 font-medium">
              Célula ativa — aparece na busca pública
            </span>
          ) : (
            <span className="text-muted-foreground">
              Célula inativa — não aparece na busca
            </span>
          )}
        </Label>
      </div>

      <Row>
        <Field label="Nome da célula *">
          <Input
            value={form.name}
            onChange={(event) => update({ name: event.target.value })}
          />
        </Field>
        <Field label="Rede *">
          <Select
            value={form.network_id}
            onValueChange={(value) => update({ network_id: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {networks?.map((network) => (
                <SelectItem key={network.id} value={network.id}>
                  {network.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </Row>

      <Field label="Tipo de célula *">
        <Select
          value={form.gender}
          onValueChange={(value) => update({ gender: value as Cell["gender"] })}
          disabled={form.network_id === "decolar"}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="masculina">Masculina</SelectItem>
            <SelectItem value="feminina">Feminina</SelectItem>
            <SelectItem value="mista">Mista</SelectItem>
          </SelectContent>
        </Select>
        {form.network_id === "decolar" && (
          <p className="text-xs text-muted-foreground mt-1">
            Rede Decolar é sempre mista.
          </p>
        )}
      </Field>

      <Field label="Endereço completo *">
        <div className="flex gap-2">
          <Input
            value={form.address}
            onChange={(event) =>
              update({
                address: event.target.value,
                latitude: null,
                longitude: null,
              })
            }
          />
          <Button
            type="button"
            variant="outline"
            onClick={handleGeocode}
            disabled={geocoding}
          >
            <MapPin className="size-4 mr-1" />
            {geocoding ? "Buscando..." : "Buscar coords"}
          </Button>
        </div>
      </Field>

      <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Coordenadas da célula</p>
            <p className="text-xs text-muted-foreground">
              Após buscar as coordenadas, ajuste o local arrastando o pin no
              mapa, clicando no mapa ou digitando latitude e longitude
              manualmente.
            </p>
          </div>
          {(form.latitude != null || form.longitude != null) && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => updateCoordinates(null, null)}
            >
              Limpar
            </Button>
          )}
        </div>

        <Row>
          <Field label="Latitude (opcional)">
            <Input
              inputMode="decimal"
              placeholder="Ex: -8.087859"
              value={formatCoordinate(form.latitude)}
              onChange={(event) => updateLatitudeFromInput(event.target.value)}
            />
          </Field>
          <Field label="Longitude (opcional)">
            <Input
              inputMode="decimal"
              placeholder="Ex: -34.894807"
              value={formatCoordinate(form.longitude)}
              onChange={(event) => updateLongitudeFromInput(event.target.value)}
            />
          </Field>
        </Row>

        {form.latitude != null && form.longitude != null ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                📍 {form.latitude.toFixed(6)}, {form.longitude.toFixed(6)}
              </p>
              {reverseGeocoding && (
                <p className="text-xs text-muted-foreground">
                  Atualizando endereço pelo pin...
                </p>
              )}
            </div>
            <CoordinatePickerMap
              latitude={form.latitude}
              longitude={form.longitude}
              onChange={(latitude, longitude) =>
                updateCoordinates(latitude, longitude, { reverseAddress: true })
              }
            />
          </div>
        ) : (
          <div className="flex min-h-32 items-center justify-center rounded-lg border border-dashed bg-background p-4 text-center text-sm text-muted-foreground">
            Busque as coordenadas ou digite latitude e longitude para visualizar
            o pin no mapa.
          </div>
        )}
      </div>

      <Row>
        <Field label="Bairro *">
          <Input
            value={form.neighborhood}
            onChange={(event) => update({ neighborhood: event.target.value })}
          />
        </Field>
        <Field label="Nome do líder *">
          <Input
            value={form.leader_name}
            onChange={(event) => update({ leader_name: event.target.value })}
          />
        </Field>
      </Row>

      <Row>
        <Field label="WhatsApp do líder *">
          <Input
            placeholder="5511999999999"
            value={form.leader_whatsapp}
            onChange={(event) =>
              update({ leader_whatsapp: event.target.value.replace(/\D/g, "") })
            }
          />
        </Field>
        <Field label="Instagram (opcional)">
          <Input
            placeholder="@celula"
            value={form.leader_instagram ?? ""}
            onChange={(event) =>
              update({ leader_instagram: event.target.value })
            }
          />
        </Field>
      </Row>

      {/* Segundo líder */}
      <div className="rounded-lg border p-4 space-y-3">
        <p className="text-sm font-medium text-muted-foreground">
          Segundo líder (opcional)
        </p>
        <Row>
          <Field label="Nome do 2º líder">
            <Input
              placeholder="Nome"
              value={form.leader2_name ?? ""}
              onChange={(event) =>
                update({ leader2_name: event.target.value || null })
              }
            />
          </Field>
          <Field label="WhatsApp do 2º líder">
            <Input
              placeholder="5511999999999"
              value={form.leader2_whatsapp ?? ""}
              onChange={(event) =>
                update({
                  leader2_whatsapp:
                    event.target.value.replace(/\D/g, "") || null,
                })
              }
            />
          </Field>
        </Row>
      </div>

      <Row>
        <Field label="Dia da semana da reunião">
          <Select
            value={
              form.meeting_weekday == null
                ? "none"
                : String(form.meeting_weekday)
            }
            onValueChange={(value) =>
              update({
                meeting_weekday: value === "none" ? null : Number(value),
              })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Não definido</SelectItem>
              {WEEKDAYS.map((day) => (
                <SelectItem key={day.value} value={String(day.value)}>
                  {day.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Horário de início">
          <Input
            type="time"
            value={form.meeting_time ? form.meeting_time.slice(0, 5) : ""}
            onChange={(event) =>
              update({ meeting_time: event.target.value || null })
            }
          />
        </Field>
      </Row>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={finishAndClearDraft}>
          Cancelar
        </Button>
        <Button onClick={save} disabled={saving}>
          {saving ? "Salvando…" : "Salvar"}
        </Button>
      </div>
    </Card>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid md:grid-cols-2 gap-4">{children}</div>;
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
