import { describe, it, expect } from "vitest";
import { isReportDay, computeReportPeriod } from "@/lib/calc/reportPeriod";

describe("isReportDay", () => {
  it("off never sends", () => {
    expect(isReportDay("off", new Date(Date.UTC(2026, 7, 1)))).toBe(false);
  });

  it("daily always sends", () => {
    for (let d = 1; d <= 7; d++) {
      expect(isReportDay("daily", new Date(Date.UTC(2026, 7, d)))).toBe(true);
    }
  });

  it("weekly sends only on Monday", () => {
    // 2024-01-01 was a Monday.
    expect(isReportDay("weekly", new Date(Date.UTC(2024, 0, 1)))).toBe(true);
    expect(isReportDay("weekly", new Date(Date.UTC(2024, 0, 2)))).toBe(false);
    expect(isReportDay("weekly", new Date(Date.UTC(2024, 0, 7)))).toBe(false); // Sunday
    expect(isReportDay("weekly", new Date(Date.UTC(2024, 0, 8)))).toBe(true); // next Monday
  });

  it("monthly sends only on the 1st", () => {
    expect(isReportDay("monthly", new Date(Date.UTC(2026, 7, 1)))).toBe(true);
    expect(isReportDay("monthly", new Date(Date.UTC(2026, 7, 2)))).toBe(false);
    expect(isReportDay("monthly", new Date(Date.UTC(2026, 7, 31)))).toBe(false);
  });
});

describe("computeReportPeriod", () => {
  it("daily: covers yesterday only, compares against the day before", () => {
    const period = computeReportPeriod("daily", new Date(Date.UTC(2026, 7, 2)));
    expect(period.start).toBe("2026-08-01");
    expect(period.end).toBe("2026-08-01");
    expect(period.days).toBe(1);
    expect(period.previousStart).toBe("2026-07-31");
    expect(period.previousEnd).toBe("2026-07-31");
    expect(period.minDaysWithData).toBe(1);
    expect(period.baselineMonth).toBe(8);
  });

  it("daily: correctly crosses a month boundary", () => {
    const period = computeReportPeriod("daily", new Date(Date.UTC(2026, 7, 1)));
    expect(period.start).toBe("2026-07-31");
    expect(period.previousStart).toBe("2026-07-30");
    expect(period.baselineMonth).toBe(7);
  });

  it("weekly: covers the trailing 7 days ending yesterday", () => {
    // Today = Monday 2024-01-08.
    const period = computeReportPeriod("weekly", new Date(Date.UTC(2024, 0, 8)));
    expect(period.start).toBe("2024-01-01");
    expect(period.end).toBe("2024-01-07");
    expect(period.days).toBe(7);
    expect(period.previousStart).toBe("2023-12-25");
    expect(period.previousEnd).toBe("2023-12-31");
    expect(period.minDaysWithData).toBe(4);
    expect(period.baselineMonth).toBe(1);
  });

  it("monthly: covers the previous calendar month (matches original monthly-report behavior)", () => {
    const period = computeReportPeriod("monthly", new Date(Date.UTC(2026, 7, 1)));
    expect(period.label).toBe("July 2026");
    expect(period.start).toBe("2026-07-01");
    expect(period.end).toBe("2026-07-31");
    expect(period.days).toBe(31);
    expect(period.previousStart).toBe("2026-06-01");
    expect(period.previousEnd).toBe("2026-06-30");
    expect(period.minDaysWithData).toBe(20);
    expect(period.baselineMonth).toBe(7);
  });

  it("monthly: correctly crosses a year boundary", () => {
    const period = computeReportPeriod("monthly", new Date(Date.UTC(2026, 0, 1)));
    expect(period.label).toBe("December 2025");
    expect(period.start).toBe("2025-12-01");
    expect(period.end).toBe("2025-12-31");
    expect(period.previousStart).toBe("2025-11-01");
    expect(period.previousEnd).toBe("2025-11-30");
    expect(period.baselineMonth).toBe(12);
  });
});
