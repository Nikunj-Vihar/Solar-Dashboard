import { describe, it, expect } from "vitest";
import { computeSkyConditionImpact } from "@/lib/calc/skyConditionImpact";

describe("computeSkyConditionImpact", () => {
  it("averages generation within each logged sky condition", () => {
    const dailyTotals = [
      { date: "2026-08-01", totalKwh: 100 },
      { date: "2026-08-02", totalKwh: 120 },
      { date: "2026-08-03", totalKwh: 40 },
    ];
    const skyConditionByDate = new Map([
      ["2026-08-01", "clear" as const],
      ["2026-08-02", "clear" as const],
      ["2026-08-03", "overcast" as const],
    ]);
    const result = computeSkyConditionImpact(dailyTotals, skyConditionByDate);
    expect(result).toEqual([
      { condition: "clear", label: "Clear", avgKwh: 110, dayCount: 2 },
      { condition: "overcast", label: "Overcast", avgKwh: 40, dayCount: 1 },
    ]);
  });

  it("orders results clearest-to-worst regardless of input order", () => {
    const dailyTotals = [
      { date: "2026-08-01", totalKwh: 50 },
      { date: "2026-08-02", totalKwh: 90 },
    ];
    const skyConditionByDate = new Map([
      ["2026-08-01", "overcast" as const],
      ["2026-08-02", "clear" as const],
    ]);
    const result = computeSkyConditionImpact(dailyTotals, skyConditionByDate);
    expect(result.map((r) => r.condition)).toEqual(["clear", "overcast"]);
  });

  it("skips a day with no real generation (null, e.g. a 'no reading' day)", () => {
    const dailyTotals = [
      { date: "2026-08-01", totalKwh: null },
      { date: "2026-08-02", totalKwh: 90 },
    ];
    const skyConditionByDate = new Map([
      ["2026-08-01", "clear" as const],
      ["2026-08-02", "clear" as const],
    ]);
    const result = computeSkyConditionImpact(dailyTotals, skyConditionByDate);
    expect(result).toEqual([{ condition: "clear", label: "Clear", avgKwh: 90, dayCount: 1 }]);
  });

  it("skips a day with generation but no sky condition logged", () => {
    const dailyTotals = [{ date: "2026-08-01", totalKwh: 90 }];
    const result = computeSkyConditionImpact(dailyTotals, new Map());
    expect(result).toEqual([]);
  });

  it("returns an empty array when nothing is attributable", () => {
    expect(computeSkyConditionImpact([], new Map())).toEqual([]);
  });
});
