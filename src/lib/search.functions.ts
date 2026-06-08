import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({
  address: z.string().min(3).max(500),
  neighborhood: z.string().min(1).max(200),
  age: z.number().int().min(0).max(120),
  gender: z.enum(["masculino", "feminino"]),
  marital: z.enum(["solteiro", "casado", "outro"]),
  spouseConverted: z.boolean().optional(),
  weekday: z.number().int().min(0).max(6).nullable().optional(),
});

type CellRow = {
  id: string;
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

type GeoapifyFeature = {
  properties?: {
    formatted?: string;
    lat?: number;
    lon?: number;
  };
  geometry?: {
    coordinates?: [number, number];
  };
};

type GeoapifyResponse = {
  features?: GeoapifyFeature[];
  error?: string;
  message?: string;
};

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function networkForAge(age: number): string {
  if (age <= 11) return "decolar";
  if (age <= 18) return "start";
  if (age <= 25) return "connect";
  return "connect_up";
}

async function geocodeAddressWithGeoapify(address: string) {
  const apiKey = process.env.GEOAPIFY_API_KEY;

  if (!apiKey) {
    return { ok: false as const, error: "GEOAPIFY_API_KEY não configurada." };
  }

  const url = new URL("https://api.geoapify.com/v1/geocode/search");
  url.searchParams.set("text", address);
  url.searchParams.set("lang", "pt");
  url.searchParams.set("filter", "countrycode:br");
  url.searchParams.set("limit", "1");
  url.searchParams.set("apiKey", apiKey);

  const res = await fetch(url.toString());

  if (!res.ok) {
    return { ok: false as const, error: `Erro Geoapify/geocoding: ${res.status}` };
  }

  const json = (await res.json()) as GeoapifyResponse;
  const feature = json.features?.[0];

  if (!feature) {
    return {
      ok: false as const,
      error: "Não conseguimos localizar seu endereço. Verifique e tente novamente.",
    };
  }

  const lon = feature.properties?.lon ?? feature.geometry?.coordinates?.[0];
  const lat = feature.properties?.lat ?? feature.geometry?.coordinates?.[1];

  if (typeof lat !== "number" || typeof lon !== "number") {
    return {
      ok: false as const,
      error: "Endereço localizado, mas sem coordenadas válidas.",
    };
  }

  return {
    ok: true as const,
    lat,
    lng: lon,
    formatted: feature.properties?.formatted ?? address,
  };
}

export const searchCells = createServerFn({ method: "POST" })
  .inputValidator((data) => Input.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const geocoded = await geocodeAddressWithGeoapify(data.address);

    if (!geocoded.ok) {
      return { ok: false as const, error: geocoded.error };
    }

    const visitorLoc = { lat: geocoded.lat, lng: geocoded.lng };
    const visitorFormatted = geocoded.formatted;

    const [{ data: cellsData, error }, { data: adjData }] = await Promise.all([
      supabaseAdmin.from("cells").select("*").eq("is_active", true),
      supabaseAdmin.from("neighborhood_adjacencies").select("neighborhood_a,neighborhood_b"),
    ]);

    if (error) return { ok: false as const, error: error.message };

    const cells = (cellsData ?? []) as CellRow[];
    const normalize = (value: string) => value.trim().toLowerCase();
    const visitorNeighborhood = normalize(data.neighborhood);
    const adjacentNeighborhoods = new Set<string>();

    for (const adjacency of adjData ?? []) {
      if (adjacency.neighborhood_a === visitorNeighborhood) adjacentNeighborhoods.add(adjacency.neighborhood_b);
      if (adjacency.neighborhood_b === visitorNeighborhood) adjacentNeighborhoods.add(adjacency.neighborhood_a);
    }

    const isMarriedConvertedSpouse = data.marital === "casado" && data.spouseConverted === true;
    const idealNetwork = isMarriedConvertedSpouse ? "amor_a2" : networkForAge(data.age);

    const genderMatch = (cell: CellRow) => {
      if (cell.network_id === "decolar") return true;
      if (cell.gender === "mista") return true;
      if (data.gender === "masculino") return cell.gender === "masculina";
      return cell.gender === "feminina";
    };

    const allowedNetworks = new Set([idealNetwork, "acelere", "impulse"]);
    if (isMarriedConvertedSpouse) allowedNetworks.add("amor_a2");

    const weekdayFilter = data.weekday ?? null;
    const candidates = cells.filter(
      (cell) =>
        allowedNetworks.has(cell.network_id) &&
        genderMatch(cell) &&
        (weekdayFilter == null || cell.meeting_weekday === weekdayFilter),
    );

    const scored = candidates.map((cell) => {
      const cellNeighborhood = normalize(cell.neighborhood);
      let score = 0;

      if (cellNeighborhood === visitorNeighborhood) score += 10;
      else if (adjacentNeighborhoods.has(cellNeighborhood)) score += 7;
      else if (cell.latitude != null && cell.longitude != null) {
        const km = haversineKm(visitorLoc, { lat: cell.latitude, lng: cell.longitude });
        if (km <= 3) score += 5;
      }

      if (cell.network_id === idealNetwork) score += 3;
      if (isMarriedConvertedSpouse && cell.network_id === "amor_a2") score += 2;
      if (!isMarriedConvertedSpouse && cell.network_id !== "amor_a2") score += 2;

      const distanceKm =
        cell.latitude != null && cell.longitude != null
          ? haversineKm(visitorLoc, { lat: cell.latitude, lng: cell.longitude })
          : null;

      return { ...cell, score, distanceKm };
    });

    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const distanceA = a.distanceKm ?? Infinity;
      const distanceB = b.distanceKm ?? Infinity;
      return distanceA - distanceB;
    });

    return {
      ok: true as const,
      visitor: { ...visitorLoc, formatted: visitorFormatted },
      idealNetwork,
      results: scored.slice(0, 3),
    };
  });
