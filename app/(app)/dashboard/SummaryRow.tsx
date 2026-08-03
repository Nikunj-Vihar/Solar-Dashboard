import { CheckCircle2, AlertTriangle, AlertOctagon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { InfoTooltip } from "@/components/InfoTooltip";
import { formatKwh } from "@/lib/format";
import type { HealthStatus } from "@/lib/calc/health";

const HEALTH_CONFIG: Record<
  HealthStatus,
  { label: string; icon: typeof CheckCircle2; className: string }
> = {
  good: {
    label: "Good",
    icon: CheckCircle2,
    className: "text-(--viz-status-good)",
  },
  watch: {
    label: "Watch",
    icon: AlertTriangle,
    className: "text-(--viz-status-warning)",
  },
  needs_attention: {
    label: "Needs Attention",
    icon: AlertOctagon,
    className: "text-(--viz-status-critical)",
  },
};

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

export function SummaryRow({
  rangeKwh,
  rangeAvgPerDayKwh,
  rangeLabel,
  lifetimeKwh,
  healthStatus,
  healthReason,
}: {
  rangeKwh: number;
  rangeAvgPerDayKwh: number;
  rangeLabel: string;
  lifetimeKwh: number;
  healthStatus: HealthStatus;
  healthReason: string | null;
}) {
  const health = HEALTH_CONFIG[healthStatus];
  const HealthIcon = health.icon;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <StatTile
        label="Generated"
        value={formatKwh(rangeKwh)}
        info={`Total generation across all active inverters for the selected period (${rangeLabel}).`}
      />
      <StatTile
        label="Avg / day"
        value={formatKwh(rangeAvgPerDayKwh)}
        info="Selected-period total divided by the number of calendar days in that period."
      />
      <StatTile
        label="Lifetime"
        value={formatKwh(lifetimeKwh)}
        info="Every reading ever logged for this site, added up -- not affected by the date filter above."
      />
      <Card>
        <CardContent className="pt-6">
          <p className="flex items-center gap-1 text-sm text-muted-foreground">
            Health status
            <InfoTooltip>
              Good: nothing flagged. Watch: one or more inverters are underperforming versus
              their own recent average, a reading hasn&apos;t been logged in a couple of days, or
              total generation was off from the expected baseline in the last few days. Needs
              attention: a flagged issue hasn&apos;t cleared up yet. Always reflects current
              condition, regardless of the date filter above.
            </InfoTooltip>
          </p>
          <p className={`mt-1 flex items-center gap-1.5 text-2xl font-semibold ${health.className}`}>
            <HealthIcon className="size-5" />
            {health.label}
          </p>
          {healthReason && (
            <p className="mt-1 truncate text-xs text-muted-foreground" title={healthReason}>
              {healthReason}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
