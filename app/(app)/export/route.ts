import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthedUser, getCurrentSite } from "@/lib/data/site";
import { toCsv } from "@/lib/csv";

// Full-history CSV export (spec §9) -- doubles as the practical backup
// mechanism, since Supabase's free tier has no automatic backups.
export async function GET() {
  const user = await getAuthedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const site = await getCurrentSite();
  if (!site) {
    return NextResponse.json({ error: "No site found" }, { status: 404 });
  }

  const supabase = await createClient();
  // RLS (is_site_owner(site_id)) scopes this to the caller's own site
  // regardless; the .eq is defense-in-depth against a future policy change.
  const { data: readings, error } = await supabase
    .from("daily_readings")
    .select("reading_date, daily_kwh, cumulative_mwh, is_reset, mismatch_confirmed, inverters(name)")
    .eq("site_id", site.id)
    .order("reading_date", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  type Row = {
    reading_date: string;
    daily_kwh: number;
    cumulative_mwh: number;
    is_reset: boolean;
    mismatch_confirmed: boolean;
    inverters: { name: string } | { name: string }[] | null;
  };

  const csv = toCsv(readings as Row[], [
    { header: "Date", value: (r) => r.reading_date },
    {
      header: "Inverter",
      value: (r) => (Array.isArray(r.inverters) ? r.inverters[0]?.name : r.inverters?.name) ?? "",
    },
    { header: "Daily kWh", value: (r) => r.daily_kwh },
    { header: "Cumulative MWh", value: (r) => r.cumulative_mwh },
    { header: "Meter reset", value: (r) => r.is_reset },
    { header: "Mismatch confirmed", value: (r) => r.mismatch_confirmed },
  ]);

  const filename = `${site.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-readings-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
