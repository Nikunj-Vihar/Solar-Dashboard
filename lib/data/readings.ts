import "server-only";
import { createClient } from "@/lib/supabase/server";

export type ExistingReading = {
  inverter_id: string;
  daily_kwh: number | null;
  no_reading: boolean;
};

export async function getReadingsForDate(
  siteId: string,
  date: string,
): Promise<ExistingReading[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("daily_readings")
    .select("inverter_id, daily_kwh, no_reading")
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
