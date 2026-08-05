import { computeRangeSummary, computeRangeExpectedMidKwh } from "./range";
import type { MonthlyBaselineRow } from "./trend";

export type RawReadingRow = {
  reading_date: string;
  inverter_id: string;
  daily_kwh: number | null;
  no_reading: boolean;
};

export type InverterMeta = { id: string; name: string };

export type RangeFields = {
  rangeKwh: number;
  rangeDaysWithData: number;
  rangeTotalDays: number;
  rangeExpectedMidKwh: number | null;
  rangeIsSingleDay: boolean;
  perInverterRange: { inverterId: string; name: string; kwh: number; noReading: boolean }[];
  lifetimeKwh: number;
};

function sum(nums: number[]): number {
  return Math.round(nums.reduce((a, b) => a + b, 0) * 100) / 100;
}

// Real (non-skipped) rows only -- a "no reading" row's null daily_kwh should
// contribute nothing to a total, not a 0.
function realKwh(rows: RawReadingRow[]): number[] {
  return rows.filter((r) => r.daily_kwh !== null).map((r) => r.daily_kwh as number);
}

/**
 * Everything the dashboard needs for a selected date range, plus the
 * always-fixed lifetime total, computed once from a site's raw reading rows
 * -- shared by the private dashboard (an authenticated Supabase query) and
 * the public share page (one RPC call returning the same row shape), so the
 * two can never quietly drift apart the way duplicated SQL/TS logic would.
 * `inverters` should already be filtered to whichever ones the caller wants
 * included (the private dashboard passes active inverters only).
 */
export function computeRangeFields(
  rows: RawReadingRow[],
  inverters: InverterMeta[],
  range: { from: string; to: string },
  baseline: MonthlyBaselineRow[],
): RangeFields {
  const rangeRows = rows.filter((r) => r.reading_date >= range.from && r.reading_date <= range.to);
  const rangeIsSingleDay = range.from === range.to;

  // "No reading" only means something for a single specific day -- across a
  // multi-day range it's ambiguous, so it's left false and simply unused by
  // callers outside the single-day case (e.g. the underperformance check).
  const perInverterRange = inverters.map((inv) => {
    const invRows = rangeRows.filter((r) => r.inverter_id === inv.id);
    return {
      inverterId: inv.id,
      name: inv.name,
      kwh: sum(realKwh(invRows)),
      noReading: rangeIsSingleDay ? (invRows[0]?.no_reading ?? false) : false,
    };
  });

  const allReadings = rows.map((r) => ({ date: r.reading_date, kwh: r.daily_kwh }));
  const rangeSummary = computeRangeSummary(allReadings, range.from, range.to);

  return {
    rangeKwh: rangeSummary.actualKwh,
    rangeDaysWithData: rangeSummary.daysWithData,
    rangeTotalDays: rangeSummary.totalDays,
    rangeExpectedMidKwh: computeRangeExpectedMidKwh(range.from, range.to, baseline),
    rangeIsSingleDay,
    perInverterRange,
    lifetimeKwh: sum(realKwh(rows)),
  };
}
