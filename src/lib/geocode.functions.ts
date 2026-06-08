import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const AddressInputSchema = z.object({ address: z.string().min(3).max(500) });
const ReverseInputSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

const GEOAPIFY_FORWARD_GEOCODE_URL =
  "https://api.geoapify.com/v1/geocode/search";
const GEOAPIFY_REVERSE_GEOCODE_URL =
  "https://api.geoapify.com/v1/geocode/reverse";

type GeoapifyFeature = {
  properties?: {
    formatted?: string;
    lat?: number;
    lon?: number;
    housenumber?: string;
    street?: string;
    suburb?: string;
    district?: string;
    neighbourhood?: string;
    city_district?: string;
    city?: string;
    municipality?: string;
    county?: string;
    state?: string;
    state_code?: string;
    country_code?: string;
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

const BRAZIL_STATE_NAME_TO_CODE: Record<string, string> = {
  acre: "AC",
  alagoas: "AL",
  amapá: "AP",
  amapa: "AP",
  amazonas: "AM",
  bahia: "BA",
  ceará: "CE",
  ceara: "CE",
  "distrito federal": "DF",
  "espírito santo": "ES",
  "espirito santo": "ES",
  goiás: "GO",
  goias: "GO",
  maranhão: "MA",
  maranhao: "MA",
  "mato grosso": "MT",
  "mato grosso do sul": "MS",
  "minas gerais": "MG",
  pará: "PA",
  para: "PA",
  paraíba: "PB",
  paraiba: "PB",
  paraná: "PR",
  parana: "PR",
  pernambuco: "PE",
  piauí: "PI",
  piaui: "PI",
  "rio de janeiro": "RJ",
  "rio grande do norte": "RN",
  "rio grande do sul": "RS",
  rondônia: "RO",
  rondonia: "RO",
  roraima: "RR",
  "santa catarina": "SC",
  "são paulo": "SP",
  "sao paulo": "SP",
  sergipe: "SE",
  tocantins: "TO",
};

const BRAZIL_REGION_NAMES = new Set([
  "norte",
  "nordeste",
  "centro-oeste",
  "centro oeste",
  "sudeste",
  "sul",
]);

// Fallback útil para a região metropolitana usada no projeto, caso o provedor
// retorne apenas a região geográfica em `state` (ex.: "Nordeste") em vez do UF.
const KNOWN_CITY_STATE_CODE: Record<string, string> = {
  recife: "PE",
  olinda: "PE",
  paulista: "PE",
  "jaboatão dos guararapes": "PE",
  "jaboatao dos guararapes": "PE",
  camaragibe: "PE",
  "são lourenço da mata": "PE",
  "sao lourenco da mata": "PE",
  abreu: "PE",
  "abreu e lima": "PE",
  igarassu: "PE",
};

function normalizeText(value?: string | null) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function getGeoapifyKey() {
  const apiKey = process.env.GEOAPIFY_API_KEY;

  if (!apiKey) {
    throw new Error("GEOAPIFY_API_KEY não configurada.");
  }

  return apiKey;
}

function extractNeighborhood(properties: GeoapifyFeature["properties"]) {
  if (!properties) return null;

  return (
    properties.suburb ||
    properties.neighbourhood ||
    properties.city_district ||
    properties.district ||
    properties.municipality ||
    properties.county ||
    null
  );
}

function extractCity(properties: GeoapifyFeature["properties"]) {
  if (!properties) return null;
  return properties.city || properties.municipality || properties.county || null;
}

function extractStateCode(properties: GeoapifyFeature["properties"]) {
  if (!properties) return null;

  const rawStateCode = properties.state_code?.trim().toUpperCase();
  if (rawStateCode && /^[A-Z]{2}$/.test(rawStateCode)) return rawStateCode;

  const rawState = properties.state?.trim();
  const normalizedState = normalizeText(rawState);

  // Alguns retornos do Geoapify podem trazer "Nordeste" em `state`.
  // Isso é região, não UF; nesse caso ignoramos para não gravar endereço errado.
  if (rawState && !BRAZIL_REGION_NAMES.has(normalizedState)) {
    const byStateName = BRAZIL_STATE_NAME_TO_CODE[normalizedState];
    if (byStateName) return byStateName;
  }

  const formatted = normalizeText(properties.formatted);
  for (const [stateName, code] of Object.entries(BRAZIL_STATE_NAME_TO_CODE)) {
    if (formatted.includes(stateName)) return code;
  }

  const city = extractCity(properties);
  const byCity = KNOWN_CITY_STATE_CODE[normalizeText(city)];
  if (byCity) return byCity;

  return null;
}

function extractShortAddress(
  properties: GeoapifyFeature["properties"],
  fallback: string,
) {
  if (!properties) return fallback;

  const streetParts = [properties.street, properties.housenumber]
    .filter(Boolean)
    .join(", ");

  const city = extractCity(properties);
  const stateCode = extractStateCode(properties);

  const cityState = [city, stateCode].filter(Boolean).join(", ");

  if (streetParts && cityState) return `${streetParts}, ${cityState}`;
  if (streetParts && city) return `${streetParts}, ${city}`;
  if (streetParts) return streetParts;

  if (cityState) return cityState;

  // Último fallback: usa o formatted bruto, mas remove o problema mais comum
  // de vir a região "Nordeste" como se fosse estado.
  const formatted = properties.formatted ?? fallback;
  if (stateCode) {
    return formatted
      .replace(/,\s*Nordeste(?=,|$)/gi, `, ${stateCode}`)
      .replace(/\s+-\s+Nordeste(?=,|$)/gi, `, ${stateCode}`);
  }

  return formatted;
}

async function geocode(address: string) {
  const apiKey = getGeoapifyKey();

  const url = new URL(GEOAPIFY_FORWARD_GEOCODE_URL);
  url.searchParams.set("text", address);
  url.searchParams.set("lang", "pt");
  url.searchParams.set("filter", "countrycode:br");
  url.searchParams.set("limit", "1");
  url.searchParams.set("apiKey", apiKey);

  const res = await fetch(url.toString());

  if (!res.ok) {
    throw new Error(`Erro Geoapify/geocoding: ${res.status}`);
  }

  const json = (await res.json()) as GeoapifyResponse;
  const feature = json.features?.[0];

  if (!feature) {
    return {
      ok: false as const,
      error: json.message || json.error || "Endereço não encontrado",
    };
  }

  const lon = feature.properties?.lon ?? feature.geometry?.coordinates?.[0];
  const lat = feature.properties?.lat ?? feature.geometry?.coordinates?.[1];

  if (typeof lat !== "number" || typeof lon !== "number") {
    return {
      ok: false as const,
      error: "Endereço encontrado, mas sem coordenadas válidas.",
    };
  }

  const properties = feature.properties;

  return {
    ok: true as const,
    latitude: lat,
    longitude: lon,
    formatted: extractShortAddress(properties, properties?.formatted ?? address),
  };
}

async function reverseGeocode(latitude: number, longitude: number) {
  const apiKey = getGeoapifyKey();

  const url = new URL(GEOAPIFY_REVERSE_GEOCODE_URL);
  url.searchParams.set("lat", String(latitude));
  url.searchParams.set("lon", String(longitude));
  url.searchParams.set("lang", "pt");
  url.searchParams.set("apiKey", apiKey);

  const res = await fetch(url.toString());

  if (!res.ok) {
    throw new Error(`Erro Geoapify/reverse geocoding: ${res.status}`);
  }

  const json = (await res.json()) as GeoapifyResponse;
  const feature = json.features?.[0];

  if (!feature) {
    return {
      ok: false as const,
      error:
        json.message ||
        json.error ||
        "Não foi possível identificar o endereço desse ponto.",
    };
  }

  const properties = feature.properties;

  return {
    ok: true as const,
    address: extractShortAddress(
      properties,
      properties?.formatted ?? `${latitude}, ${longitude}`,
    ),
    formatted: properties?.formatted ?? null,
    neighborhood: extractNeighborhood(properties),
  };
}

export const geocodeAddress = createServerFn({ method: "POST" })
  .inputValidator((data) => AddressInputSchema.parse(data))
  .handler(async ({ data }) => geocode(data.address));

export const reverseGeocodeCoordinates = createServerFn({ method: "POST" })
  .inputValidator((data) => ReverseInputSchema.parse(data))
  .handler(async ({ data }) => reverseGeocode(data.latitude, data.longitude));

export { geocode as _geocode, reverseGeocode as _reverseGeocode };
