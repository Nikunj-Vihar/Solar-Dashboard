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
import { cn } from "@/lib/utils";

const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

// Parsed/formatted in local time throughout -- this grid only ever compares
// its own Date objects against each other (never against a UTC-anchored
// string), so there's no timezone pitfall to worry about here.
function parseDateString(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function toDateString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function LogCalendar({
  selectedDate,
  today,
  loggedDates,
  onSelect,
}: {
  selectedDate: string;
  today: string;
  loggedDates: Set<string>;
  onSelect: (date: string) => void;
}) {
  const selected = parseDateString(selectedDate);
  const todayDate = parseDateString(today);
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(selected));

  const gridStart = startOfWeek(startOfMonth(viewMonth));
  const gridEnd = endOfWeek(endOfMonth(viewMonth));
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  return (
    <Card>
      <CardContent className="pt-4">
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
            const dateStr = toDateString(day);
            const inMonth = isSameMonth(day, viewMonth);
            const isSelected = isSameDay(day, selected);
            const isToday = isSameDay(day, todayDate);
            const isFuture = isAfter(day, todayDate);
            const hasData = loggedDates.has(dateStr);

            return (
              <button
                key={dateStr}
                type="button"
                disabled={isFuture}
                onClick={() => onSelect(dateStr)}
                aria-label={format(day, "MMMM d, yyyy")}
                aria-current={isToday ? "date" : undefined}
                className={cn(
                  "relative flex h-8 w-full flex-col items-center justify-center rounded-md text-xs transition-colors",
                  !inMonth && "text-muted-foreground/40",
                  inMonth && !isSelected && !isFuture && "text-foreground hover:bg-secondary",
                  isSelected && "bg-primary font-medium text-primary-foreground",
                  isToday && !isSelected && "ring-1 ring-inset ring-primary/50",
                  isFuture && "cursor-not-allowed opacity-30 hover:bg-transparent",
                )}
              >
                {day.getDate()}
                {hasData && (
                  <span
                    className={cn(
                      "absolute bottom-0.5 size-1 rounded-full",
                      isSelected ? "bg-primary-foreground" : "bg-[--viz-status-good]",
                    )}
                  />
                )}
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
