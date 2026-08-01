import { describe, it, expect } from "vitest";
import { buildTrendData, densifyDailyTotals, type MonthlyBaselineRow } from "@/lib/calc/trend";

const baseline: MonthlyBaselineRow[] = [
  { month: 1, expectedDailyKwhLow: 80, expectedDailyKwhMid: 90, expectedDailyKwhHigh: 100 },
  { month: 2, expectedDailyKwhLow: 85, expectedDailyKwhMid: 95, expectedDailyKwhHigh: 105 },
];

describe("buildTrendData", () => {
  it("passes through one point per day at day granularity", () => {
    const readings = [
      { date: "2026-01-01", totalKwh: 88 },
      { date: "2026-01-02", totalKwh: 92 },
    ];
    const result = buildTrendData(readings, baseline, "day");
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ date: "2026-01-01", actualKwh: 88, expectedMidKwh: 90 });
  });

  it("sums 7 days into one week bucket, matching baseline for the days involved", () => {
    // 2026-01-05 is a Monday, so Jan 5-11 is a clean Mon-Sun week.
    const readings = Array.from({ length: 7 }, (_, i) => ({
      date: `2026-01-${String(i + 5).padStart(2, "0")}`,
      totalKwh: 90,
    }));
    const result = buildTrendData(readings, baseline, "week");
    expect(result).toHaveLength(1);
    expect(result[0].actualKwh).toBe(630); // 90 * 7
    expect(result[0].expectedMidKwh).toBe(630); // 90 * 7 (all January)
  });

  it("sums a full month correctly and uses that month's baseline", () => {
    const readings = [
      { date: "2026-01-15", totalKwh: 90 },
      { date: "2026-01-16", totalKwh: 90 },
      { date: "2026-02-01", totalKwh: 95 },
    ];
    const result = buildTrendData(readings, baseline, "month");
    expect(result).toHaveLength(2);
    const jan = result.find((r) => r.date === "2026-01");
    const feb = result.find((r) => r.date === "2026-02");
    expect(jan?.actualKwh).toBe(180);
    expect(jan?.expectedMidKwh).toBe(180); // 2 days * 90
    expect(feb?.actualKwh).toBe(95);
    expect(feb?.expectedMidKwh).toBe(95); // 1 day * 95 (Feb baseline)
  });

  it("handles a week bucket spanning two different baseline months correctly", () => {
    // Jan 29 (Thu) through Feb 1 (Sun) -> same ISO week, spans Jan (mid=90) and Feb (mid=95) baselines.
    const readings = [
      { date: "2026-01-29", totalKwh: 90 },
      { date: "2026-01-30", totalKwh: 90 },
      { date: "2026-01-31", totalKwh: 90 },
      { date: "2026-02-01", totalKwh: 95 },
    ];
    const result = buildTrendData(readings, baseline, "week");
    expect(result).toHaveLength(1);
    expect(result[0].actualKwh).toBe(365);
    expect(result[0].expectedMidKwh).toBe(365); // 90*3 + 95*1
  });

  it("returns an empty array for no readings", () => {
    expect(buildTrendData([], baseline, "day")).toEqual([]);
  });

  it("sorts buckets chronologically regardless of input order", () => {
    const readings = [
      { date: "2026-01-03", totalKwh: 1 },
      { date: "2026-01-01", totalKwh: 1 },
      { date: "2026-01-02", totalKwh: 1 },
    ];
    const result = buildTrendData(readings, baseline, "day");
    expect(result.map((r) => r.date)).toEqual(["2026-01-01", "2026-01-02", "2026-01-03"]);
  });
});

describe("densifyDailyTotals", () => {
  it("fills gaps between readings with zero", () => {
    const result = densifyDailyTotals(
      [{ date: "2026-01-01", kwh: 10 }, { date: "2026-01-03", kwh: 20 }],
      "2026-01-01",
      "2026-01-03",
    );
    expect(result).toEqual([
      { date: "2026-01-01", totalKwh: 10 },
      { date: "2026-01-02", totalKwh: 0 },
      { date: "2026-01-03", totalKwh: 20 },
    ]);
  });

  it("sums multiple entries on the same date (multiple inverters)", () => {
    const result = densifyDailyTotals(
      [
        { date: "2026-01-01", kwh: 10 },
        { date: "2026-01-01", kwh: 15 },
      ],
      "2026-01-01",
      "2026-01-01",
    );
    expect(result).toEqual([{ date: "2026-01-01", totalKwh: 25 }]);
  });

  it("returns an empty range gracefully when from > to", () => {
    expect(densifyDailyTotals([], "2026-01-05", "2026-01-01")).toEqual([]);
  });
});
