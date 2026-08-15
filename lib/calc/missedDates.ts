import { addDays } from "@/lib/date";

/**
 * Days since the 1st of the month (or the site's first-ever logged/skipped
 * date, if that's later -- avoids flagging days before the site existed)
 * through yesterday that were neither logged nor explicitly marked "no
 * reading." Returns [] entirely if nothing has ever been recorded, since
 * there's nothing yet to compare "missed" against.
 */
export function getMissedDatesThisMonth(params: {
  loggedDates: Iterable<string>;
  skippedDates: Iterable<string>;
  today: string;
}): string[] {
  const { loggedDates, skippedDates, today } = params;
  const loggedSet = loggedDates instanceof Set ? loggedDates : new Set(loggedDates);
  const skippedSet = skippedDates instanceof Set ? skippedDates : new Set(skippedDates);

  const touchedDates = [...loggedSet, ...skippedSet];
  if (touchedDates.length === 0) return [];

  const earliestDate = touchedDates.reduce((min, d) => (d < min ? d : min));
  const monthStart = `${today.slice(0, 7)}-01`;
  const startDate = monthStart > earliestDate ? monthStart : earliestDate;
  const yesterday = addDays(today, -1);

  const missed: string[] = [];
  for (let d = startDate; d <= yesterday; d = addDays(d, 1)) {
    if (!loggedSet.has(d) && !skippedSet.has(d)) missed.push(d);
  }
  return missed;
}
