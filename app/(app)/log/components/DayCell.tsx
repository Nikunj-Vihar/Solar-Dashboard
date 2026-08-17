"use client";

import { format } from "date-fns";
import { cn } from "@/lib/utils";

// Shared by LogCalendar's month grid (desktop) and WeekStrip's row (mobile)
// so a logged/skipped/selected/today day looks identical in both places --
// a filled box for logged days rather than a small dot, since a full box is
// easier to spot at a glance than a 4px dot buried in the cell.
export function DayCell({
  day,
  dateStr,
  isSelected,
  isToday,
  isFuture,
  hasData,
  isSkipped,
  dimmed,
  onSelect,
}: {
  day: Date;
  dateStr: string;
  isSelected: boolean;
  isToday: boolean;
  isFuture: boolean;
  hasData: boolean;
  isSkipped: boolean;
  /** Out-of-month cell in the month grid -- not applicable to WeekStrip. */
  dimmed?: boolean;
  onSelect: (dateStr: string) => void;
}) {
  return (
    <button
      type="button"
      disabled={isFuture}
      onClick={() => onSelect(dateStr)}
      aria-label={format(day, "MMMM d, yyyy")}
      aria-current={isToday ? "date" : undefined}
      className={cn(
        "relative flex h-8 w-full items-center justify-center rounded-md border border-transparent text-xs transition-[background-color,color,border-color,transform] duration-150 active:scale-90",
        dimmed ? "text-muted-foreground/40" : "text-foreground",
        !dimmed && !isSelected && !isFuture && "hover:bg-secondary",
        hasData &&
          !isSelected &&
          "border-(--viz-status-good)/70 bg-(--viz-status-good)/10 font-medium text-(--viz-status-good)",
        isSkipped && !isSelected && "border-dashed border-muted-foreground/50",
        isSelected && "border-primary bg-primary font-semibold text-primary-foreground",
        hasData && isSelected && "ring-2 ring-(--viz-status-good) ring-offset-2 ring-offset-background",
        isToday && !isSelected && "ring-1 ring-inset ring-primary/50",
        isFuture && "cursor-not-allowed opacity-30 hover:bg-transparent",
      )}
    >
      {day.getDate()}
    </button>
  );
}
