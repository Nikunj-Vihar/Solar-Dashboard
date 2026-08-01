import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { parseMonthlyIrradiance } from "@/lib/baseline/nasaPower";
import { computeMonthlyBaseline } from "@/lib/baseline/computeBaseline";

// Fixture is a real captured response for Pune, India (18.52N, 73.86E) —
// spec §10.2: confirm the baseline produces sane numbers against real data.
const fixture = JSON.parse(
  fs.readFileSync(
    path.resolve(__dirname, "fixtures/nasa-power-pune.json"),
    "utf8",
  ),
);

describe("parseMonthlyIrradiance", () => {
  it("extracts all 12 months from a real NASA POWER response", () => {
    const result = parseMonthlyIrradiance(fixture);
    expect(result).toHaveLength(12);
    expect(result[0]).toEqual({ month: 1, avgDailyIrradianceKwhPerM2: 4.9891 });
    expect(result.map((r) => r.month)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
    ]);
  });

  it("shows the expected Pune monsoon dip (Jun-Aug lower than Mar-May)", () => {
    const result = parseMonthlyIrradiance(fixture);
    const byMonth = Object.fromEntries(
      result.map((r) => [r.month, r.avgDailyIrradianceKwhPerM2]),
    );
    expect(byMonth[7]).toBeLessThan(byMonth[4]); // July < April
  });

  it("rejects a response missing the expected shape", () => {
    expect(() => parseMonthlyIrradiance({})).toThrow();
  });

  it("rejects NASA POWER's fill value for locations with no data", () => {
    const noData = {
      properties: {
        parameter: {
          ALLSKY_SFC_SW_DWN: {
            JAN: -999, FEB: -999, MAR: -999, APR: -999, MAY: -999, JUN: -999,
            JUL: -999, AUG: -999, SEP: -999, OCT: -999, NOV: -999, DEC: -999,
          },
        },
      },
    };
    expect(() => parseMonthlyIrradiance(noData)).toThrow(/no irradiance data/i);
  });
});

describe("computeMonthlyBaseline", () => {
  const irradiance = parseMonthlyIrradiance(fixture);

  it("produces a sane expected-kWh/day band for a 20kWp site", () => {
    const baseline = computeMonthlyBaseline(irradiance, 20);
    const jan = baseline[0];

    // 20kWp x ~5 kWh/m2/day x PR band -> tens of kWh/day, not hundreds or fractions.
    expect(jan.expectedDailyKwhMid).toBeGreaterThan(50);
    expect(jan.expectedDailyKwhMid).toBeLessThan(150);
    // low < mid < high, always
    expect(jan.expectedDailyKwhLow).toBeLessThan(jan.expectedDailyKwhMid);
    expect(jan.expectedDailyKwhMid).toBeLessThan(jan.expectedDailyKwhHigh);
  });

  it("scales linearly with installed capacity", () => {
    const small = computeMonthlyBaseline(irradiance, 10);
    const large = computeMonthlyBaseline(irradiance, 20);
    expect(large[0].expectedDailyKwhMid).toBeCloseTo(small[0].expectedDailyKwhMid * 2, 1);
  });

  it("rejects zero or negative capacity", () => {
    expect(() => computeMonthlyBaseline(irradiance, 0)).toThrow();
    expect(() => computeMonthlyBaseline(irradiance, -5)).toThrow();
  });
});
