import "server-only";
import { createClient } from "@/lib/supabase/server";

export type ExistingReading = {
  inverter_id: string;
  daily_kwh: number;
  cumulative_mwh: number;
  is_reset: boolean;
};

export async function getReadingsForDate(
  siteId: string,
  date: string,
): Promise<ExistingReading[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("daily_readings")
    .select("inverter_id, daily_kwh, cumulative_mwh, is_reset")
    .eq("site_id", siteId)
    .eq("reading_date", date);
  return data ?? [];
}
