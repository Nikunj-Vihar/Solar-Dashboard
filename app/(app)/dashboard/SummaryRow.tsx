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
    className: "text-[--viz-status-good]",
  },
  watch: {
    label: "Watch",
    icon: AlertTriangle,
    className: "text-[--viz-status-warning]",
  },
  needs_attention: {
    label: "Needs Attention",
    icon: AlertOctagon,
    className: "text-[--viz-status-critical]",
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
  todayKwh,
  monthKwh,
  lifetimeKwh,
  healthStatus,
}: {
  todayKwh: number;
  monthKwh: number;
  lifetimeKwh: number;
  healthStatus: HealthStatus;
}) {
  const health = HEALTH_CONFIG[healthStatus];
  const HealthIcon = health.icon;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <StatTile
        label="Today"
        value={formatKwh(todayKwh)}
        info="Total generation across all active inverters so far today."
      />
      <StatTile
        label="This month"
        value={formatKwh(monthKwh)}
        info="Total generation across all active inverters this calendar month."
      />
      <StatTile
        label="Lifetime"
        value={formatKwh(lifetimeKwh)}
        info="Every reading ever logged for this site, added up."
      />
      <Card>
        <CardContent className="pt-6">
          <p className="flex items-center gap-1 text-sm text-muted-foreground">
            Health status
            <InfoTooltip>
              Good: no active alerts. Watch: one or more inverters are underperforming versus
              their own recent average, or total generation is off from the expected baseline.
              Needs attention: a flagged issue hasn&apos;t been resolved — check the alerts below.
            </InfoTooltip>
          </p>
          <p className={`mt-1 flex items-center gap-1.5 text-2xl font-semibold ${health.className}`}>
            <HealthIcon className="size-5" />
            {health.label}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
