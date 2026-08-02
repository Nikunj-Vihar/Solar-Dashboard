"use client";

import { useMemo } from "react";
import { startOfWeek, addDays as addDaysFns, isSameMonth, format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoTooltip } from "@/components/InfoTooltip";
import { densifyDailyTotals } from "@/lib/calc/trend";
import { formatKwh } from "@/lib/format";
import { cn } from "@/lib/utils";

const LOOKBACK_DAYS = 182; // ~26 weeks, a GitHub-style "last 6 months" view

// Single hue (--viz-series-1), light to dark via opacity -- a sequential
// scale for magnitude, per this app's color conventions. Level 0 is "no
// data" (never logged, or every inverter marked no reading that day), not
// the bottom of the color scale, so a quiet day doesn't visually read the
// same as a real, confirmed slow one.
const LEVEL_CLASSES = [
  "bg-muted",
  "bg-(--viz-series-1)/20",
  "bg-(--viz-series-1)/45",
  "bg-(--viz-series-1)/70",
  "bg-(--viz-series-1)",
];

function levelFor(kwh: number, maxKwh: number): number {
  if (maxKwh <= 0) return 1;
  return Math.max(1, Math.min(4, Math.ceil((kwh / maxKwh) * 4)));
}

// Parsed/formatted in local time throughout, consistent with LogCalendar --
// this grid only ever compares its own Date objects against each other and
// against date-fns' own local-time output, never against a UTC-anchored
// string, so there's no timezone pitfall to worry about here.
function parseDateString(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

type Cell = { dateStr: string; date: Date; kwh: number | null } | null;

export function GenerationHeatmap({
  readings,
  today,
}: {
  readings: { date: string; kwh: number | null }[];
  today: string;
}) {
  const { weeks, monthLabels, maxKwh, hasAnyData } = useMemo(() => {
    const todayDate = parseDateString(today);
    const start = startOfWeek(addDaysFns(todayDate, -LOOKBACK_DAYS));
    const startStr = format(start, "yyyy-MM-dd");

    const dense = densifyDailyTotals(readings, startStr, today);
    const cells: Cell[] = dense.map((d) => ({
      dateStr: d.date,
      date: parseDateString(d.date),
      kwh: d.totalKwh,
    }));
    // Pad the final (current, partial) week out to 7 so the grid stays a
    // clean rectangle instead of a short last column.
    const trailing = cells.length % 7;
    if (trailing !== 0) {
      cells.push(...Array<Cell>(7 - trailing).fill(null));
    }

    const weeks: Cell[][] = [];
    for (let i = 0; i < cells.length; i += 7) {
      weeks.push(cells.slice(i, i + 7));
    }

    const monthLabels = weeks.map((week, i) => {
      const firstReal = week.find((c) => c !== null);
      if (!firstReal) return null;
      const prevWeek = weeks[i - 1];
      const prevFirstReal = prevWeek?.find((c) => c !== null);
      const isNewMonth = !prevFirstReal || !isSameMonth(firstReal.date, prevFirstReal.date);
      return isNewMonth ? format(firstReal.date, "MMM") : null;
    });

    const values = dense
      .map((d) => d.totalKwh)
      .filter((v): v is number => v !== null);
    const maxKwh = values.length > 0 ? Math.max(...values) : 0;

    return { weeks, monthLabels, maxKwh, hasAnyData: values.length > 0 };
  }, [readings, today]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-1 text-base">
          Daily generation
          <InfoTooltip>
            Each square is one day, colored by how much was generated relative to your best day
            in this window. Blank squares are days with no reading logged, or explicitly marked
            &quot;no reading&quot; -- not confirmed zero generation.
          </InfoTooltip>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!hasAnyData ? (
          <div className="flex h-32 items-center justify-center text-center text-sm text-muted-foreground">
            Log a few readings to see this view.
          </div>
        ) : (
          <div className="overflow-x-auto pb-1">
            <div className="inline-flex gap-[3px]">
              {weeks.map((week, i) => (
                <div key={i} className="flex flex-col gap-[3px]">
                  <div className="h-3.5 text-[10px] leading-none text-muted-foreground">
                    {monthLabels[i] ?? ""}
                  </div>
                  {week.map((cell, j) =>
                    cell === null ? (
                      <div key={j} className="size-3.5" />
                    ) : (
                      <div
                        key={cell.dateStr}
                        title={`${format(cell.date, "MMM d, yyyy")}: ${
                          cell.kwh === null ? "no reading" : formatKwh(cell.kwh)
                        }`}
                        className={cn(
                          "size-3.5 rounded-[3px]",
                          LEVEL_CLASSES[cell.kwh === null ? 0 : levelFor(cell.kwh, maxKwh)],
                        )}
                      />
                    ),
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="mt-3 flex items-center justify-end gap-1 text-[11px] text-muted-foreground">
          Less
          {LEVEL_CLASSES.map((cls, i) => (
            <div key={i} className={cn("size-3 rounded-[3px]", cls)} />
          ))}
          More
        </div>
      </CardContent>
    </Card>
  );
}
