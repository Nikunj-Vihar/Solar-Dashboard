"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAuthedUser } from "@/lib/data/site";
import { dailyLogSchema, type DailyLogInput } from "@/lib/validation/schemas";
import { checkCumulativeAndCrossCheck, exceedsPhysicalCapacity } from "@/lib/validation/readings";
import { addDays } from "@/lib/date";

export type ConfirmationIssue = {
  inverterId: string;
  inverterName: string;
  issue: "cumulative_decreased" | "mismatch";
  message: string;
};

export type SubmitDailyLogResult =
  | { ok: true }
  | { ok: false; error: string; needsConfirmation?: undefined }
  | { ok: false; needsConfirmation: ConfirmationIssue[]; error?: undefined };

export async function submitDailyLog(input: DailyLogInput): Promise<SubmitDailyLogResult> {
  const user = await getAuthedUser();
  if (!user) {
    return { ok: false, error: "You must be signed in." };
  }

  const parsed = dailyLogSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const { date, readings } = parsed.data;

  const supabase = await createClient();

  const { data: site } = await supabase
    .from("sites")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!site) {
    return { ok: false, error: "Complete setup before logging readings." };
  }

  const { data: inverters } = await supabase
    .from("inverters")
    .select("id, name, rated_capacity_kw")
    .eq("site_id", site.id);
  if (!inverters || inverters.length === 0) {
    return { ok: false, error: "No inverters found for this site." };
  }
  const inverterById = new Map(inverters.map((i) => [i.id, i]));

  for (const r of readings) {
    if (!inverterById.has(r.inverterId)) {
      return { ok: false, error: "One of these inverters no longer belongs to this site." };
    }
  }

  const previousDate = addDays(date, -1);
  const { data: previousReadings } = await supabase
    .from("daily_readings")
    .select("inverter_id, cumulative_mwh")
    .eq("reading_date", previousDate)
    .in(
      "inverter_id",
      readings.map((r) => r.inverterId),
    );
  const previousByInverter = new Map(
    (previousReadings ?? []).map((r) => [r.inverter_id, r.cumulative_mwh]),
  );

  const confirmations: ConfirmationIssue[] = [];

  for (const r of readings) {
    const inverter = inverterById.get(r.inverterId)!;

    if (exceedsPhysicalCapacity(r.dailyKwh, inverter.rated_capacity_kw)) {
      return {
        ok: false,
        error: `${inverter.name}: ${r.dailyKwh} kWh is above what its rated capacity (${inverter.rated_capacity_kw} kW) could plausibly produce in a day — check for a typo.`,
      };
    }

    const previousCumulativeMwh = previousByInverter.get(r.inverterId) ?? null;
    const check = checkCumulativeAndCrossCheck({
      dailyKwh: r.dailyKwh,
      cumulativeMwh: r.cumulativeMwh,
      previousCumulativeMwh,
      isReset: r.isReset,
    });

    if (check.status === "cumulative_decreased") {
      confirmations.push({
        inverterId: r.inverterId,
        inverterName: inverter.name,
        issue: "cumulative_decreased",
        message: `Cumulative (${r.cumulativeMwh} MWh) is lower than yesterday's (${previousCumulativeMwh} MWh). If this inverter was replaced or reset, check "Replaced/reset" below.`,
      });
    } else if (check.status === "mismatch" && !r.confirmMismatch) {
      confirmations.push({
        inverterId: r.inverterId,
        inverterName: inverter.name,
        issue: "mismatch",
        message: `You entered ${r.dailyKwh} kWh, but the cumulative counter only moved ${check.computedDeltaKwh} kWh since yesterday. Double-check for a typo, or confirm this is correct.`,
      });
    }
  }

  if (confirmations.length > 0) {
    return { ok: false, needsConfirmation: confirmations };
  }

  const { error: upsertError } = await supabase.from("daily_readings").upsert(
    readings.map((r) => ({
      inverter_id: r.inverterId,
      site_id: site.id,
      reading_date: date,
      daily_kwh: r.dailyKwh,
      cumulative_mwh: r.cumulativeMwh,
      is_reset: r.isReset,
      mismatch_confirmed: r.confirmMismatch,
      entered_by: user.id,
    })),
    { onConflict: "inverter_id,reading_date" },
  );

  if (upsertError) {
    return { ok: false, error: upsertError.message };
  }

  revalidatePath("/dashboard");
  revalidatePath("/log");

  return { ok: true };
}
