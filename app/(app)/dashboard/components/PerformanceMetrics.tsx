import { Card, CardContent } from "@/components/ui/card";
import { InfoTooltip } from "@/components/InfoTooltip";
import { formatKwh, formatShortDate } from "@/lib/format";

export function PerformanceMetrics({
  activeAlertsCount,
  bestDay,
}: {
  activeAlertsCount: number;
  bestDay: { date: string; kwh: number } | null;
}) {
  return (
    <>
      <Card>
        <CardContent className="pt-6">
          <p className="flex items-center gap-1 text-sm text-muted-foreground">
            Active alerts
            <InfoTooltip>
              Issues currently flagged for this site — an inverter (or the site as a whole)
              underperforming versus its own recent average, or a reading that hasn&apos;t been
              logged in a couple of days. Same signal as the Health status card above, as a count.
            </InfoTooltip>
          </p>
          <p className="mt-1 text-2xl font-semibold">{activeAlertsCount}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <p className="flex items-center gap-1 text-sm text-muted-foreground">
            Best day this period
            <InfoTooltip>
              The single highest-generating day within the date range selected above.
            </InfoTooltip>
          </p>
          <p className="mt-1 text-2xl font-semibold">{bestDay ? formatKwh(bestDay.kwh) : "—"}</p>
          {bestDay && <p className="mt-1 text-xs text-muted-foreground">{formatShortDate(bestDay.date)}</p>}
        </CardContent>
      </Card>
    </>
  );
}
