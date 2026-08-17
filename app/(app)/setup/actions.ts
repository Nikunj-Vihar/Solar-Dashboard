"use server";

import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { getAuthedUser } from "@/lib/data/site";
import { setupSchema, type SetupInput } from "@/lib/validation/schemas";

export type CompleteSetupResult =
  | { ok: true }
  | { ok: false; error: string };

export async function completeSetup(input: SetupInput): Promise<CompleteSetupResult> {
  const user = await getAuthedUser();
  if (!user) {
    return { ok: false, error: "You must be signed in." };
  }

  const parsed = setupSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const { site, inverters } = parsed.data;

  const supabase = await createClient();

  const { data: existingSite } = await supabase
    .from("sites")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (existingSite) {
    return { ok: false, error: "Setup has already been completed for this account." };
  }

  const { data: siteRow, error: siteError } = await supabase
    .from("sites")
    .insert({
      owner_id: user.id,
      name: site.name,
      address: site.address || null,
      latitude: site.latitude,
      longitude: site.longitude,
      commissioning_date: site.commissioningDate || null,
      tariff_rate_inr_per_kwh: site.tariffRateInrPerKwh ?? null,
      is_public: site.isPublic,
      public_share_slug: site.isPublic ? randomUUID() : null,
    })
    .select()
    .single();

  if (siteError || !siteRow) {
    return { ok: false, error: siteError?.message ?? "Could not create site." };
  }

  const { data: inverterRows, error: inverterError } = await supabase
    .from("inverters")
    .insert(
      inverters.map((inv) => ({
        site_id: siteRow.id,
        name: inv.name,
        manufacturer: inv.manufacturer || null,
        model: inv.model || null,
        dc_capacity_kwp: inv.dcCapacityKwp,
        install_date: inv.installDate || null,
      })),
    )
    .select();

  if (inverterError || !inverterRows) {
    await supabase.from("sites").delete().eq("id", siteRow.id);
    return { ok: false, error: inverterError?.message ?? "Could not create inverters." };
  }

  return { ok: true };
}
