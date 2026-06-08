import { useEffect, useRef, useState } from "react";
import { NETWORK_HEX, type NetworkId } from "@/lib/networks";

type MapCell = {
  id: string;
  lat: number;
  lng: number;
  name: string;
  network_id: string;
};

type LeafletModule = typeof import("leaflet");

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function numberedMarkerIcon(L: LeafletModule, index: number, color: string) {
  return L.divIcon({
    className: "",
    html: `<div style="width:28px;height:28px;border-radius:9999px;background:${color};color:#fff;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.25);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;">${index}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14],
  });
}

function userMarkerIcon(L: LeafletModule) {
  return L.divIcon({
    className: "",
    html: `<div style="width:18px;height:18px;border-radius:9999px;background:#111827;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35);"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    popupAnchor: [0, -9],
  });
}

export function CellMap({
  visitor,
  cells,
  className,
}: {
  visitor: { lat: number; lng: number };
  cells: Array<MapCell>;
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
          center: [visitor.lat, visitor.lng],
          zoom: 13,
          scrollWheelZoom: true,
          zoomControl: true,
        });

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>',
        }).addTo(map);

        const bounds = L.latLngBounds([L.latLng(visitor.lat, visitor.lng)]);

        L.marker([visitor.lat, visitor.lng], {
          icon: userMarkerIcon(L),
          title: "Seu endereço",
        })
          .addTo(map)
          .bindPopup("Seu endereço");

        cells.forEach((cell, index) => {
          const color = NETWORK_HEX[cell.network_id as NetworkId] || "#111827";

          L.marker([cell.lat, cell.lng], {
            icon: numberedMarkerIcon(L, index + 1, color),
            title: `${index + 1}. ${cell.name}`,
          })
            .addTo(map!)
            .bindPopup(`<strong>${index + 1}. ${escapeHtml(cell.name)}</strong>`);

          bounds.extend([cell.lat, cell.lng]);
        });

        if (cells.length > 0) {
          map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
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
  }, [visitor.lat, visitor.lng, cells.map((cell) => cell.id).join(",")]);

  if (error) {
    return (
      <div className={`flex items-center justify-center rounded-xl border border-dashed bg-muted/40 p-6 text-sm text-muted-foreground ${className ?? ""}`}>
        {error}
      </div>
    );
  }

  return <div ref={ref} className={`rounded-xl border bg-muted overflow-hidden ${className ?? ""}`} />;
}
