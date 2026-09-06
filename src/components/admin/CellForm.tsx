import { type ReactNode, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BadgeCheck,
  Building2,
  CalendarClock,
  LocateFixed,
  MapPin,
  Save,
  UsersRound,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { geocodeAddress, reverseGeocodeCoordinates } from "@/lib/geocode.functions";
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
import { WEEKDAYS } from "@/lib/weekdays";

type Cell = {
  id?: string;
  name: string;
  network_id: string;
  gender: "masculina" | "feminina" | "mista";

  address: string;
  street: string | null;
  street_number: string | null;
  address_complement: string | null;
  neighborhood: string;
  city: string | null;
  state: string | null;
  postal_code: string | null;

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

type LeafletModule = typeof import("leaflet");

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function coordinateMarkerIcon(L: LeafletModule) {
  return L.divIcon({
    className: "",
    html: `<div style="width:30px;height:30px;border-radius:9999px;background:#2563eb;border:3px solid #fff;box-shadow:0 2px 12px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;color:#fff;font-size:14px;font-weight:800;">📍</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -30],
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

    void (async () => {
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
          .bindPopup("Arraste o pin para ajustar o local exato.");

        marker.on("dragend", () => {
          const position = marker.getLatLng();

          onChangeRef.current(Number(position.lat.toFixed(7)), Number(position.lng.toFixed(7)));
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
      } catch (error) {
        if (!cancelled) {
          setError(getErrorMessage(error, "Erro ao carregar o mapa."));
        }
      }
    })();

    return () => {
      cancelled = true;
      markerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };

    // Inicialização única do mapa.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const position: [number, number] = [latitude, longitude];

    markerRef.current?.setLatLng(position);

    if (mapRef.current) {
      mapRef.current.setView(position, Math.max(mapRef.current.getZoom(), 16));
    }
  }, [latitude, longitude]);

  if (error) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-dashed bg-muted/30 p-5 text-center text-sm text-muted-foreground">
        {error}
      </div>
    );
  }

  return <div ref={ref} className="h-80 w-full overflow-hidden rounded-xl border bg-muted" />;
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

function normalizePostalCode(value?: string | null) {
  if (!value) return null;

  const digits = value.replace(/\D/g, "").slice(0, 8);

  if (digits.length === 8) {
    return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  }

  return digits || null;
}

function trimOrNull(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function hasAnyStructuredAddress(cell: Cell) {
  return Boolean(
    cell.street?.trim() ||
    cell.street_number?.trim() ||
    cell.address_complement?.trim() ||
    cell.city?.trim() ||
    cell.state?.trim() ||
    cell.postal_code?.trim(),
  );
}

function hasCompleteStructuredAddress(cell: Cell) {
  return Boolean(
    cell.street?.trim() &&
    cell.street_number?.trim() &&
    cell.neighborhood.trim() &&
    cell.city?.trim() &&
    cell.state?.trim(),
  );
}

function buildDisplayAddress(cell: Cell) {
  const streetLine = [cell.street?.trim(), cell.street_number?.trim()].filter(Boolean).join(", ");

  const cityState = [cell.city?.trim(), cell.state?.trim().toUpperCase()]
    .filter(Boolean)
    .join(" - ");

  return [
    streetLine,
    cell.address_complement?.trim(),
    cityState,
    normalizePostalCode(cell.postal_code),
  ]
    .filter(Boolean)
    .join(", ");
}

function buildGeocodeAddress(cell: Cell) {
  return [
    [cell.street?.trim(), cell.street_number?.trim()].filter(Boolean).join(", "),
    cell.address_complement?.trim(),
    cell.neighborhood.trim(),
    cell.city?.trim(),
    cell.state?.trim().toUpperCase(),
    normalizePostalCode(cell.postal_code) ? `CEP ${normalizePostalCode(cell.postal_code)}` : null,
    "Brasil",
  ]
    .filter(Boolean)
    .join(", ");
}

const CELL_FORM_DRAFT_VERSION = 2;

function getDraftStorageKey(cellId?: string) {
  return `iacelulas:cell-form-draft:v${CELL_FORM_DRAFT_VERSION}:${cellId ?? "new"}`;
}

function readFormDraft(key: string): Partial<Cell> | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.sessionStorage.getItem(key);

    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<Cell>;

    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function saveFormDraft(key: string, form: Cell) {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.setItem(key, JSON.stringify(form));
  } catch {
    // Storage não deve impedir o cadastro.
  }
}

function clearFormDraft(key: string) {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // Storage não deve impedir a navegação.
  }
}

function buildInitialForm(initial?: Partial<Cell>): Cell {
  const base: Cell = {
    name: "",
    network_id: "decolar",
    gender: "mista",

    address: "",
    street: "",
    street_number: "",
    address_complement: "",
    neighborhood: "",
    city: "Recife",
    state: "PE",
    postal_code: "",

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
  };

  const draft = readFormDraft(getDraftStorageKey(initial?.id));

  if (!draft) return base;

  return {
    ...base,
    ...draft,
    id: base.id,
  };
}

export function CellForm({ initial, onDone }: { initial?: Partial<Cell>; onDone: () => void }) {
  const qc = useQueryClient();

  const geocodeFn = useServerFn(geocodeAddress);
  const reverseGeocodeFn = useServerFn(reverseGeocodeCoordinates);

  const draftStorageKey = getDraftStorageKey(initial?.id);

  const [form, setForm] = useState<Cell>(() => buildInitialForm(initial));

  const [saving, setSaving] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [reverseGeocoding, setReverseGeocoding] = useState(false);

  const lastReverseGeocodedKey = useRef<string | null>(null);

  const manualCoordinateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: networks } = useQuery({
    queryKey: ["networks"],
    queryFn: async () => {
      const { data, error } = await supabase.from("networks").select("*").order("sort_order");

      if (error) throw error;

      return data;
    },
  });

  const update = (patch: Partial<Cell>) =>
    setForm((current) => ({
      ...current,
      ...patch,
    }));

  const legacyAddressMode = Boolean(
    form.id && form.address.trim() && !hasAnyStructuredAddress(form),
  );

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
      const result = await reverseGeocodeFn({
        data: {
          latitude,
          longitude,
        },
      });

      if (!result.ok) {
        if (!options?.silent) {
          toast.error(result.error);
        }
        return;
      }

      const patch: Partial<Cell> = {
        street: trimOrNull(result.street) ?? form.street,
        street_number: trimOrNull(result.streetNumber) ?? form.street_number,
        neighborhood: trimOrNull(result.neighborhood) ?? form.neighborhood,
        city: trimOrNull(result.city) ?? form.city,
        state: trimOrNull(result.state)?.toUpperCase() ?? form.state,
        postal_code: normalizePostalCode(result.postalCode) ?? form.postal_code,
      };

      const next = {
        ...form,
        ...patch,
        latitude,
        longitude,
      };

      patch.address = hasCompleteStructuredAddress(next)
        ? buildDisplayAddress(next)
        : result.address;

      update(patch);

      if (!options?.silent) {
        toast.success("Localização atualizada pelo mapa.");
      }
    } catch (error) {
      if (!options?.silent) {
        toast.error(getErrorMessage(error, "Erro ao identificar o endereço."));
      }
    } finally {
      setReverseGeocoding(false);
    }
  };

  const updateCoordinates = (
    latitude: number | null,
    longitude: number | null,
    options?: {
      reverseAddress?: boolean;
      debounceReverse?: boolean;
    },
  ) => {
    update({
      latitude,
      longitude,
    });

    if (manualCoordinateTimer.current) {
      clearTimeout(manualCoordinateTimer.current);
      manualCoordinateTimer.current = null;
    }

    if (latitude == null || longitude == null || !options?.reverseAddress) {
      return;
    }

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
    const structured = hasCompleteStructuredAddress(form);

    const address = structured ? buildGeocodeAddress(form) : form.address.trim();

    if (!address) {
      toast.error("Preencha os dados do endereço antes de localizar.");
      return;
    }

    if (!structured && !legacyAddressMode) {
      toast.error("Informe rua, número, bairro, cidade e UF.");
      return;
    }

    setGeocoding(true);

    try {
      const result = await geocodeFn({
        data: { address },
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      const patch: Partial<Cell> = {
        latitude: result.latitude,
        longitude: result.longitude,

        street: trimOrNull(form.street) ?? trimOrNull(result.street),

        street_number: trimOrNull(form.street_number) ?? trimOrNull(result.streetNumber),

        neighborhood: form.neighborhood.trim() || result.neighborhood || "",

        city: trimOrNull(form.city) ?? trimOrNull(result.city),

        state:
          trimOrNull(form.state)?.toUpperCase() ?? trimOrNull(result.state)?.toUpperCase() ?? null,

        postal_code:
          normalizePostalCode(form.postal_code) ?? normalizePostalCode(result.postalCode),
      };

      const next: Cell = {
        ...form,
        ...patch,
      };

      patch.address = hasCompleteStructuredAddress(next)
        ? buildDisplayAddress(next)
        : result.formatted;

      update(patch);

      toast.success("Localização encontrada. Confira o pin no mapa.");
    } catch (error) {
      toast.error(getErrorMessage(error, "Erro ao localizar endereço."));
    } finally {
      setGeocoding(false);
    }
  };

  const save = async () => {
    if (
      !form.name.trim() ||
      !form.neighborhood.trim() ||
      !form.leader_name.trim() ||
      !form.leader_whatsapp.trim()
    ) {
      toast.error("Preencha todos os campos obrigatórios.");
      return;
    }

    const structuredRequired = !form.id || hasAnyStructuredAddress(form);

    if (structuredRequired && !hasCompleteStructuredAddress(form)) {
      toast.error("Complete rua, número, bairro, cidade e UF.");
      return;
    }

    if (!structuredRequired && !form.address.trim()) {
      toast.error("Informe o endereço.");
      return;
    }

    if (
      (form.latitude == null && form.longitude != null) ||
      (form.latitude != null && form.longitude == null)
    ) {
      toast.error("Informe latitude e longitude juntas, ou deixe ambas vazias.");
      return;
    }

    setSaving(true);

    try {
      const payload: Cell = {
        ...form,
      };

      if (hasCompleteStructuredAddress(payload)) {
        payload.address = buildDisplayAddress(payload);
      }

      if (payload.latitude == null || payload.longitude == null) {
        const address = hasCompleteStructuredAddress(payload)
          ? buildGeocodeAddress(payload)
          : payload.address;

        const result = await geocodeFn({
          data: { address },
        });

        if (result.ok) {
          payload.latitude = result.latitude;
          payload.longitude = result.longitude;

          payload.street = trimOrNull(payload.street) ?? trimOrNull(result.street);

          payload.street_number =
            trimOrNull(payload.street_number) ?? trimOrNull(result.streetNumber);

          payload.city = trimOrNull(payload.city) ?? trimOrNull(result.city);

          payload.state =
            trimOrNull(payload.state)?.toUpperCase() ??
            trimOrNull(result.state)?.toUpperCase() ??
            null;

          payload.postal_code =
            normalizePostalCode(payload.postal_code) ?? normalizePostalCode(result.postalCode);

          if (!payload.neighborhood.trim() && result.neighborhood) {
            payload.neighborhood = result.neighborhood;
          }

          if (hasCompleteStructuredAddress(payload)) {
            payload.address = buildDisplayAddress(payload);
          }
        }
      }

      const row = {
        name: payload.name.trim(),
        network_id: payload.network_id,
        gender: payload.gender,

        address: payload.address.trim(),
        street: trimOrNull(payload.street),
        street_number: trimOrNull(payload.street_number),
        address_complement: trimOrNull(payload.address_complement),
        neighborhood: payload.neighborhood.trim(),
        city: trimOrNull(payload.city),
        state: trimOrNull(payload.state)?.toUpperCase() ?? null,
        postal_code: normalizePostalCode(payload.postal_code),

        latitude: payload.latitude,
        longitude: payload.longitude,

        leader_name: payload.leader_name.trim(),
        leader_whatsapp: payload.leader_whatsapp.replace(/\D/g, ""),
        leader_instagram: trimOrNull(payload.leader_instagram),
        leader2_name: trimOrNull(payload.leader2_name),
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

      toast.success(
        payload.id ? "Célula atualizada com sucesso." : "Célula cadastrada com sucesso.",
      );

      await Promise.all([
        qc.invalidateQueries({
          queryKey: ["admin-cells"],
        }),
        qc.invalidateQueries({
          queryKey: ["dashboard-cells"],
        }),
      ]);

      finishAndClearDraft();
    } catch (error) {
      toast.error(getErrorMessage(error, "Erro ao salvar a célula."));
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    return () => {
      if (manualCoordinateTimer.current) {
        clearTimeout(manualCoordinateTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    saveFormDraft(draftStorageKey, form);
  }, [draftStorageKey, form]);

  const finishAndClearDraft = () => {
    clearFormDraft(draftStorageKey);
    onDone();
  };

  useEffect(() => {
    if (form.network_id === "decolar" && form.gender !== "mista") {
      update({ gender: "mista" });
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.network_id]);

  return (
    <div className="space-y-6">
      <FormSection
        number="01"
        icon={<Building2 className="size-5" />}
        title="Identificação"
        description="Informações principais para reconhecer e classificar a célula."
      >
        <Row>
          <Field label="Nome da célula *">
            <Input
              value={form.name}
              onChange={(event) =>
                update({
                  name: event.target.value,
                })
              }
              placeholder="Ex.: Nova Estação"
            />
          </Field>

          <Field label="Rede *">
            <Select
              value={form.network_id}
              onValueChange={(value) =>
                update({
                  network_id: value,
                })
              }
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

        <Field
          label="Tipo de célula *"
          hint={
            form.network_id === "decolar"
              ? "A Rede Decolar é sempre classificada como mista."
              : undefined
          }
        >
          <Select
            value={form.gender}
            onValueChange={(value) =>
              update({
                gender: value as Cell["gender"],
              })
            }
            disabled={form.network_id === "decolar"}
          >
            <SelectTrigger className="md:max-w-md">
              <SelectValue />
            </SelectTrigger>

            <SelectContent>
              <SelectItem value="masculina">Masculina</SelectItem>

              <SelectItem value="feminina">Feminina</SelectItem>

              <SelectItem value="mista">Mista</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </FormSection>

      <FormSection
        number="02"
        icon={<MapPin className="size-5" />}
        title="Localização"
        description="Endereço estruturado e posição geográfica utilizada nas recomendações."
      >
        {legacyAddressMode && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
            <p className="font-semibold">Endereço em formato legado</p>

            <p className="mt-1 leading-6 text-amber-800">
              Esta célula foi cadastrada antes da padronização dos endereços. O dado existente foi
              preservado:
            </p>

            <p className="mt-2 font-medium">{form.address}</p>

            <p className="mt-2 text-xs leading-5 text-amber-700">
              Você pode salvar outras alterações sem converter o endereço. Para padronizá-lo,
              preencha os campos abaixo e clique em Localizar no mapa.
            </p>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_180px]">
          <Field label="Rua / Avenida *">
            <Input
              value={form.street ?? ""}
              onChange={(event) =>
                update({
                  street: event.target.value,
                  latitude: null,
                  longitude: null,
                })
              }
              placeholder="Ex.: Rua da Harmonia"
            />
          </Field>

          <Field label="Número *">
            <Input
              value={form.street_number ?? ""}
              onChange={(event) =>
                update({
                  street_number: event.target.value,
                  latitude: null,
                  longitude: null,
                })
              }
              placeholder="Ex.: 175 ou S/N"
            />
          </Field>
        </div>

        <Field label="Complemento (opcional)">
          <Input
            value={form.address_complement ?? ""}
            onChange={(event) =>
              update({
                address_complement: event.target.value,
                latitude: null,
                longitude: null,
              })
            }
            placeholder="Apartamento, bloco, casa, ponto de referência..."
          />
        </Field>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Bairro *">
            <Input
              value={form.neighborhood}
              onChange={(event) =>
                update({
                  neighborhood: event.target.value,
                  latitude: null,
                  longitude: null,
                })
              }
              placeholder="Ex.: Casa Amarela"
            />
          </Field>

          <Field label="Cidade *">
            <Input
              value={form.city ?? ""}
              onChange={(event) =>
                update({
                  city: event.target.value,
                  latitude: null,
                  longitude: null,
                })
              }
              placeholder="Ex.: Recife"
            />
          </Field>
        </div>

        <div className="grid gap-4 md:grid-cols-[180px_220px_minmax(0,1fr)]">
          <Field label="UF *">
            <Select
              value={form.state || "PE"}
              onValueChange={(value) =>
                update({
                  state: value,
                  latitude: null,
                  longitude: null,
                })
              }
            >
              <SelectTrigger>
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

          <Field label="CEP (opcional)">
            <Input
              inputMode="numeric"
              value={normalizePostalCode(form.postal_code) ?? ""}
              onChange={(event) =>
                update({
                  postal_code: normalizePostalCode(event.target.value),
                  latitude: null,
                  longitude: null,
                })
              }
              placeholder="00000-000"
            />
          </Field>

          <div className="flex items-end">
            <Button type="button" className="w-full" onClick={handleGeocode} disabled={geocoding}>
              <LocateFixed className="mr-2 size-4" />

              {geocoding ? "Localizando..." : "Localizar no mapa"}
            </Button>
          </div>
        </div>

        <div className="rounded-2xl border bg-muted/20 p-4 md:p-5">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="font-semibold">Posição geográfica</p>

              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                O sistema utiliza estas coordenadas para calcular proximidade. Depois de localizar,
                ajuste o pin se necessário.
              </p>
            </div>

            {(form.latitude != null || form.longitude != null) && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => updateCoordinates(null, null)}
              >
                Limpar coordenadas
              </Button>
            )}
          </div>

          <Row>
            <Field label="Latitude">
              <Input
                inputMode="decimal"
                value={formatCoordinate(form.latitude)}
                onChange={(event) => updateLatitudeFromInput(event.target.value)}
                placeholder="-8.087859"
              />
            </Field>

            <Field label="Longitude">
              <Input
                inputMode="decimal"
                value={formatCoordinate(form.longitude)}
                onChange={(event) => updateLongitudeFromInput(event.target.value)}
                placeholder="-34.894807"
              />
            </Field>
          </Row>

          <div className="mt-4">
            {form.latitude != null && form.longitude != null ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>
                    📍 {form.latitude.toFixed(6)}, {form.longitude.toFixed(6)}
                  </span>

                  {reverseGeocoding && <span>Atualizando endereço pelo pin...</span>}
                </div>

                <CoordinatePickerMap
                  latitude={form.latitude}
                  longitude={form.longitude}
                  onChange={(latitude, longitude) =>
                    updateCoordinates(latitude, longitude, {
                      reverseAddress: true,
                    })
                  }
                />
              </div>
            ) : (
              <div className="flex min-h-40 items-center justify-center rounded-xl border border-dashed bg-background p-6 text-center text-sm leading-6 text-muted-foreground">
                Preencha o endereço e clique em “Localizar no mapa” para gerar o ponto geográfico.
              </div>
            )}
          </div>
        </div>
      </FormSection>

      <FormSection
        number="03"
        icon={<CalendarClock className="size-5" />}
        title="Reunião"
        description="Dia e horário utilizados para filtrar as células durante o atendimento."
      >
        <Row>
          <Field label="Dia da semana">
            <Select
              value={form.meeting_weekday == null ? "none" : String(form.meeting_weekday)}
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
                update({
                  meeting_time: event.target.value || null,
                })
              }
            />
          </Field>
        </Row>
      </FormSection>

      <FormSection
        number="04"
        icon={<UsersRound className="size-5" />}
        title="Liderança"
        description="Contatos exibidos para a equipe durante o atendimento de células."
      >
        <div className="rounded-xl border bg-muted/20 p-4">
          <p className="mb-4 text-sm font-semibold">Líder principal</p>

          <div className="space-y-4">
            <Field label="Nome do líder *">
              <Input
                value={form.leader_name}
                onChange={(event) =>
                  update({
                    leader_name: event.target.value,
                  })
                }
                placeholder="Nome completo"
              />
            </Field>

            <Row>
              <Field label="WhatsApp *">
                <Input
                  inputMode="tel"
                  value={form.leader_whatsapp}
                  onChange={(event) =>
                    update({
                      leader_whatsapp: event.target.value.replace(/\D/g, ""),
                    })
                  }
                  placeholder="81999999999"
                />
              </Field>

              <Field label="Instagram (opcional)">
                <Input
                  value={form.leader_instagram ?? ""}
                  onChange={(event) =>
                    update({
                      leader_instagram: event.target.value,
                    })
                  }
                  placeholder="@celula"
                />
              </Field>
            </Row>
          </div>
        </div>

        <div className="rounded-xl border bg-muted/20 p-4">
          <p className="mb-1 text-sm font-semibold">Segundo líder</p>

          <p className="mb-4 text-xs text-muted-foreground">
            Opcional. Quando informado, também aparecerá na ficha de atendimento.
          </p>

          <Row>
            <Field label="Nome">
              <Input
                value={form.leader2_name ?? ""}
                onChange={(event) =>
                  update({
                    leader2_name: event.target.value || null,
                  })
                }
                placeholder="Nome completo"
              />
            </Field>

            <Field label="WhatsApp">
              <Input
                inputMode="tel"
                value={form.leader2_whatsapp ?? ""}
                onChange={(event) =>
                  update({
                    leader2_whatsapp: event.target.value.replace(/\D/g, "") || null,
                  })
                }
                placeholder="81999999999"
              />
            </Field>
          </Row>
        </div>
      </FormSection>

      <FormSection
        number="05"
        icon={<BadgeCheck className="size-5" />}
        title="Status"
        description="Defina se esta célula pode participar das recomendações."
      >
        <div
          className={`flex flex-col gap-4 rounded-2xl border p-5 sm:flex-row sm:items-center sm:justify-between ${
            form.is_active ? "border-emerald-200 bg-emerald-50/70" : "bg-muted/30"
          }`}
        >
          <div>
            <p className={`font-semibold ${form.is_active ? "text-emerald-800" : ""}`}>
              {form.is_active ? "Célula ativa" : "Célula inativa"}
            </p>

            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {form.is_active
                ? "Disponível nas buscas realizadas por membros autenticados."
                : "Não será considerada nas recomendações enquanto estiver inativa."}
            </p>
          </div>

          <Switch
            checked={form.is_active}
            onCheckedChange={(value) =>
              update({
                is_active: value,
              })
            }
            aria-label="Status da célula"
          />
        </div>
      </FormSection>

      <Card className="sticky bottom-4 z-20 border-border/70 bg-background/95 p-4 shadow-xl backdrop-blur">
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
          <Button type="button" variant="outline" onClick={finishAndClearDraft} disabled={saving}>
            Cancelar
          </Button>

          <Button type="button" onClick={save} disabled={saving}>
            <Save className="mr-2 size-4" />

            {saving ? "Salvando..." : form.id ? "Salvar alterações" : "Cadastrar célula"}
          </Button>
        </div>
      </Card>
    </div>
  );
}

function FormSection({
  number,
  icon,
  title,
  description,
  children,
}: {
  number: string;
  icon: ReactNode;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Card className="overflow-hidden border-border/60 shadow-sm">
      <div className="border-b bg-muted/15 px-5 py-5 md:px-6">
        <div className="flex items-start gap-4">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            {icon}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-primary">
                {number}
              </span>

              <h2 className="text-lg font-bold tracking-tight">{title}</h2>
            </div>

            <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
          </div>
        </div>
      </div>

      <div className="space-y-5 p-5 md:p-6">{children}</div>
    </Card>
  );
}

function Row({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 md:grid-cols-2">{children}</div>;
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>

      {children}

      {hint && <p className="text-xs leading-5 text-muted-foreground">{hint}</p>}
    </div>
  );
}
