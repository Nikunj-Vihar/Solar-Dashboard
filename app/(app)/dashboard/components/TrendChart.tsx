"use client";

import { useMemo, useState, useTransition } from "react";
import {
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
import { buildTrendData, densifyDailyTotals, type TrendGranularity } from "@/lib/calc/trend";
import { formatKwh } from "@/lib/format";

const WINDOW_BY_GRANULARITY: Record<TrendGranularity, number> = {
  day: 30,
  week: 12, // ~90 days
  month: 12,
};

type TrendTooltipPoint = {
  label: string;
  actualKwh: number | null;
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

  return (
    <div className="max-w-56 rounded-md border bg-popover px-3 py-2 text-xs shadow-sm">
      <p className="mb-1 font-medium text-foreground">{point.label}</p>
      <p className="flex items-center gap-1.5 text-foreground">
        <span className="inline-block h-0.5 w-3 rounded-full bg-(--viz-series-1)" />
        Actual: {point.actualKwh === null ? "No reading" : formatKwh(point.actualKwh)}
      </p>
    </div>
  );
}

export function TrendChart({
  readings,
  range,
}: {
  readings: { date: string; kwh: number | null }[];
  range: { from: string; to: string };
}) {
  const [granularity, setGranularity] = useState<TrendGranularity>("day");
  // Marking the switch as a transition lets the tab's own active state update
  // immediately on click (feels instant) while the heavier chart re-render
  // is treated as lower-priority -- isPending then drives a brief fade
  // instead of a click-to-repaint freeze.
  const [isPending, startTransition] = useTransition();

  const chartData = useMemo(() => {
    if (readings.length === 0) return [];
    // Windowed to the selected date-range filter, then still capped per
    // granularity (below) so a long range like "Lifetime" doesn't render
    // hundreds of daily points -- for that full-history view, see the
    // Lifetime by month chart instead.
    const dense = densifyDailyTotals(readings, range.from, range.to);
    const bucketed = buildTrendData(dense, granularity);
    const windowSize = WINDOW_BY_GRANULARITY[granularity];
    return bucketed.slice(-windowSize);
  }, [readings, granularity, range.from, range.to]);

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
