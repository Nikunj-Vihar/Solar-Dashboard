"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { findUnderperformingInverter } from "@/lib/calc/health";
import { formatKwh } from "@/lib/format";

export function InverterBarChart({
  data,
  singleDay,
}: {
  data: { inverterId: string; name: string; kwh: number; noReading: boolean }[];
  singleDay: boolean;
}) {
  // The "meaningfully behind the others" comparison is only a same-day
  // fault signal (spec §5's reasoning): a lagging multi-day total is just as
  // likely to mean "added partway through the period" as "something's
  // wrong", so it's only computed/shown when the selected range is a single
  // day. An inverter explicitly marked "no reading" that day has no real
  // number to compare -- excluding it means it's never flagged just for
  // having nothing logged.
  const underperformingId = singleDay
    ? findUnderperformingInverter(data.filter((d) => !d.noReading))
    : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">By inverter</CardTitle>
      </CardHeader>
      <CardContent>
        {underperformingId && (
          <div className="mb-3 flex items-center gap-1.5 text-sm text-(--viz-status-warning)">
            <AlertTriangle className="size-4 shrink-0" />
            <span>
              {data.find((d) => d.inverterId === underperformingId)?.name} is generating
              noticeably less than the others that day.
            </span>
          </div>
        )}
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="0" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                tickLine={false}
                axisLine={{ stroke: "var(--border)" }}
              />
              <YAxis
                tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                tickLine={false}
                axisLine={false}
                width={36}
              />
              <Tooltip
                cursor={{ fill: "var(--muted)" }}
                contentStyle={{
                  background: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-md)",
                  fontSize: 12,
                }}
                formatter={(value) => [formatKwh(Number(value)), "Generated"]}
              />
              <Bar dataKey="kwh" radius={[4, 4, 0, 0]} maxBarSize={48} isAnimationActive={false}>
                {data.map((entry) => (
                  <Cell
                    key={entry.inverterId}
                    fill={
                      entry.inverterId === underperformingId
                        ? "var(--viz-status-warning)"
                        : "var(--viz-series-1)"
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
