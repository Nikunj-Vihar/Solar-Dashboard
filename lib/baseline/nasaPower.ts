import "server-only";

const MONTHS = [
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
  "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
] as const;

export type MonthlyIrradiance = {
  month: number; // 1-12
  avgDailyIrradianceKwhPerM2: number;
}[];

/**
 * NASA POWER's 20-year (2001-2020) monthly climatology for downward solar
 * irradiance, already in kWh/m^2/day — no unit conversion needed. Free,
 * global coverage, no API key. Fetched once at setup and stored in
 * expected_baseline_monthly, not called again after that.
 */
export async function fetchMonthlyIrradiance(
  latitude: number,
  longitude: number,
): Promise<MonthlyIrradiance> {
  const url = new URL("https://power.larc.nasa.gov/api/temporal/climatology/point");
  url.searchParams.set("parameters", "ALLSKY_SFC_SW_DWN");
  url.searchParams.set("community", "RE");
  url.searchParams.set("longitude", String(longitude));
  url.searchParams.set("latitude", String(latitude));
  url.searchParams.set("format", "JSON");

  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) {
    throw new Error(`NASA POWER request failed with status ${res.status}`);
  }
  const json = await res.json();
  return parseMonthlyIrradiance(json);
}

export function parseMonthlyIrradiance(json: unknown): MonthlyIrradiance {
  const data = (
    json as {
      properties?: { parameter?: { ALLSKY_SFC_SW_DWN?: Record<string, number> } };
    }
  )?.properties?.parameter?.ALLSKY_SFC_SW_DWN;

  if (!data) {
    throw new Error("Unexpected NASA POWER response shape");
  }

  return MONTHS.map((key, idx) => {
    const value = data[key];
    // NASA POWER uses -999 as a fill value for locations with no data
    // (e.g. open ocean); treat anything implausibly low the same way.
    if (typeof value !== "number" || value <= -900) {
      throw new Error(
        `No irradiance data available for ${key} at this location — double-check the coordinates`,
      );
    }
    return { month: idx + 1, avgDailyIrradianceKwhPerM2: value };
  });
}
