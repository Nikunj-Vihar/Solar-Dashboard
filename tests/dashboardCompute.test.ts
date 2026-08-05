import { describe, it, expect } from "vitest";
import { computeRangeFields, type RawReadingRow } from "@/lib/calc/dashboardCompute";
import type { MonthlyBaselineRow } from "@/lib/calc/trend";

const inverters = [
  { id: "inv-1", name: "Inverter 1" },
  { id: "inv-2", name: "Inverter 2" },
];

const baseline: MonthlyBaselineRow[] = [
  { month: 1, expectedDailyKwhLow: 80, expectedDailyKwhMid: 90, expectedDailyKwhHigh: 100 },
];

describe("computeRangeFields", () => {
  it("sums per-inverter totals within the range and the lifetime total across everything", () => {
    const rows: RawReadingRow[] = [
      { reading_date: "2026-01-01", inverter_id: "inv-1", daily_kwh: 10, no_reading: false },
      { reading_date: "2026-01-01", inverter_id: "inv-2", daily_kwh: 12, no_reading: false },
      { reading_date: "2026-01-02", inverter_id: "inv-1", daily_kwh: 11, no_reading: false },
      // Outside the range below, but still counts toward lifetime.
      { reading_date: "2025-12-01", inverter_id: "inv-1", daily_kwh: 5, no_reading: false },
    ];
    const result = computeRangeFields(rows, inverters, { from: "2026-01-01", to: "2026-01-02" }, baseline);

    expect(result.perInverterRange).toEqual([
      { inverterId: "inv-1", name: "Inverter 1", kwh: 21, noReading: false },
      { inverterId: "inv-2", name: "Inverter 2", kwh: 12, noReading: false },
    ]);
    expect(result.rangeKwh).toBe(33);
    expect(result.lifetimeKwh).toBe(38);
    expect(result.rangeIsSingleDay).toBe(false);
    expect(result.rangeTotalDays).toBe(2);
  });

  it("marks noReading per-inverter only for a genuine single-day range", () => {
    const rows: RawReadingRow[] = [
      { reading_date: "2026-01-01", inverter_id: "inv-1", daily_kwh: null, no_reading: true },
      { reading_date: "2026-01-01", inverter_id: "inv-2", daily_kwh: 12, no_reading: false },
    ];
    const result = computeRangeFields(rows, inverters, { from: "2026-01-01", to: "2026-01-01" }, baseline);

    expect(result.rangeIsSingleDay).toBe(true);
    expect(result.perInverterRange).toEqual([
      { inverterId: "inv-1", name: "Inverter 1", kwh: 0, noReading: true },
      { inverterId: "inv-2", name: "Inverter 2", kwh: 12, noReading: false },
    ]);
  });

  it("leaves noReading false for a multi-day range even if every day was skipped", () => {
    const rows: RawReadingRow[] = [
      { reading_date: "2026-01-01", inverter_id: "inv-1", daily_kwh: null, no_reading: true },
      { reading_date: "2026-01-02", inverter_id: "inv-1", daily_kwh: null, no_reading: true },
    ];
    const result = computeRangeFields(rows, inverters, { from: "2026-01-01", to: "2026-01-02" }, baseline);

    expect(result.perInverterRange[0]).toEqual({
      inverterId: "inv-1",
      name: "Inverter 1",
      kwh: 0,
      noReading: false,
    });
  });

  it("computes the expected mid baseline for the range, independent of actual readings", () => {
    const result = computeRangeFields([], inverters, { from: "2026-01-01", to: "2026-01-02" }, baseline);
    expect(result.rangeExpectedMidKwh).toBe(180); // 2 days * 90
  });

  it("returns zeros for an inverter with no rows in an otherwise non-empty range", () => {
    const rows: RawReadingRow[] = [
      { reading_date: "2026-01-01", inverter_id: "inv-1", daily_kwh: 10, no_reading: false },
    ];
    const result = computeRangeFields(rows, inverters, { from: "2026-01-01", to: "2026-01-01" }, baseline);
    expect(result.perInverterRange[1]).toEqual({
      inverterId: "inv-2",
      name: "Inverter 2",
      kwh: 0,
      noReading: false,
    });
  });
});
