/**
 * Pure fetch-range math and response parsing for the weather-sync Edge
 * Function (the "how did climate affect generation" feature). Kept
 * dependency-free and I/O-free -- the edge function vendors a copy of this
 * file for its Deno runtime and does the actual `fetch()` call itself,
 * matching how supabase/functions/generation-report/index.ts already
 * vendors lib/calc/reportPeriod.ts/kpis.ts rather than resolving the "@/"
 * path alias cross-runtime. Keep both copies in sync if this logic changes.
 *
 * Unlike lib/baseline/nasaPower.ts (a 20-year climatology average, fetched
 * once at setup), this hits NASA POWER's *daily* endpoint -- real historical
 * values for actual dates, published with roughly a 1-2 week lag.
 */

export type DailyWeatherRow = {
  date: string; // YYYY-MM-DD
  avgDailyIrradianceKwhPerM2: number | null;
  cloudAmtPct: number | null;
  temperatureC: number | null;
  precipitationMm: number | null;
};

const PARAMETERS = ["ALLSKY_SFC_SW_DWN", "CLOUD_AMT", "T2M", "PRECTOTCORR"] as const;

function toNasaDate(ymd: string): string {
  return ymd.replaceAll("-", "");
}

function fromNasaDate(compact: string): string {
  return `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}`;
}

export function buildDailyWeatherUrl(
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

// NASA POWER uses -999 (and other implausibly-low sentinels) as a fill value
// for a date/parameter combination it doesn't have data for yet -- treated
// per-parameter, not per-row, so a day with irradiance but no cloud data
// yet still gets stored with the fields that are actually available.
function cleanValue(value: unknown): number | null {
  return typeof value === "number" && value > -900 ? value : null;
}

export function parseDailyWeather(json: unknown, startDate: string, endDate: string): DailyWeatherRow[] {
  const parameter = (
    json as { properties?: { parameter?: Record<string, Record<string, number>> } }
  )?.properties?.parameter;

  if (!parameter || !parameter.ALLSKY_SFC_SW_DWN) {
    throw new Error("Unexpected NASA POWER daily response shape");
  }

  const dates = Object.keys(parameter.ALLSKY_SFC_SW_DWN).sort();
  return dates.map((compact) => ({
    date: fromNasaDate(compact),
    avgDailyIrradianceKwhPerM2: cleanValue(parameter.ALLSKY_SFC_SW_DWN?.[compact]),
    cloudAmtPct: cleanValue(parameter.CLOUD_AMT?.[compact]),
    temperatureC: cleanValue(parameter.T2M?.[compact]),
    precipitationMm: cleanValue(parameter.PRECTOTCORR?.[compact]),
  })).filter((row) => row.date >= startDate && row.date <= endDate);
}

// NASA POWER's daily data for a given date typically isn't published until
// roughly 1-2 weeks after the fact -- fetching right up to "today" would
// mostly return fill values. Staying this far behind avoids wasted requests
// for dates that reliably don't have data yet.
export const PUBLICATION_LAG_DAYS = 14;
// Defensive cap per request so a site with years of backlog doesn't try to
// pull everything in one call -- subsequent daily cron runs keep advancing
// the cursor until they catch up.
export const MAX_FETCH_WINDOW_DAYS = 366;

function addDaysToYmd(ymd: string, days: number): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Computes the [from, to] date range to fetch next for a site, or null if
 * there's nothing new available yet. `lastFetchedDate` is the max date
 * already in daily_weather_readings for this site (null if never fetched --
 * in which case this backfills from the site's earliest logged reading, or
 * today if it has no readings yet).
 */
export function computeFetchRange(params: {
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
