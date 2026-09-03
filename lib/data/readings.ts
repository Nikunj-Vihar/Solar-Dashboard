import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { SkyCondition } from "@/lib/validation/schemas";

export type ExistingReading = {
  inverter_id: string;
  daily_kwh: number | null;
  cumulative_mwh: number | null;
  is_reset: boolean;
  no_reading: boolean;
};

export async function getReadingsForDate(
  siteId: string,
  date: string,
): Promise<ExistingReading[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("daily_readings")
    .select("inverter_id, daily_kwh, cumulative_mwh, is_reset, no_reading")
    .eq("site_id", siteId)
    .eq("reading_date", date);
  return data ?? [];
}

export type LoggedDates = {
  /** Dates with at least one real (non-skipped) reading. */
  logged: Set<string>;
  /** Dates where every logged inverter was explicitly marked "no reading". */
  skipped: Set<string>;
};

/** Every date touched at all, split by whether it has real data -- for the log page's calendar dots. */
export async function getLoggedDatesForSite(siteId: string): Promise<LoggedDates> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("daily_readings")
    .select("reading_date, daily_kwh")
    .eq("site_id", siteId);

  const logged = new Set<string>();
  const touched = new Set<string>();
  for (const r of data ?? []) {
    touched.add(r.reading_date);
    if (r.daily_kwh !== null) logged.add(r.reading_date);
  }
  const skipped = new Set([...touched].filter((d) => !logged.has(d)));
  return { logged, skipped };
}

export type ExistingSkyCondition = { skyCondition: SkyCondition; note: string | null };

export async function getSkyConditionForDate(
  siteId: string,
  date: string,
): Promise<ExistingSkyCondition | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("daily_sky_conditions")
    .select("sky_condition, note")
    .eq("site_id", siteId)
    .eq("reading_date", date)
    .maybeSingle();
  return data ? { skyCondition: data.sky_condition as SkyCondition, note: data.note } : null;
}

/** Every logged date's sky condition for a site, for correlating against generation. */
export async function getSkyConditionsForSite(siteId: string): Promise<Map<string, SkyCondition>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("daily_sky_conditions")
    .select("reading_date, sky_condition")
    .eq("site_id", siteId);

  return new Map((data ?? []).map((r) => [r.reading_date, r.sky_condition as SkyCondition]));
}
