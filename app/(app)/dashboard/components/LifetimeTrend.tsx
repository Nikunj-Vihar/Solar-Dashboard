"use client";

import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoTooltip } from "@/components/InfoTooltip";
import { buildTrendData, densifyDailyTotals } from "@/lib/calc/trend";
import { formatKwh } from "@/lib/format";

export function LifetimeTrend({
  readings,
  today,
}: {
  readings: { date: string; kwh: number | null }[];
  today: string;
}) {
  const chartData = useMemo(() => {
    if (readings.length === 0) return [];
    const earliest = readings.reduce((min, r) => (r.date < min ? r.date : min), today);
    const dense = densifyDailyTotals(readings, earliest, today);
    // No baseline here on purpose -- this is meant as a simple, zoomed-out
    // "every month since the start" total, distinct from the Generation
    // trend chart above, which compares a recent window against baseline.
    return buildTrendData(dense, [], "month");
  }, [readings, today]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-1 text-base">
          Lifetime by month
          <InfoTooltip>
            Total generation for every calendar month since this site started logging, however
            far back that goes — unlike the Generation trend chart above, which only shows a
            recent rolling window.
          </InfoTooltip>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <div className="flex h-56 items-center justify-center text-center text-sm text-muted-foreground">
            Log a few readings to see this view.
          </div>
        ) : (
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                  tickLine={false}
                  axisLine={{ stroke: "var(--border)" }}
                  minTickGap={16}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                  tickLine={false}
                  axisLine={false}
                  width={40}
                />
                <Tooltip
                  cursor={{ fill: "var(--muted)" }}
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-md)",
                    fontSize: 12,
                  }}
                  formatter={(value) => [
                    value === null ? "No reading" : formatKwh(Number(value)),
                    "Generated",
                  ]}
                />
                <Bar
                  dataKey="actualKwh"
                  fill="var(--viz-series-1)"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={48}
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
