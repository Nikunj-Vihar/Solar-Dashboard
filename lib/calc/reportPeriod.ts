/**
 * Pure date-range math for the generation-report Edge Function (spec: report
 * frequency setting). Kept dependency-free (plain UTC Date arithmetic, no
 * date-fns) because the edge function vendors a copy of this file for its
 * Deno runtime, matching how supabase/functions/generation-report/index.ts
 * already vendors lib/calc/kpis.ts's formulas rather than resolving the "@/"
 * path alias cross-runtime. Keep both copies in sync if this logic changes.
 */

export type ReportFrequency = "daily" | "weekly" | "monthly" | "off";

export type ReportPeriod = {
  label: string;
  start: string; // YYYY-MM-DD, inclusive
  end: string; // YYYY-MM-DD, inclusive
  days: number;
  previousStart: string;
  previousEnd: string;
  minDaysWithData: number;
  /** Calendar month (1-12) whose expected_baseline_monthly row to compare against. */
  baselineMonth: number;
};

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function ymd(date: Date): string {
  return date.toISOString().slice(0, 10);
}
function addUtcDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}
function shortLabel(date: Date): string {
  return `${MONTH_NAMES[date.getUTCMonth()].slice(0, 3)} ${date.getUTCDate()}`;
}

/** Whether `frequency` calls for a report to go out on `today` (a UTC midnight Date). */
export function isReportDay(frequency: ReportFrequency, today: Date): boolean {
  if (frequency === "off") return false;
  if (frequency === "daily") return true;
  if (frequency === "weekly") return today.getUTCDay() === 1; // Monday
  return today.getUTCDate() === 1; // monthly: 1st of the month
}

/** The date range (and prior-period comparison window) a report on `today` covers. */
export function computeReportPeriod(
  frequency: "daily" | "weekly" | "monthly",
  today: Date,
): ReportPeriod {
  if (frequency === "daily") {
    const day = addUtcDays(today, -1);
    const prevDay = addUtcDays(today, -2);
    return {
      label: `${shortLabel(day)}, ${day.getUTCFullYear()}`,
      start: ymd(day),
      end: ymd(day),
      days: 1,
      previousStart: ymd(prevDay),
      previousEnd: ymd(prevDay),
      minDaysWithData: 1,
      baselineMonth: day.getUTCMonth() + 1,
    };
  }

  if (frequency === "weekly") {
    const end = addUtcDays(today, -1);
    const start = addUtcDays(today, -7);
    const prevEnd = addUtcDays(today, -8);
    const prevStart = addUtcDays(today, -14);
    return {
      label: `${shortLabel(start)} – ${shortLabel(end)}, ${end.getUTCFullYear()}`,
      start: ymd(start),
      end: ymd(end),
      days: 7,
      previousStart: ymd(prevStart),
      previousEnd: ymd(prevEnd),
      minDaysWithData: 4,
      baselineMonth: end.getUTCMonth() + 1,
    };
  }

  // monthly: the previous calendar month, mirroring the original monthly-report logic.
  const thisMonthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const periodStart = new Date(
    Date.UTC(thisMonthStart.getUTCFullYear(), thisMonthStart.getUTCMonth() - 1, 1),
  );
  const daysInMonth = new Date(
    Date.UTC(periodStart.getUTCFullYear(), periodStart.getUTCMonth() + 1, 0),
  ).getUTCDate();
  const periodEnd = new Date(
    Date.UTC(periodStart.getUTCFullYear(), periodStart.getUTCMonth(), daysInMonth),
  );

  const prevPeriodStart = new Date(
    Date.UTC(periodStart.getUTCFullYear(), periodStart.getUTCMonth() - 1, 1),
  );
  const prevDaysInMonth = new Date(
    Date.UTC(prevPeriodStart.getUTCFullYear(), prevPeriodStart.getUTCMonth() + 1, 0),
  ).getUTCDate();
  const prevPeriodEnd = new Date(
    Date.UTC(prevPeriodStart.getUTCFullYear(), prevPeriodStart.getUTCMonth(), prevDaysInMonth),
  );

  return {
    label: `${MONTH_NAMES[periodStart.getUTCMonth()]} ${periodStart.getUTCFullYear()}`,
    start: ymd(periodStart),
    end: ymd(periodEnd),
    days: daysInMonth,
    previousStart: ymd(prevPeriodStart),
    previousEnd: ymd(prevPeriodEnd),
    minDaysWithData: Math.min(20, daysInMonth),
    baselineMonth: periodStart.getUTCMonth() + 1,
  };
}
