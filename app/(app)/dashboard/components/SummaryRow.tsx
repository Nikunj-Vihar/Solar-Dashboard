import { CheckCircle2, AlertTriangle, AlertOctagon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { InfoTooltip } from "@/components/InfoTooltip";
import { computeVsBaselinePercent } from "@/lib/calc/kpis";
import { formatKwh, formatPercent } from "@/lib/format";
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

// A ratio-against-a-target reads better as a filled meter than as another
// bare number -- the track is a lighter step of the same hue as the fill
// (rather than a generic gray) so the bar communicates state on its own.
function MeterTile({
  label,
  percent,
  info,
}: {
  label: string;
  percent: number | null;
  info?: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="flex items-center gap-1 text-sm text-muted-foreground">
          {label}
          {info && <InfoTooltip>{info}</InfoTooltip>}
        </p>
        <p className="mt-1 text-2xl font-semibold">
          {percent === null ? "—" : formatPercent(percent)}
        </p>
        <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-(--viz-series-1)/15">
          <div
            className="h-full rounded-full bg-(--viz-series-1) transition-[width] duration-300"
            style={{ width: `${percent === null ? 0 : Math.max(0, Math.min(percent, 100))}%` }}
          />
        </div>
      </CardContent>
    </Card>
  );
}

export function SummaryRow({
  rangeKwh,
  rangeExpectedMidKwh,
  rangeAvgPerDayKwh,
  lifetimeKwh,
  healthStatus,
  healthReason,
}: {
  rangeKwh: number;
  rangeExpectedMidKwh: number | null;
  rangeAvgPerDayKwh: number;
  lifetimeKwh: number;
  healthStatus: HealthStatus;
  healthReason: string | null;
}) {
  const health = HEALTH_CONFIG[healthStatus];
  const HealthIcon = health.icon;
  const vsBaseline =
    rangeExpectedMidKwh !== null ? computeVsBaselinePercent(rangeKwh, rangeExpectedMidKwh) : null;
  const vsBaselineRatio = vsBaseline !== null ? vsBaseline + 100 : null;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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
      <MeterTile
        label="vs Expected"
        percent={vsBaselineRatio}
        info={
          <>
            <p>
              Actual generation for the selected period as a share of the expected baseline for
              those days (100% = right on target).
            </p>
            <p className="mt-2">
              The baseline itself: each month&apos;s average daily solar irradiance for your
              site&apos;s coordinates (a 20-year historical average from NASA&apos;s POWER
              dataset, fetched once at setup) × your total installed DC capacity × an assumed
              75% performance ratio -- the typical efficiency loss from panel heat, wiring,
              inverter conversion, and the like. An estimate, not a guarantee.
            </p>
          </>
        }
      />
    </div>
  );
}
