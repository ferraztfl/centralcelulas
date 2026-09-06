import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

const NullableText = (max: number) => z.string().trim().max(max).nullable().optional();

const RowSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    network_id: z.string().trim().min(1).max(50),
    gender: z.enum(["masculina", "feminina", "mista"]),

    // Compatibilidade com o CSV antigo
    address: NullableText(500),

    // Endereço estruturado
    street: NullableText(250),
    street_number: NullableText(30),
    address_complement: NullableText(250),
    neighborhood: z.string().trim().min(1).max(200),
    city: NullableText(120),
    state: NullableText(2),
    postal_code: NullableText(9),

    leader_name: z.string().trim().min(1).max(200),
    leader_whatsapp: z.string().trim().min(5).max(30),
    leader_instagram: NullableText(100),
    leader2_name: NullableText(200),
    leader2_whatsapp: NullableText(30),

    meeting_weekday: z.number().int().min(0).max(6).nullable().optional(),

    meeting_time: z
      .string()
      .regex(/^\d{2}:\d{2}(:\d{2})?$/)
      .nullable()
      .optional(),

    is_active: z.boolean().optional(),
  })
  .superRefine((row, context) => {
    const hasLegacyAddress = Boolean(row.address?.trim());

    const hasStructuredAddress = Boolean(
      row.street?.trim() &&
      row.street_number?.trim() &&
      row.neighborhood.trim() &&
      row.city?.trim() &&
      row.state?.trim(),
    );

    if (!hasLegacyAddress && !hasStructuredAddress) {
      context.addIssue({
        code: "custom",
        path: ["address"],
        message: "Informe address ou rua, número, bairro, cidade e UF.",
      });
    }

    if (row.state && !/^[A-Za-z]{2}$/.test(row.state)) {
      context.addIssue({
        code: "custom",
        path: ["state"],
        message: "UF deve possuir exatamente duas letras.",
      });
    }
  });

const Input = z.object({
  rows: z.array(RowSchema).min(1).max(500),
  geocode: z.boolean().default(true),
});

type CellInsert = Database["public"]["Tables"]["cells"]["Insert"];

type ImportRow = z.infer<typeof RowSchema>;

