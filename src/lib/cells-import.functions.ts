import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const RowSchema = z.object({
  name: z.string().min(1).max(200),
  network_id: z.string().min(1).max(50),
  gender: z.enum(["masculina", "feminina", "mista"]),
  address: z.string().min(3).max(500),
  neighborhood: z.string().min(1).max(200),
  leader_name: z.string().min(1).max(200),
  leader_whatsapp: z.string().min(5).max(30),
  leader_instagram: z.string().max(100).optional().nullable(),
  leader2_name: z.string().max(200).optional().nullable(),
  leader2_whatsapp: z.string().max(30).optional().nullable(),
  meeting_weekday: z.number().int().min(0).max(6).nullable().optional(),
  meeting_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).nullable().optional(),
  is_active: z.boolean().optional(),
});

const Input = z.object({
  rows: z.array(RowSchema).min(1).max(500),
  geocode: z.boolean().default(true),
});

type GeoapifyFeature = {
  properties?: {
    lat?: number;
    lon?: number;
  };
  geometry?: {
    coordinates?: [number, number];
  };
};

type GeoapifyResponse = {
  features?: GeoapifyFeature[];
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function geocodeOne(address: string, apiKey: string) {
  try {
    const url = new URL("https://api.geoapify.com/v1/geocode/search");
    url.searchParams.set("text", address);
    url.searchParams.set("lang", "pt");
    url.searchParams.set("filter", "countrycode:br");
    url.searchParams.set("limit", "1");
    url.searchParams.set("apiKey", apiKey);

    const res = await fetch(url.toString());
    if (!res.ok) return null;

    const json = (await res.json()) as GeoapifyResponse;
    const feature = json.features?.[0];
    if (!feature) return null;

    const lon = feature.properties?.lon ?? feature.geometry?.coordinates?.[0];
    const lat = feature.properties?.lat ?? feature.geometry?.coordinates?.[1];

    if (typeof lat !== "number" || typeof lon !== "number") return null;

    return { lat, lng: lon };
  } catch {
    return null;
  }
}

export const importCells = createServerFn({ method: "POST" })
  .inputValidator((data) => Input.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: networks } = await supabaseAdmin.from("networks").select("id");
    const validNetworks = new Set((networks ?? []).map((network) => network.id));

    const geoapifyKey = process.env.GEOAPIFY_API_KEY ?? "";
    const canGeocode = data.geocode && !!geoapifyKey;

    const inserts: any[] = [];
    const errors: Array<{ line: number; error: string }> = [];

    for (let index = 0; index < data.rows.length; index++) {
      const row = data.rows[index];

      if (!validNetworks.has(row.network_id)) {
        errors.push({ line: index + 2, error: `Rede inválida: ${row.network_id}` });
        continue;
      }

      let lat: number | null = null;
      let lng: number | null = null;

      if (canGeocode) {
        const geocoded = await geocodeOne(row.address, geoapifyKey);
        if (geocoded) {
          lat = geocoded.lat;
          lng = geocoded.lng;
        }

        // Pequeno intervalo para evitar excesso de requisições em importações grandes.
        if (index < data.rows.length - 1) await sleep(120);
      }

      inserts.push({
        name: row.name,
        network_id: row.network_id,
        gender: row.gender,
        address: row.address,
        neighborhood: row.neighborhood,
        latitude: lat,
        longitude: lng,
        leader_name: row.leader_name,
        leader_whatsapp: row.leader_whatsapp.replace(/\D/g, ""),
        leader_instagram: row.leader_instagram?.replace(/^@/, "") || null,
        leader2_name: row.leader2_name || null,
        leader2_whatsapp: row.leader2_whatsapp?.replace(/\D/g, "") || null,
        meeting_weekday: row.meeting_weekday ?? null,
        meeting_time: row.meeting_time ?? null,
        is_active: row.is_active !== false,
      });
    }

    if (inserts.length === 0) {
      return { ok: false as const, imported: 0, errors };
    }

    const { error, count } = await supabaseAdmin.from("cells").insert(inserts, { count: "exact" });

    if (error) {
      return { ok: false as const, imported: 0, errors: [{ line: 0, error: error.message }] };
    }

    return { ok: true as const, imported: count ?? inserts.length, errors };
  });
