"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoTooltip } from "@/components/InfoTooltip";
import type { SkyConditionImpactPoint } from "@/lib/calc/skyConditionImpact";
import { formatKwh } from "@/lib/format";

function ImpactTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: SkyConditionImpactPoint }[];
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs shadow-sm">
      <p className="font-medium text-popover-foreground">{point.label}</p>
      <p className="text-muted-foreground">
        {formatKwh(point.avgKwh)}/day avg · {point.dayCount} {point.dayCount === 1 ? "day" : "days"}
      </p>
    </div>
  );
}

export function SkyConditionImpact({ data }: { data: SkyConditionImpactPoint[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-1 text-base">
          Generation by sky condition
          <InfoTooltip>
            Average daily generation on days logged with each sky condition, across this
            site&apos;s full history (not just the range selected above). Conditions logged on
            only a few days will have a noisy average — check the day count before reading too
            much into a single bar.
          </InfoTooltip>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="flex h-56 items-center justify-center text-center text-sm text-muted-foreground">
            Log the sky condition on the Log page to see this view.
          </div>
        ) : (
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                  tickLine={false}
                  axisLine={{ stroke: "var(--border)" }}
                  interval={0}
                  angle={-20}
                  textAnchor="end"
                  height={40}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                  tickLine={false}
                  axisLine={false}
                  width={36}
                />
                <Tooltip cursor={{ fill: "var(--muted)" }} content={<ImpactTooltip />} />
                <Bar
                  dataKey="avgKwh"
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
