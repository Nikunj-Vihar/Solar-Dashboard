"use client";

import { startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, isAfter } from "date-fns";
import { DayCell } from "./DayCell";
import { parseLocalDateString, toLocalDateString } from "./dateGrid";

const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

// The mobile counterpart to LogCalendar's month grid -- anchored to the
// current week (containing `today`), not to whichever date is selected, so
// it's a stable set of quick-tap shortcuts rather than shifting around as
// the user browses. Reaching a date outside this week is what the "pick a
// date" calendar dialog is for.
export function WeekStrip({
  selectedDate,
  today,
  loggedDates,
  skippedDates,
  onSelect,
}: {
  selectedDate: string;
  today: string;
  loggedDates: Set<string>;
  skippedDates: Set<string>;
  onSelect: (date: string) => void;
}) {
  const todayDate = parseLocalDateString(today);
  const selected = parseLocalDateString(selectedDate);
  const days = eachDayOfInterval({
    start: startOfWeek(todayDate),
    end: endOfWeek(todayDate),
  });

  return (
    <div className="flex-1">
      <div className="grid grid-cols-7 text-center text-[10px] text-muted-foreground">
        {WEEKDAY_LABELS.map((label, i) => (
          <div key={i}>{label}</div>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {days.map((day) => {
          const dateStr = toLocalDateString(day);
          const hasData = loggedDates.has(dateStr);

          return (
            <DayCell
              key={dateStr}
              day={day}
              dateStr={dateStr}
              isSelected={isSameDay(day, selected)}
              isToday={isSameDay(day, todayDate)}
              isFuture={isAfter(day, todayDate)}
              hasData={hasData}
              isSkipped={!hasData && skippedDates.has(dateStr)}
              onSelect={onSelect}
            />
          );
        })}
      </div>
    </div>
  );
}
