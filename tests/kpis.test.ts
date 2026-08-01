import { describe, it, expect } from "vitest";
import {
  computeCUF,
  computeSpecificYield,
  computeRupeeSaved,
  computeCo2OffsetKg,
  computeVsBaselinePercent,
} from "@/lib/calc/kpis";

describe("computeCUF", () => {
  it("computes a plausible CUF for a typical Indian fixed-tilt system", () => {
    // 20kWp system producing 80 kWh/day -> CUF = 80 / (20*24) = 16.7%, in the 15-25% typical range.
    const cuf = computeCUF(80, 20, 1);
    expect(cuf).toBeCloseTo(16.67, 1);
  });

  it("returns 0 for zero/negative capacity or days rather than dividing by zero", () => {
    expect(computeCUF(80, 0, 1)).toBe(0);
    expect(computeCUF(80, 20, 0)).toBe(0);
  });
});

describe("computeSpecificYield", () => {
  it("computes kWh per kWp", () => {
    expect(computeSpecificYield(100, 20)).toBe(5);
  });
});

describe("computeRupeeSaved", () => {
  it("multiplies kWh by the tariff rate", () => {
    expect(computeRupeeSaved(100, 8.5)).toBe(850);
  });

  it("returns null when no tariff rate was configured", () => {
    expect(computeRupeeSaved(100, null)).toBeNull();
  });
});

describe("computeCo2OffsetKg", () => {
  it("multiplies kWh by the grid emission factor", () => {
    expect(computeCo2OffsetKg(100, 0.716)).toBe(71.6);
  });
});

describe("computeVsBaselinePercent", () => {
  it("returns a positive percentage when above baseline", () => {
    expect(computeVsBaselinePercent(110, 100)).toBeCloseTo(10, 5);
  });

  it("returns a negative percentage when below baseline", () => {
    expect(computeVsBaselinePercent(80, 100)).toBeCloseTo(-20, 5);
  });

  it("returns null when the baseline is zero or missing", () => {
    expect(computeVsBaselinePercent(80, 0)).toBeNull();
  });
});
