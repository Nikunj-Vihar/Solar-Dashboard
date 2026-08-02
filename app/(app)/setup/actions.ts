"use server";

import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { getAuthedUser } from "@/lib/data/site";
import { setupSchema, type SetupInput } from "@/lib/validation/schemas";
import { fetchMonthlyIrradiance } from "@/lib/baseline/nasaPower";
import { computeMonthlyBaseline } from "@/lib/baseline/computeBaseline";

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

  try {
    const totalDcCapacityKwp = inverters.reduce((sum, inv) => sum + inv.dcCapacityKwp, 0);
    const irradiance = await fetchMonthlyIrradiance(site.latitude, site.longitude);
    const baseline = computeMonthlyBaseline(irradiance, totalDcCapacityKwp);

    const { error: baselineError } = await supabase.from("expected_baseline_monthly").insert(
      baseline.map((b) => ({
        site_id: siteRow.id,
        month: b.month,
        avg_daily_irradiance_kwh_per_m2: b.avgDailyIrradianceKwhPerM2,
        expected_daily_kwh_low: b.expectedDailyKwhLow,
        expected_daily_kwh_mid: b.expectedDailyKwhMid,
        expected_daily_kwh_high: b.expectedDailyKwhHigh,
      })),
    );
    if (baselineError) throw new Error(baselineError.message);
  } catch (err) {
    // Roll back so /setup can be retried cleanly instead of leaving an
    // orphaned site with no baseline data.
    await supabase.from("sites").delete().eq("id", siteRow.id);
    const message = err instanceof Error ? err.message : "Could not fetch solar data.";
    return {
      ok: false,
      error: `${message} Double-check the coordinates and try again.`,
    };
  }

  return { ok: true };
}
