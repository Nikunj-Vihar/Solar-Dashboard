/**
 * "Today" and "yesterday" for a site are anchored to the site's own
 * timezone, not the browser's or the server's — a client logging late at
 * night, or a server running in a different region, must not shift which
 * calendar day a reading lands on.
 */
export function todayInTimezone(timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(new Date());
}

export function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Adds whole calendar months, clamped to the 1st -- only ever called with day-of-month 1 inputs here. */
export function addMonths(dateStr: string, months: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1 + months, d));
  return date.toISOString().slice(0, 10);
}

export function startOfMonth(dateStr: string): string {
  return `${dateStr.slice(0, 7)}-01`;
}

/** Shifts by whole calendar months, clamping to the last valid day of the target month (e.g. Jan 31 - 1mo -> Dec 31, Mar 31 - 1mo -> Feb 28/29). */
export function shiftMonths(dateStr: string, months: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const totalMonths = y * 12 + (m - 1) + months;
  const targetYear = Math.floor(totalMonths / 12);
  const targetMonth = ((totalMonths % 12) + 12) % 12; // 0-11, safe for a negative shift
  const daysInTargetMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const clampedDay = Math.min(d, daysInTargetMonth);
  return new Date(Date.UTC(targetYear, targetMonth, clampedDay)).toISOString().slice(0, 10);
}

/** Shifts by whole calendar years, clamping Feb 29 to Feb 28 in a non-leap target year. */
export function shiftYears(dateStr: string, years: number): string {
  return shiftMonths(dateStr, years * 12);
}

/** Inclusive day count between two YYYY-MM-DD strings (toDate - fromDate, in days, plus one). */
export function daysBetween(fromDate: string, toDate: string): number {
  const [y1, m1, d1] = fromDate.split("-").map(Number);
  const [y2, m2, d2] = toDate.split("-").map(Number);
  const a = Date.UTC(y1, m1 - 1, d1);
  const b = Date.UTC(y2, m2 - 1, d2);
  return Math.round((b - a) / 86400000) + 1;
}

export function isValidDateString(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(value).getTime());
}
