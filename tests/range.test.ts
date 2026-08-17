import { describe, it, expect } from "vitest";
import { computeRangeSummary, resolveDateRange } from "@/lib/calc/range";

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

describe("resolveDateRange", () => {
  const today = "2026-07-15";

  it("defaults to the last 7 days when both params are missing", () => {
    expect(resolveDateRange(undefined, undefined, today)).toEqual({
      from: "2026-07-09",
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
