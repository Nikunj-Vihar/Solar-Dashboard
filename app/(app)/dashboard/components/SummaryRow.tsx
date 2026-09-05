"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { InfoTooltip } from "@/components/InfoTooltip";
import { computeVsBaselinePercent } from "@/lib/calc/kpis";
import { formatKwh, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

function StatTile({
  label,
  value,
  info,
}: {
  label: string;
  value: string;
  info?: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="flex items-center gap-1 text-sm text-muted-foreground">
          {label}
          {info && <InfoTooltip>{info}</InfoTooltip>}
        </p>
        <p className="mt-1 text-2xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}

type CompareMode = "month" | "year";

// A ratio-against-a-target reads better as a filled meter than as another
// bare number -- the track is a lighter step of the same hue as the fill
// (rather than a generic gray) so the bar communicates state on its own.
// Defaults to "vs last month" since that's meaningful almost immediately;
// "vs last year" needs a full year of history, so it's opt-in via toggle.
function MeterTile({
  percentByMode,
  info,
}: {
  percentByMode: Record<CompareMode, number | null>;
  info?: React.ReactNode;
}) {
  const [mode, setMode] = useState<CompareMode>("month");
  const percent = percentByMode[mode];
  const label = mode === "month" ? "vs Last Month" : "vs Last Year";

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between gap-1">
          <p className="flex items-center gap-1 text-sm text-muted-foreground">
            {label}
            {info && <InfoTooltip>{info}</InfoTooltip>}
          </p>
          <div className="flex items-center gap-0.5 rounded-full bg-secondary p-0.5 text-[10px] leading-none">
            {(["month", "year"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                aria-pressed={mode === m}
                aria-label={m === "month" ? "Compare vs last month" : "Compare vs last year"}
                className={cn(
                  "rounded-full px-1.5 py-1 font-medium transition-colors",
                  mode === m
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {m === "month" ? "Mo" : "Yr"}
              </button>
            ))}
          </div>
        </div>
        <p className="mt-1 text-2xl font-semibold">
          {percent === null ? "—" : formatPercent(percent)}
        </p>
        <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-(--viz-series-1)/15">
          <div
            className="h-full rounded-full bg-(--viz-series-1) transition-[width] duration-300"
            style={{ width: `${percent === null ? 0 : Math.max(0, Math.min(percent, 100))}%` }}
          />
        </div>
      </CardContent>
    </Card>
  );
}

export function SummaryRow({
  rangeKwh,
  rangeLastMonthKwh,
  rangeLastYearKwh,
  rangeAvgPerDayKwh,
  lifetimeKwh,
}: {
  rangeKwh: number;
  rangeLastMonthKwh: number | null;
  rangeLastYearKwh: number | null;
  rangeAvgPerDayKwh: number;
  lifetimeKwh: number;
}) {
  const vsLastMonth =
    rangeLastMonthKwh !== null ? computeVsBaselinePercent(rangeKwh, rangeLastMonthKwh) : null;
  const vsLastYear =
    rangeLastYearKwh !== null ? computeVsBaselinePercent(rangeKwh, rangeLastYearKwh) : null;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <StatTile
        label="Lifetime"
        value={formatKwh(lifetimeKwh)}
        info="Every reading ever logged for this site, added up -- not affected by the date filter above."
      />
      <StatTile
        label="Avg / day"
        value={formatKwh(rangeAvgPerDayKwh)}
        info="Selected-period total divided by the number of calendar days in that period."
      />
      <MeterTile
        percentByMode={{
          month: vsLastMonth !== null ? vsLastMonth + 100 : null,
          year: vsLastYear !== null ? vsLastYear + 100 : null,
        }}
        info={
          <>
            <p>
              Actual generation for the selected period as a share of what this site generated in
              this same date range one month or one year earlier (100% = right on target) --
              toggle Mo/Yr above to switch. Entirely from your own logged readings, no outside
              data source.
            </p>
            <p className="mt-2">
              Shows &quot;—&quot; when there isn&apos;t yet a matching period that far back to
              compare against.
            </p>
          </>
        }
      />
    </div>
  );
}
