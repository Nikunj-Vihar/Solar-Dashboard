import { describe, it, expect } from "vitest";
import {
  computeRangeSummary,
  computeRangeExpectedMidKwh,
  resolveDateRange,
} from "@/lib/calc/range";
import type { MonthlyBaselineRow } from "@/lib/calc/trend";

const baseline: MonthlyBaselineRow[] = [
  { month: 1, expectedDailyKwhLow: 80, expectedDailyKwhMid: 90, expectedDailyKwhHigh: 100 },
  { month: 2, expectedDailyKwhLow: 85, expectedDailyKwhMid: 95, expectedDailyKwhHigh: 105 },
];

describe("computeRangeSummary", () => {
  it("sums real readings and counts days with data over the range", () => {
    const readings = [
      { date: "2026-01-01", kwh: 10 },
      { date: "2026-01-02", kwh: 20 },
      { date: "2026-01-03", kwh: null },
    ];
    const result = computeRangeSummary(readings, "2026-01-01", "2026-01-03");
    expect(result).toEqual({ actualKwh: 30, daysWithData: 2, totalDays: 3 });
  });

  it("sums multiple inverters landing on the same date", () => {
    const readings = [
      { date: "2026-01-01", kwh: 10 },
      { date: "2026-01-01", kwh: 15 },
    ];
    const result = computeRangeSummary(readings, "2026-01-01", "2026-01-01");
    expect(result).toEqual({ actualKwh: 25, daysWithData: 1, totalDays: 1 });
  });

  it("reports zero data for a range with nothing logged", () => {
    const result = computeRangeSummary([], "2026-01-01", "2026-01-05");
    expect(result).toEqual({ actualKwh: 0, daysWithData: 0, totalDays: 5 });
  });
});

describe("computeRangeExpectedMidKwh", () => {
  it("sums each day's month-level mid baseline across the range", () => {
    // Jan 30-31 (2 days @ 90) + Feb 1 (1 day @ 95)
    expect(computeRangeExpectedMidKwh("2026-01-30", "2026-02-01", baseline)).toBe(275);
  });

  it("returns null when no baseline is configured at all", () => {
    expect(computeRangeExpectedMidKwh("2026-01-01", "2026-01-05", [])).toBeNull();
  });

  it("contributes 0 for a month with no baseline row, without going null", () => {
    // March has no baseline row above.
    expect(computeRangeExpectedMidKwh("2026-03-01", "2026-03-02", baseline)).toBe(0);
  });
});

describe("resolveDateRange", () => {
  const today = "2026-07-15";

  it("defaults to the last 30 days when both params are missing", () => {
    expect(resolveDateRange(undefined, undefined, today)).toEqual({
      from: "2026-06-16",
      to: today,
    });
  });

  it("passes through a valid range", () => {
    expect(resolveDateRange("2026-07-01", "2026-07-10", today)).toEqual({
      from: "2026-07-01",
      to: "2026-07-10",
    });
  });

  it("clamps a future end date to today", () => {
    expect(resolveDateRange("2026-07-01", "2026-12-31", today)).toEqual({
      from: "2026-07-01",
      to: today,
    });
  });

  it("falls back to today for a malformed 'from', then swaps since that puts from after to", () => {
    expect(resolveDateRange("not-a-date", "2026-07-10", today)).toEqual({
      from: "2026-07-10",
      to: today,
    });
  });

  it("swaps a backwards range instead of erroring", () => {
    expect(resolveDateRange("2026-07-10", "2026-07-01", today)).toEqual({
      from: "2026-07-01",
      to: "2026-07-10",
    });
  });
});
