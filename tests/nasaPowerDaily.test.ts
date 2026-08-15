import { describe, it, expect } from "vitest";
import {
  buildDailyWeatherUrl,
  parseDailyWeather,
  computeFetchRange,
  PUBLICATION_LAG_DAYS,
} from "@/lib/baseline/nasaPowerDaily";

describe("buildDailyWeatherUrl", () => {
  it("builds a daily-endpoint URL with compact YYYYMMDD dates", () => {
    const url = new URL(buildDailyWeatherUrl(18.52, 73.86, "2026-07-01", "2026-07-31"));
    expect(url.pathname).toBe("/api/temporal/daily/point");
    expect(url.searchParams.get("start")).toBe("20260701");
    expect(url.searchParams.get("end")).toBe("20260731");
    expect(url.searchParams.get("parameters")).toBe(
      "ALLSKY_SFC_SW_DWN,CLOUD_AMT,T2M,PRECTOTCORR",
    );
    expect(url.searchParams.get("latitude")).toBe("18.52");
    expect(url.searchParams.get("longitude")).toBe("73.86");
  });
});

describe("parseDailyWeather", () => {
  const fixture = {
    properties: {
      parameter: {
        ALLSKY_SFC_SW_DWN: { "20260701": 5.21, "20260702": 4.83, "20260703": -999 },
        CLOUD_AMT: { "20260701": 42.5, "20260702": -999, "20260703": 88.1 },
        T2M: { "20260701": 28.4, "20260702": 27.9, "20260703": 26.1 },
        PRECTOTCORR: { "20260701": 0, "20260702": 3.2, "20260703": 41.7 },
      },
    },
  };

  it("extracts every date in range, sorted", () => {
    const rows = parseDailyWeather(fixture, "2026-07-01", "2026-07-03");
    expect(rows.map((r) => r.date)).toEqual(["2026-07-01", "2026-07-02", "2026-07-03"]);
  });

  it("maps each parameter to its named field", () => {
    const rows = parseDailyWeather(fixture, "2026-07-01", "2026-07-03");
    expect(rows[0]).toEqual({
      date: "2026-07-01",
      avgDailyIrradianceKwhPerM2: 5.21,
      cloudAmtPct: 42.5,
      temperatureC: 28.4,
      precipitationMm: 0,
    });
  });

  it("nulls only the missing parameter, not the whole row, on a -999 fill value", () => {
    const rows = parseDailyWeather(fixture, "2026-07-01", "2026-07-03");
    const jul2 = rows.find((r) => r.date === "2026-07-02")!;
    expect(jul2.cloudAmtPct).toBeNull();
    expect(jul2.avgDailyIrradianceKwhPerM2).toBe(4.83); // still present

    const jul3 = rows.find((r) => r.date === "2026-07-03")!;
    expect(jul3.avgDailyIrradianceKwhPerM2).toBeNull();
    expect(jul3.cloudAmtPct).toBe(88.1); // still present
  });

  it("filters out dates outside the requested range", () => {
    const rows = parseDailyWeather(fixture, "2026-07-02", "2026-07-02");
    expect(rows).toHaveLength(1);
    expect(rows[0].date).toBe("2026-07-02");
  });

  it("rejects a response missing the expected shape", () => {
    expect(() => parseDailyWeather({}, "2026-07-01", "2026-07-03")).toThrow();
  });
});

describe("computeFetchRange", () => {
  const today = "2026-08-10";

  it("backfills from the earliest logged reading when never fetched before", () => {
    const range = computeFetchRange({
      lastFetchedDate: null,
      earliestReadingDate: "2026-06-01",
      today,
    });
    expect(range?.from).toBe("2026-06-01");
  });

  it("stays PUBLICATION_LAG_DAYS behind today", () => {
    const range = computeFetchRange({
      lastFetchedDate: "2026-07-01",
      earliestReadingDate: "2026-06-01",
      today,
    });
    const expectedTo = new Date(`${today}T00:00:00Z`);
    expectedTo.setUTCDate(expectedTo.getUTCDate() - PUBLICATION_LAG_DAYS);
    expect(range?.to).toBe(expectedTo.toISOString().slice(0, 10));
  });

  it("resumes the day after the last fetched date", () => {
    const range = computeFetchRange({
      lastFetchedDate: "2026-07-01",
      earliestReadingDate: "2026-06-01",
      today,
    });
    expect(range?.from).toBe("2026-07-02");
  });

  it("returns null when fully caught up (nothing published yet since last fetch)", () => {
    const range = computeFetchRange({
      lastFetchedDate: "2026-08-01", // within the last PUBLICATION_LAG_DAYS of today
      earliestReadingDate: "2026-06-01",
      today,
    });
    expect(range).toBeNull();
  });

  it("returns null for a brand-new site with no readings yet and nothing to backfill", () => {
    const range = computeFetchRange({
      lastFetchedDate: null,
      earliestReadingDate: today, // site created today, no history
      today,
    });
    expect(range).toBeNull();
  });

  it("caps the window so a huge backlog is fetched incrementally, not all at once", () => {
    const range = computeFetchRange({
      lastFetchedDate: null,
      earliestReadingDate: "2020-01-01", // years of backlog
      today,
    });
    expect(range).not.toBeNull();
    const from = new Date(`${range!.from}T00:00:00Z`);
    const to = new Date(`${range!.to}T00:00:00Z`);
    const days = Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1;
    expect(days).toBeLessThanOrEqual(366);
    expect(range!.to).not.toBe(new Date(`${today}T00:00:00Z`).toISOString().slice(0, 10));
  });
});
