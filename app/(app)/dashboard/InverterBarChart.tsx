"use client";

import { useState } from "react";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { findUnderperformingInverter } from "@/lib/calc/health";
import { formatKwh } from "@/lib/format";

type Period = "today" | "month";

export function InverterBarChart({
  today,
  month,
}: {
  today: { inverterId: string; name: string; kwh: number; noReading: boolean }[];
  month: { inverterId: string; name: string; kwh: number }[];
}) {
  const [period, setPeriod] = useState<Period>("today");
  const data = period === "today" ? today : month;

  // The "meaningfully behind the others" comparison is only a same-day
  // fault signal (spec §5's reasoning): a lagging month total is just as
  // likely to mean "added partway through the month" as "something's
  // wrong", so it's only computed/shown for the today view. An inverter
  // explicitly marked "no reading" today has no real number to compare --
  // excluding it means it's never flagged just for having nothing logged.
  const underperformingId =
    period === "today"
      ? findUnderperformingInverter(today.filter((d) => !d.noReading))
      : null;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">By inverter</CardTitle>
        <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)}>
          <TabsList>
            <TabsTrigger value="today">Today</TabsTrigger>
            <TabsTrigger value="month">This month</TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent>
        {underperformingId && (
          <div className="mb-3 flex items-center gap-1.5 text-sm text-(--viz-status-warning)">
            <AlertTriangle className="size-4 shrink-0" />
            <span>
              {data.find((d) => d.inverterId === underperformingId)?.name} is generating
              noticeably less than the others today.
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