function trimOrNull(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function normalizePostalCode(value?: string | null) {
  if (!value) return null;

  const digits = value.replace(/\D/g, "").slice(0, 8);

  if (digits.length === 8) {
    return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  }

  return digits || null;
}

function hasStructuredAddress(row: ImportRow) {
  return Boolean(
    row.street?.trim() &&
    row.street_number?.trim() &&
    row.neighborhood.trim() &&
    row.city?.trim() &&
    row.state?.trim(),
  );
}

function buildDisplayAddress(row: ImportRow) {
  const streetLine = [row.street?.trim(), row.street_number?.trim()].filter(Boolean).join(", ");

  const cityState = [row.city?.trim(), row.state?.trim().toUpperCase()].filter(Boolean).join(" - ");

  return [
    streetLine,
    row.address_complement?.trim(),
    cityState,
    normalizePostalCode(row.postal_code),
  ]
    .filter(Boolean)
    .join(", ");
}

function buildGeocodeAddress(row: ImportRow) {
  return [
    [row.street?.trim(), row.street_number?.trim()].filter(Boolean).join(", "),
    row.address_complement?.trim(),
    row.neighborhood.trim(),
    row.city?.trim(),
    row.state?.trim().toUpperCase(),
    normalizePostalCode(row.postal_code) ? `CEP ${normalizePostalCode(row.postal_code)}` : null,
    "Brasil",
  ]
    .filter(Boolean)
    .join(", ");
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const importCells = createServerFn({
  method: "POST",
})
  .validator((data) => Input.parse(data))
  .handler(async ({ data }) => {
    const [{ supabaseAdmin }, { requireApprovedAdmin }, { _geocode }] = await Promise.all([
      import("@/integrations/supabase/client.server"),
      import("@/lib/authz.server"),
      import("@/lib/geocode.functions"),
    ]);

    await requireApprovedAdmin();

    const { data: networks } = await supabaseAdmin.from("networks").select("id");

    const validNetworks = new Set((networks ?? []).map((network) => network.id));

    const canGeocode = data.geocode && Boolean(process.env.GEOAPIFY_API_KEY);

    const inserts: CellInsert[] = [];

    const errors: Array<{
      line: number;
      error: string;
    }> = [];

    const warnings: Array<{
      line: number;
      warning: string;
    }> = [];

    for (let index = 0; index < data.rows.length; index++) {
      const row = data.rows[index];
      const line = index + 2;

      if (!validNetworks.has(row.network_id)) {
        errors.push({
          line,
          error: `Rede inválida: ${row.network_id}`,
        });
        continue;
      }

      const structured = hasStructuredAddress(row);

      let address = structured ? buildDisplayAddress(row) : row.address!.trim();

      let street = trimOrNull(row.street);
      let streetNumber = trimOrNull(row.street_number);
      let city = trimOrNull(row.city);

      let state = trimOrNull(row.state)?.toUpperCase() ?? null;

      let postalCode = normalizePostalCode(row.postal_code);

      let neighborhood = row.neighborhood.trim();

      let latitude: number | null = null;
      let longitude: number | null = null;

      if (canGeocode) {
        const geocodeInput = structured ? buildGeocodeAddress(row) : address;

        try {
          const result = await _geocode(geocodeInput);

          if (result.ok) {
            latitude = result.latitude;
            longitude = result.longitude;

            street = street ?? trimOrNull(result.street);

            streetNumber = streetNumber ?? trimOrNull(result.streetNumber);

            city = city ?? trimOrNull(result.city);

            state = state ?? trimOrNull(result.state)?.toUpperCase() ?? null;

            postalCode = postalCode ?? normalizePostalCode(result.postalCode);

            if (!neighborhood && result.neighborhood) {
              neighborhood = result.neighborhood;
            }

            const enrichedRow: ImportRow = {
              ...row,
              street,
              street_number: streetNumber,
              neighborhood,
              city,
              state,
              postal_code: postalCode,
            };

            if (hasStructuredAddress(enrichedRow)) {
              address = buildDisplayAddress(enrichedRow);
            }
          } else {
            warnings.push({
              line,
              warning: "Célula importada, mas o endereço não pôde ser geolocalizado.",
            });
          }
        } catch {
          warnings.push({
            line,
            warning: "Célula importada, mas houve falha ao consultar a geolocalização.",
          });
        }

        if (index < data.rows.length - 1) {
          await sleep(120);
        }
      }

      inserts.push({
        name: row.name.trim(),
        network_id: row.network_id,
        gender: row.gender,

        address,
        street,
        street_number: streetNumber,
        address_complement: trimOrNull(row.address_complement),
        neighborhood,
        city,
        state,
        postal_code: postalCode,

        latitude,
        longitude,

        leader_name: row.leader_name.trim(),

        leader_whatsapp: row.leader_whatsapp.replace(/\D/g, ""),

        leader_instagram: row.leader_instagram?.replace(/^@/, "").trim() || null,

        leader2_name: trimOrNull(row.leader2_name),

        leader2_whatsapp: row.leader2_whatsapp?.replace(/\D/g, "") || null,

        meeting_weekday: row.meeting_weekday ?? null,

        meeting_time: row.meeting_time ?? null,

        is_active: row.is_active !== false,
      });
    }

    if (inserts.length === 0) {
      return {
        ok: false as const,
        imported: 0,
        errors,
        warnings,
      };
    }

    const { error, count } = await supabaseAdmin.from("cells").insert(inserts, {
      count: "exact",
    });

    if (error) {
      return {
        ok: false as const,
        imported: 0,
        errors: [
          {
            line: 0,
            error: error.message,
          },
        ],
        warnings,
      };
    }

    return {
      ok: true as const,
      imported: count ?? inserts.length,
      errors,
      warnings,
    };
  });
