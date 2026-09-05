import { CheckCircle2, AlertTriangle, AlertOctagon, TrendingUp, TrendingDown } from "lucide-react";
import { InfoTooltip } from "@/components/InfoTooltip";
import { formatKwh, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { HealthStatus } from "@/lib/calc/health";

const HEALTH_CONFIG: Record<
  HealthStatus,
  { label: string; icon: typeof CheckCircle2; className: string }
> = {
  good: { label: "Good", icon: CheckCircle2, className: "text-(--viz-status-good)" },
  watch: { label: "Watch", icon: AlertTriangle, className: "text-(--viz-status-warning)" },
  needs_attention: {
    label: "Needs Attention",
    icon: AlertOctagon,
    className: "text-(--viz-status-critical)",
  },
};

export function DashboardHero({
  rangeLabel,
  rangeKwh,
  vsLastMonthPercent,
  healthStatus,
  healthReason,
}: {
  rangeLabel: string;
  rangeKwh: number;
  vsLastMonthPercent: number | null;
  healthStatus: HealthStatus;
  healthReason: string | null;
}) {
  const health = HEALTH_CONFIG[healthStatus];
  const HealthIcon = health.icon;

  return (
    <div className="rounded-2xl border border-border bg-gradient-to-br from-primary/12 via-primary/5 to-transparent p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{rangeLabel}</p>
          <p className="mt-1 text-4xl font-semibold tracking-tight sm:text-5xl">
            {formatKwh(rangeKwh)}
          </p>
          {vsLastMonthPercent !== null && (
            <p
              className={cn(
                "mt-2 flex items-center gap-1 text-sm",
                vsLastMonthPercent >= 0 ? "text-(--viz-status-good)" : "text-muted-foreground",
              )}
            >
              {vsLastMonthPercent >= 0 ? (
                <TrendingUp className="size-3.5" />
              ) : (
                <TrendingDown className="size-3.5" />
              )}
              {formatPercent(vsLastMonthPercent, { showSign: true })} vs last month
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-1.5 rounded-full border border-border bg-background/80 px-3 py-1.5 text-sm font-medium backdrop-blur-sm">
            <HealthIcon className={cn("size-4", health.className)} />
            <span className={health.className}>{health.label}</span>
            <InfoTooltip>
              Good: nothing flagged. Watch: one or more inverters (or the site as a whole) are
              underperforming versus their own recent average, or a reading hasn&apos;t been
              logged in a couple of days. Needs attention: a flagged issue hasn&apos;t cleared up
              yet. Always reflects current condition, regardless of the date filter above.
            </InfoTooltip>
          </div>
          {healthReason && (
            <p className="max-w-56 truncate text-right text-xs text-muted-foreground" title={healthReason}>
              {healthReason}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
