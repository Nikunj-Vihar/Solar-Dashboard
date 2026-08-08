import { redirect } from "next/navigation";
import { getCurrentSite } from "@/lib/data/site";
import { getReadingsForDate, getLoggedDatesForSite } from "@/lib/data/readings";
import { todayInTimezone, addDays, isValidDateString } from "@/lib/date";
import { LoggingForm } from "./LoggingForm";

export const metadata = {
  title: "Log readings — Solar Dashboard",
};

export default async function LogPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const site = await getCurrentSite();
  if (!site) {
    redirect("/setup");
  }

  const params = await searchParams;
  const today = todayInTimezone(site.timezone);
  const date = params.date && isValidDateString(params.date) ? params.date : today;
  const previousDate = addDays(date, -1);

  const [todayReadings, previousReadings, loggedDates] = await Promise.all([
    getReadingsForDate(site.id, date),
    getReadingsForDate(site.id, previousDate),
    getLoggedDatesForSite(site.id),
  ]);

  const inverters = site.inverters
    .filter((inv) => inv.is_active)
    .map((inv) => {
      const existing = todayReadings.find((r) => r.inverter_id === inv.id);
      const previous = previousReadings.find((r) => r.inverter_id === inv.id);
      return {
        id: inv.id,
        name: inv.name,
        existing: existing
          ? {
              dailyKwh: existing.daily_kwh,
              noReading: existing.no_reading,
            }
          : null,
        previousDailyKwh: previous?.daily_kwh ?? null,
      };
    });

  return (
    <LoggingForm
      date={date}
      today={today}
      inverters={inverters}
      loggedDates={Array.from(loggedDates.logged)}
      skippedDates={Array.from(loggedDates.skipped)}
    />
  );
}
