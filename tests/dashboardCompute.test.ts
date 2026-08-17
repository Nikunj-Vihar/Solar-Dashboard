import { describe, it, expect } from "vitest";
import { computeRangeFields, type RawReadingRow } from "@/lib/calc/dashboardCompute";

const inverters = [
  { id: "inv-1", name: "Inverter 1" },
  { id: "inv-2", name: "Inverter 2" },
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
    const result = computeRangeFields(rows, inverters, { from: "2026-01-01", to: "2026-01-02" });

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
    const result = computeRangeFields(rows, inverters, { from: "2026-01-01", to: "2026-01-01" });

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
    const result = computeRangeFields(rows, inverters, { from: "2026-01-01", to: "2026-01-02" });

    expect(result.perInverterRange[0]).toEqual({
      inverterId: "inv-1",
      name: "Inverter 1",
      kwh: 0,
      noReading: false,
    });
  });

  it("returns zeros for an inverter with no rows in an otherwise non-empty range", () => {
    const rows: RawReadingRow[] = [
      { reading_date: "2026-01-01", inverter_id: "inv-1", daily_kwh: 10, no_reading: false },
    ];
    const result = computeRangeFields(rows, inverters, { from: "2026-01-01", to: "2026-01-01" });
    expect(result.perInverterRange[1]).toEqual({
      inverterId: "inv-2",
      name: "Inverter 2",
      kwh: 0,
      noReading: false,
    });
  });

  describe("rangeLastMonthKwh", () => {
    it("is null when there's no data in the month-ago window", () => {
      const rows: RawReadingRow[] = [
        { reading_date: "2026-02-01", inverter_id: "inv-1", daily_kwh: 10, no_reading: false },
      ];
      const result = computeRangeFields(rows, inverters, { from: "2026-02-01", to: "2026-02-01" });
      expect(result.rangeLastMonthKwh).toBeNull();
    });

    it("sums real readings from this exact date range one month earlier", () => {
      const rows: RawReadingRow[] = [
        { reading_date: "2026-02-01", inverter_id: "inv-1", daily_kwh: 10, no_reading: false },
        { reading_date: "2026-01-01", inverter_id: "inv-1", daily_kwh: 8, no_reading: false },
        { reading_date: "2026-01-02", inverter_id: "inv-1", daily_kwh: 9, no_reading: false },
        // Outside the shifted window -- should not be included.
        { reading_date: "2026-01-03", inverter_id: "inv-1", daily_kwh: 100, no_reading: false },
      ];
      const result = computeRangeFields(rows, inverters, { from: "2026-02-01", to: "2026-02-02" });
      expect(result.rangeLastMonthKwh).toBe(17);
    });

    it("excludes no_reading rows from the month-ago window instead of counting them as zero", () => {
      const rows: RawReadingRow[] = [
        { reading_date: "2026-02-01", inverter_id: "inv-1", daily_kwh: 10, no_reading: false },
        { reading_date: "2026-01-01", inverter_id: "inv-1", daily_kwh: null, no_reading: true },
      ];
      const result = computeRangeFields(rows, inverters, { from: "2026-02-01", to: "2026-02-01" });
      expect(result.rangeLastMonthKwh).toBeNull();
    });
  });

  describe("rangeLastYearKwh", () => {
    it("is null when there's no data in the year-ago window", () => {
      const rows: RawReadingRow[] = [
        { reading_date: "2026-01-01", inverter_id: "inv-1", daily_kwh: 10, no_reading: false },
      ];
      const result = computeRangeFields(rows, inverters, { from: "2026-01-01", to: "2026-01-01" });
      expect(result.rangeLastYearKwh).toBeNull();
    });

    it("sums real readings from this exact date range one year earlier", () => {
      const rows: RawReadingRow[] = [
        { reading_date: "2026-01-01", inverter_id: "inv-1", daily_kwh: 10, no_reading: false },
        { reading_date: "2025-01-01", inverter_id: "inv-1", daily_kwh: 8, no_reading: false },
        { reading_date: "2025-01-02", inverter_id: "inv-1", daily_kwh: 9, no_reading: false },
        // Outside the shifted window -- should not be included.
        { reading_date: "2025-01-03", inverter_id: "inv-1", daily_kwh: 100, no_reading: false },
      ];
      const result = computeRangeFields(rows, inverters, { from: "2026-01-01", to: "2026-01-02" });
      expect(result.rangeLastYearKwh).toBe(17);
    });

    it("excludes no_reading rows from the year-ago window instead of counting them as zero", () => {
      const rows: RawReadingRow[] = [
        { reading_date: "2026-01-01", inverter_id: "inv-1", daily_kwh: 10, no_reading: false },
        { reading_date: "2025-01-01", inverter_id: "inv-1", daily_kwh: null, no_reading: true },
      ];
      const result = computeRangeFields(rows, inverters, { from: "2026-01-01", to: "2026-01-01" });
      expect(result.rangeLastYearKwh).toBeNull();
    });
  });
});
