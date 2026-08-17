// Parsed/formatted in local time throughout -- both LogCalendar and
// WeekStrip only ever compare their own Date objects against each other
// (never against a UTC-anchored string), so there's no timezone pitfall.
export function parseLocalDateString(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function toLocalDateString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
