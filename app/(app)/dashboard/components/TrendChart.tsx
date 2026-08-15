"use client";

import { useMemo, useState, useTransition } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InfoTooltip } from "@/components/InfoTooltip";
import {
  buildTrendData,
  densifyDailyTotals,
  type MonthlyBaselineRow,
  type TrendGranularity,
} from "@/lib/calc/trend";
import { formatKwh } from "@/lib/format";
import { SKY_CONDITION_LABELS, type SkyCondition } from "@/lib/validation/schemas";

export type DailyClimate = {
  date: string;
  skyCondition: SkyCondition | null;
  note: string | null;
  avgDailyIrradianceKwhPerM2: number | null;
  cloudAmtPct: number | null;
  temperatureC: number | null;
  precipitationMm: number | null;
};

const WINDOW_BY_GRANULARITY: Record<TrendGranularity, number> = {
  day: 30,
  week: 12, // ~90 days
  month: 12,
};

type TrendTooltipPoint = {
  label: string;
  actualKwh: number | null;
  expectedLowKwh: number;
  expectedHighKwh: number;
  climate: DailyClimate | null;
};

function TrendTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: TrendTooltipPoint }[];
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  const climate = point.climate;
  const hasWeatherNumbers =
    climate &&
    (climate.avgDailyIrradianceKwhPerM2 !== null ||
      climate.cloudAmtPct !== null ||
      climate.temperatureC !== null ||
      climate.precipitationMm !== null);

  return (
    <div className="max-w-56 rounded-md border bg-popover px-3 py-2 text-xs shadow-sm">
      <p className="mb-1 font-medium text-foreground">{point.label}</p>
      <p className="flex items-center gap-1.5 text-foreground">
        <span className="inline-block h-0.5 w-3 rounded-full bg-(--viz-series-1)" />
        Actual: {point.actualKwh === null ? "No reading" : formatKwh(point.actualKwh)}
      </p>
      <p className="mt-0.5 text-muted-foreground">
        Expected: {formatKwh(point.expectedLowKwh)} – {formatKwh(point.expectedHighKwh)}
      </p>
      {climate?.skyCondition && (
        <p className="mt-1.5 border-t pt-1.5 text-foreground">
          Sky: {SKY_CONDITION_LABELS[climate.skyCondition]}
          {climate.note && <span className="text-muted-foreground"> — {climate.note}</span>}
        </p>
      )}
      {hasWeatherNumbers && (
        <p className={`text-muted-foreground ${climate?.skyCondition ? "mt-0.5" : "mt-1.5 border-t pt-1.5"}`}>
          {climate!.avgDailyIrradianceKwhPerM2 !== null &&
            `${climate!.avgDailyIrradianceKwhPerM2} kWh/m² irradiance`}
          {climate!.temperatureC !== null && ` · ${climate!.temperatureC}°C`}
          {climate!.precipitationMm !== null &&
            climate!.precipitationMm > 0 &&
            ` · ${climate!.precipitationMm}mm rain`}
        </p>
      )}
    </div>
  );
}

export function TrendChart({
  readings,
  baseline,
  range,
  dailyClimate = [],
}: {
  readings: { date: string; kwh: number | null }[];
  baseline: MonthlyBaselineRow[];
  range: { from: string; to: string };
  dailyClimate?: DailyClimate[];
}) {
  const [granularity, setGranularity] = useState<TrendGranularity>("day");
  // Marking the switch as a transition lets the tab's own active state update
  // immediately on click (feels instant) while the heavier chart re-render
  // is treated as lower-priority -- isPending then drives a brief fade
  // instead of a click-to-repaint freeze.
  const [isPending, startTransition] = useTransition();

  const climateByDate = useMemo(
    () => new Map(dailyClimate.map((c) => [c.date, c])),
    [dailyClimate],
  );

  const chartData = useMemo(() => {
    if (readings.length === 0) return [];
    // Windowed to the selected date-range filter, then still capped per
    // granularity (below) so a long range like "Lifetime" doesn't render
    // hundreds of daily points -- for that full-history view, see the
    // Lifetime by month chart instead.
    const dense = densifyDailyTotals(readings, range.from, range.to);
    const bucketed = buildTrendData(dense, baseline, granularity);
    const windowSize = WINDOW_BY_GRANULARITY[granularity];
    return bucketed.slice(-windowSize).map((p) => ({
      ...p,
      bandHeight: Math.max(p.expectedHighKwh - p.expectedLowKwh, 0),
      // Only meaningful at "day" granularity -- a week/month bucket spans
      // many calendar days, so no single climate entry applies to it.
      climate: granularity === "day" ? (climateByDate.get(p.date) ?? null) : null,
    }));
  }, [readings, baseline, granularity, range.from, range.to, climateByDate]);

  const hasEnoughData = chartData.length >= 3;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Generation trend</CardTitle>
        <Tabs
          value={granularity}
          onValueChange={(v) =>
            startTransition(() => setGranularity(v as TrendGranularity))
          }
        >
          <TabsList>
            <TabsTrigger value="day">Day</TabsTrigger>
            <TabsTrigger value="week">Week</TabsTrigger>
            <TabsTrigger value="month">Month</TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent>
        {!hasEnoughData ? (
          <div className="flex h-56 items-center justify-center text-center text-sm text-muted-foreground">
            Log a few more days to see your generation trend here.
          </div>
        ) : (
          <>
            <div className="mb-2 flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-0.5 w-3 rounded-full bg-(--viz-series-1)" />
                Actual
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block size-2.5 rounded-sm bg-(--viz-series-1) opacity-15" />
                Expected range
                <InfoTooltip>
                  A low/mid/high generation estimate for each period, computed from your site&apos;s
                  solar irradiance (via NASA&apos;s POWER dataset) and installed capacity — not a
                  guarantee, just a plausible range to compare against.
                </InfoTooltip>
              </span>
            </div>
            <div
              className={`h-56 transition-opacity duration-150 ${isPending ? "opacity-50" : "opacity-100"}`}
            >
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
                  <CartesianGrid vertical={false} stroke="var(--border)" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                    tickLine={false}
                    axisLine={{ stroke: "var(--border)" }}
                    minTickGap={24}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                    tickLine={false}
                    axisLine={false}
                    width={40}
                  />
                  <Tooltip cursor={{ stroke: "var(--border)" }} content={<TrendTooltip />} />
                  <Area
                    dataKey="expectedLowKwh"
                    stackId="band"
                    stroke="none"
                    fill="transparent"
                    isAnimationActive={false}
                  />
                  <Area
                    dataKey="bandHeight"
                    stackId="band"
                    stroke="none"
                    fill="var(--viz-band)"
                    fillOpacity={0.12}
                    isAnimationActive={false}
                    name="Expected range"
                  />
                  <Line
                    dataKey="actualKwh"
                    stroke="var(--viz-series-1)"
                    strokeWidth={2}
                    dot={false}
                    connectNulls={false}
                    isAnimationActive={false}
                    name="Actual"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
