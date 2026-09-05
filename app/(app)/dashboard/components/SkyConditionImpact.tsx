import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoTooltip } from "@/components/InfoTooltip";
import type { SkyConditionImpactPoint } from "@/lib/calc/skyConditionImpact";
import { formatKwh } from "@/lib/format";

export function SkyConditionImpact({ data }: { data: SkyConditionImpactPoint[] }) {
  const max = Math.max(1, ...data.map((d) => d.avgKwh));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-1 text-base">
          Generation by sky condition
          <InfoTooltip>
            Average daily generation on days logged with each sky condition, across this
            site&apos;s full history (not just the range selected above). Conditions logged on
            only a few days will have a noisy average — the day count next to each one shows how
            much to trust it.
          </InfoTooltip>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="flex h-56 items-center justify-center text-center text-sm text-muted-foreground">
            Log the sky condition on the Log page to see this view.
          </div>
        ) : (
          <div className="space-y-3.5">
            {data.map((point) => (
              <div key={point.condition}>
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="font-medium">{point.label}</span>
                  <span className="text-muted-foreground">
                    {formatKwh(point.avgKwh)}/day avg · {point.dayCount}{" "}
                    {point.dayCount === 1 ? "day" : "days"}
                  </span>
                </div>
                <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-(--viz-series-1)/15">
                  <div
                    className="h-full rounded-full bg-(--viz-series-1) transition-[width] duration-300"
                    style={{ width: `${Math.max(0, Math.min((point.avgKwh / max) * 100, 100))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
