"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  addMonths,
  subMonths,
  isSameDay,
  isSameMonth,
  isAfter,
} from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DayCell } from "./DayCell";
import { parseLocalDateString, toLocalDateString } from "./dateGrid";

const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

export function LogCalendar({
  selectedDate,
  today,
  loggedDates,
  skippedDates,
  onSelect,
  /** Skips the Card wrapper -- used when this already sits inside another
   * boxed container (the mobile date-picker Dialog), so it isn't nested
   * inside two rings/corners at once. */
  bare = false,
}: {
  selectedDate: string;
  today: string;
  loggedDates: Set<string>;
  skippedDates: Set<string>;
  onSelect: (date: string) => void;
  bare?: boolean;
}) {
  // `selectedDate` only catches up once the ?date= navigation actually
  // completes (a real server round trip), which felt laggy/unresponsive --
  // clicking a day now highlights it immediately via this local override.
  // Cleared by adjusting state during render (React's documented pattern for
  // resetting state when a prop changes) rather than in a useEffect, which
  // would cost an extra render and risk a visible flash back to the old
  // selection before snapping to the new one.
  const [pendingDate, setPendingDate] = useState<string | null>(null);
  const [lastSelectedDate, setLastSelectedDate] = useState(selectedDate);
  if (selectedDate !== lastSelectedDate) {
    setLastSelectedDate(selectedDate);
    setPendingDate(null);
  }

  const displayedSelectedDate = pendingDate ?? selectedDate;
  const selected = parseLocalDateString(displayedSelectedDate);
  const todayDate = parseLocalDateString(today);
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(selected));

  function handleSelect(dateStr: string) {
    setPendingDate(dateStr);
    onSelect(dateStr);
  }

  const gridStart = startOfWeek(startOfMonth(viewMonth));
  const gridEnd = endOfWeek(endOfMonth(viewMonth));
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const content = (
    <>
      <div className="mb-2 flex items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => setViewMonth((m) => subMonths(m, 1))}
          aria-label="Previous month"
        >
          <ChevronLeft className="size-4" />
        </Button>
        <p className="text-sm font-medium">{format(viewMonth, "MMMM yyyy")}</p>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => setViewMonth((m) => addMonths(m, 1))}
          aria-label="Next month"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
      <div className="grid grid-cols-7 text-center text-[11px] text-muted-foreground">
        {WEEKDAY_LABELS.map((label, i) => (
          <div key={i} className="py-1">
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
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
              dimmed={!isSameMonth(day, viewMonth)}
              onSelect={handleSelect}
            />
          );
        })}
      </div>
    </>
  );

  if (bare) return content;

  return (
    <Card>
      <CardContent className="pt-4">{content}</CardContent>
    </Card>
  );
}
