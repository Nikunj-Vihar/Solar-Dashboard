import { describe, it, expect } from "vitest";
import { computeMonthlyReport } from "@/lib/calc/monthlyReport";

describe("computeMonthlyReport", () => {
  const baseInput = {
    siteName: "Test Site",
    year: 2026,
    month: 7,
    daysInMonth: 31,
    totalKwh: 3100,
    previousMonthKwh: 2800,
    expectedDailyKwhMid: 100,
    totalDcCapacityKwp: 26.4,
    tariffRateInrPerKwh: 8.5,
    gridEmissionFactorKgPerKwh: 0.716,
    perInverterKwh: [
      { name: "Inverter 1", kwh: 800 },
      { name: "Inverter 2", kwh: 780 },
      { name: "Inverter 3", kwh: 770 },
      { name: "Inverter 4", kwh: 750 },
    ],
    alertMessages: ["Inverter 4 underperforming"],
    dashboardUrl: "https://example.com/dashboard",
  };

  it("computes a full report with all figures present", () => {
    const report = computeMonthlyReport(baseInput);
    expect(report.monthLabel).toBe("July 2026");
    expect(report.totalKwh).toBe(3100);
    expect(report.expectedKwh).toBe(3100); // 100 * 31
    expect(report.vsExpectedPercent).toBeCloseTo(0, 5);
    expect(report.vsPreviousMonthPercent).toBeCloseTo(((3100 - 2800) / 2800) * 100, 5);
    expect(report.rupeeSaved).toBe(3100 * 8.5);
    expect(report.co2OffsetKg).toBeCloseTo(3100 * 0.716, 1);
    expect(report.perInverterKwh).toHaveLength(4);
    expect(report.alertMessages).toEqual(["Inverter 4 underperforming"]);
  });

  it("computes a sane CUF and specific yield", () => {
    const report = computeMonthlyReport(baseInput);
    // CUF = 3100 / (26.4 * 24 * 31) -> ~15.9%, within the 15-25% typical range.
    expect(report.cufPercent).toBeGreaterThan(10);
    expect(report.cufPercent).toBeLessThan(25);
    expect(report.specificYieldKwhPerKwp).toBeCloseTo(3100 / 26.4, 1);
  });

  it("handles no tariff rate configured", () => {
    const report = computeMonthlyReport({ ...baseInput, tariffRateInrPerKwh: null });
    expect(report.rupeeSaved).toBeNull();
  });

  it("handles no previous month data (first month of operation)", () => {
    const report = computeMonthlyReport({ ...baseInput, previousMonthKwh: null });
    expect(report.vsPreviousMonthPercent).toBeNull();
  });

  it("handles missing baseline data for the month", () => {
    const report = computeMonthlyReport({ ...baseInput, expectedDailyKwhMid: null });
    expect(report.expectedKwh).toBeNull();
    expect(report.vsExpectedPercent).toBeNull();
  });
});
