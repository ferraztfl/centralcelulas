import { useEffect, useRef, useState } from "react";
import { NETWORK_HEX, type NetworkId } from "@/lib/networks";

type DashboardCell = {
  id: string;
  lat: number;
  lng: number;
  name: string;
  network_id: string;
  network_name?: string | null;
  gender?: string | null;
  address?: string | null;
  neighborhood?: string | null;
  leader_name?: string | null;
  leader_whatsapp?: string | null;
  leader2_name?: string | null;
  leader2_whatsapp?: string | null;
  meeting_weekday?: number | null;
  meeting_time?: string | null;
};

type LeafletModule = typeof import("leaflet");

const WEEKDAYS: Record<number, string> = {
  0: "Domingo",
  1: "Segunda-feira",
  2: "Terça-feira",
  3: "Quarta-feira",
  4: "Quinta-feira",
  5: "Sexta-feira",
  6: "Sábado",
};

function formatWeekday(day?: number | null) {
  if (day === null || day === undefined) return "Não informado";
  return WEEKDAYS[day] ?? "Não informado";
}

function formatTime(time?: string | null) {
  if (!time) return "Não informado";
  return String(time).slice(0, 5);
}

function formatGender(gender?: string | null) {
  if (!gender) return "Não informado";
  const normalized = gender.toLowerCase();
  if (normalized === "masculina") return "Masculina";
  if (normalized === "feminina") return "Feminina";
  if (normalized === "mista") return "Mista";
  return gender;
}

function onlyNumbers(value?: string | null) {
  return value?.replace(/\D/g, "") ?? "";
}

function formatWhatsapp(value?: string | null) {
  const clean = onlyNumbers(value);
  if (!clean) return "";
  return clean;
}

function escapeHtml(value?: string | null) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function popupLine(label: string, value?: string | null) {
  const safeValue = value?.trim() ? value : "Não informado";
  return `<div><strong>${escapeHtml(label)}:</strong> ${escapeHtml(safeValue)}</div>`;
}

function whatsappLine(label: string, phone?: string | null) {
  const clean = formatWhatsapp(phone);

  if (!clean) {
    return `<div><strong>${escapeHtml(label)}:</strong> Não informado</div>`;
  }

  return `
    <div>
      <strong>${escapeHtml(label)}:</strong>
      <a
        href="https://wa.me/${clean}"
        target="_blank"
        rel="noopener noreferrer"
        style="color:#2563eb;text-decoration:none;font-weight:600;"
      >
        ${escapeHtml(clean)}
      </a>
    </div>
  `;
}

function buildPopupHtml(cell: DashboardCell) {
  const hasSecondLeader = Boolean(cell.leader2_name?.trim() || cell.leader2_whatsapp?.trim());

  return `
    <div style="font-family: Arial, sans-serif; min-width: 240px; max-width: 300px; color:#111827;">
      <div style="font-size:15px;font-weight:800;margin-bottom:8px;line-height:1.25;">
        ${escapeHtml(cell.name)}
      </div>

      <div style="font-size:12px;line-height:1.55;color:#374151;margin-bottom:8px;">
        ${popupLine("Rede", cell.network_name || cell.network_id)}
        ${popupLine("Gênero", formatGender(cell.gender))}
        ${popupLine("Dia", formatWeekday(cell.meeting_weekday))}
        ${popupLine("Horário", formatTime(cell.meeting_time))}
      </div>

      <div style="font-size:12px;line-height:1.55;color:#374151;margin-bottom:8px;padding-top:8px;border-top:1px solid #e5e7eb;">
        ${popupLine("Bairro", cell.neighborhood)}
        ${popupLine("Endereço", cell.address)}
      </div>

      <div style="font-size:12px;line-height:1.55;color:#374151;padding-top:8px;border-top:1px solid #e5e7eb;">
        ${popupLine("Líder", cell.leader_name)}
        ${whatsappLine("WhatsApp", cell.leader_whatsapp)}

        ${
          hasSecondLeader
            ? `
              <div style="margin-top:8px;">
                ${popupLine("Líder 2", cell.leader2_name)}
                ${whatsappLine("WhatsApp líder 2", cell.leader2_whatsapp)}
              </div>
            `
            : ""
        }
      </div>
    </div>
  `;
}

function cellMarkerIcon(L: LeafletModule, color: string) {
  return L.divIcon({
    className: "",
    html: `<div style="width:22px;height:22px;border-radius:9999px;background:${color};border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.25);"></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    popupAnchor: [0, -11],
  });
}

export function DashboardMap({
  cells,
  className,
}: {
  cells: Array<DashboardCell>;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !ref.current) return;

    let cancelled = false;
    let map: import("leaflet").Map | null = null;

    setError(null);

    (async () => {
      try {
        const L = await import("leaflet");
        await import("leaflet/dist/leaflet.css");

        if (cancelled || !ref.current) return;

        map = L.map(ref.current, {
          center: [-8.0476, -34.877],
          zoom: 12,
          scrollWheelZoom: true,
          zoomControl: true,
        });

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>',
        }).addTo(map);

        if (cells.length > 0) {
          const bounds = L.latLngBounds(
            cells.map((cell) => L.latLng(cell.lat, cell.lng)),
          );

          cells.forEach((cell) => {
            const color = NETWORK_HEX[cell.network_id as NetworkId] || "#111827";

            L.marker([cell.lat, cell.lng], {
              icon: cellMarkerIcon(L, color),
              title: cell.name,
            })
              .addTo(map!)
              .bindPopup(buildPopupHtml(cell), {
                maxWidth: 320,
                closeButton: true,
              });
          });

          map.fitBounds(bounds, { padding: [30, 30], maxZoom: 15 });
        }

        window.setTimeout(() => map?.invalidateSize(), 0);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Erro ao carregar o mapa");
      }
    })();

    return () => {
      cancelled = true;
      map?.remove();
      map = null;
    };
  }, [JSON.stringify(cells)]);

  if (error) {
    return (
      <div className={`flex items-center justify-center bg-muted/40 p-6 text-sm text-muted-foreground ${className ?? ""}`}>
        {error}
      </div>
    );
  }

  return <div ref={ref} className={`bg-muted ${className ?? ""}`} />;
}
