// Weather-sync Edge Function ("how is climate affecting my generation") —
// deployed via `supabase functions deploy weather-sync --no-verify-jwt`,
// scheduled daily by pg_cron (see supabase/migrations/0015_daily_weather.sql),
// and invokable manually for testing: supabase functions invoke weather-sync
//
// Fetches NASA POWER's *daily* endpoint (real historical values for actual
// dates, not the 20-year climatology average lib/baseline/nasaPower.ts uses
// at setup) and stores results in daily_weather_readings, to later be shown
// alongside the client's own daily_sky_conditions entries on the dashboard.
import { createClient } from "npm:@supabase/supabase-js@2.111.0";

// Vendored from lib/baseline/nasaPowerDaily.ts — Deno can't resolve this
// project's "@/" path alias, and these functions have zero dependencies, so
// a direct copy is the pragmatic choice over a build step just for one file.
// Keep in sync if this logic changes.
type DailyWeatherRow = {
  date: string;
  avgDailyIrradianceKwhPerM2: number | null;
  cloudAmtPct: number | null;
  temperatureC: number | null;
  precipitationMm: number | null;
};

const PARAMETERS = ["ALLSKY_SFC_SW_DWN", "CLOUD_AMT", "T2M", "PRECTOTCORR"];

function toNasaDate(ymd: string): string {
  return ymd.replaceAll("-", "");
}
function fromNasaDate(compact: string): string {
  return `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}`;
}

function buildDailyWeatherUrl(
  latitude: number,
  longitude: number,
  startDate: string,
  endDate: string,
): string {
  const url = new URL("https://power.larc.nasa.gov/api/temporal/daily/point");
  url.searchParams.set("parameters", PARAMETERS.join(","));
  url.searchParams.set("community", "RE");
  url.searchParams.set("longitude", String(longitude));
  url.searchParams.set("latitude", String(latitude));
  url.searchParams.set("start", toNasaDate(startDate));
  url.searchParams.set("end", toNasaDate(endDate));
  url.searchParams.set("format", "JSON");
  return url.toString();
}

function cleanValue(value: unknown): number | null {
  return typeof value === "number" && value > -900 ? value : null;
}

function parseDailyWeather(json: unknown, startDate: string, endDate: string): DailyWeatherRow[] {
  const parameter = (
    json as { properties?: { parameter?: Record<string, Record<string, number>> } }
  )?.properties?.parameter;

  if (!parameter || !parameter.ALLSKY_SFC_SW_DWN) {
    throw new Error("Unexpected NASA POWER daily response shape");
  }

  const dates = Object.keys(parameter.ALLSKY_SFC_SW_DWN).sort();
  return dates
    .map((compact) => ({
      date: fromNasaDate(compact),
      avgDailyIrradianceKwhPerM2: cleanValue(parameter.ALLSKY_SFC_SW_DWN?.[compact]),
      cloudAmtPct: cleanValue(parameter.CLOUD_AMT?.[compact]),
      temperatureC: cleanValue(parameter.T2M?.[compact]),
      precipitationMm: cleanValue(parameter.PRECTOTCORR?.[compact]),
    }))
    .filter((row) => row.date >= startDate && row.date <= endDate);
}

const PUBLICATION_LAG_DAYS = 14;
const MAX_FETCH_WINDOW_DAYS = 366;

function addDaysToYmd(ymd: string, days: number): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function computeFetchRange(params: {
  lastFetchedDate: string | null;
  earliestReadingDate: string | null;
  today: string;
}): { from: string; to: string } | null {
  const { lastFetchedDate, earliestReadingDate, today } = params;

  const from = lastFetchedDate
    ? addDaysToYmd(lastFetchedDate, 1)
    : (earliestReadingDate ?? today);
  const latestAvailable = addDaysToYmd(today, -PUBLICATION_LAG_DAYS);

  if (from > latestAvailable) {
    return null;
  }

  const cappedTo = addDaysToYmd(from, MAX_FETCH_WINDOW_DAYS - 1);
  const to = cappedTo < latestAvailable ? cappedTo : latestAvailable;
  return { from, to };
}
// End vendored section.

Deno.serve(async (req: Request) => {
  const authHeader = req.headers.get("Authorization") ?? "";
  const expected = `Bearer ${Deno.env.get("WEATHER_SYNC_SECRET")}`;
  if (authHeader !== expected) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  const { data: sites, error: sitesErr } = await supabase
    .from("sites")
    .select("id, name, latitude, longitude");
  if (sitesErr) {
    return new Response(JSON.stringify({ error: sitesErr.message }), { status: 500 });
  }

  const results: Record<string, unknown>[] = [];

  for (const site of sites ?? []) {
    const { data: lastFetched } = await supabase
      .from("daily_weather_readings")
      .select("reading_date")
      .eq("site_id", site.id)
      .order("reading_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: earliestReading } = await supabase
      .from("daily_readings")
      .select("reading_date")
      .eq("site_id", site.id)
      .order("reading_date", { ascending: true })
      .limit(1)
      .maybeSingle();

    const range = computeFetchRange({
      lastFetchedDate: lastFetched?.reading_date ?? null,
      earliestReadingDate: earliestReading?.reading_date ?? null,
      today,
    });

    if (!range) {
      results.push({ site: site.name, status: "skipped", reason: "up to date" });
      continue;
    }

    try {
      const url = buildDailyWeatherUrl(site.latitude, site.longitude, range.from, range.to);
      const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
      if (!res.ok) {
        throw new Error(`NASA POWER request failed with status ${res.status}`);
      }
      const json = await res.json();
      const rows = parseDailyWeather(json, range.from, range.to);

      const { error: upsertErr } = await supabase.from("daily_weather_readings").upsert(
        rows.map((r) => ({
          site_id: site.id,
          reading_date: r.date,
          avg_daily_irradiance_kwh_per_m2: r.avgDailyIrradianceKwhPerM2,
          cloud_amt_pct: r.cloudAmtPct,
          temperature_c: r.temperatureC,
          precipitation_mm: r.precipitationMm,
        })),
        { onConflict: "site_id,reading_date" },
      );
      if (upsertErr) {
        throw new Error(upsertErr.message);
      }

      results.push({
        site: site.name,
        status: "synced",
        from: range.from,
        to: range.to,
        rows: rows.length,
      });
    } catch (err) {
      results.push({
        site: site.name,
        status: "error",
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return new Response(JSON.stringify({ date: today, results }, null, 2), {
    headers: { "Content-Type": "application/json" },
  });
});
