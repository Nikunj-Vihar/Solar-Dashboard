import { CheckCircle2, AlertTriangle, AlertOctagon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
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

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-sm text-muted-foreground">{label}</p>
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
      <StatTile label="Today" value={formatKwh(todayKwh)} />
      <StatTile label="This month" value={formatKwh(monthKwh)} />
      <StatTile label="Lifetime" value={formatKwh(lifetimeKwh)} />
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">Health status</p>
          <p className={`mt-1 flex items-center gap-1.5 text-2xl font-semibold ${health.className}`}>
            <HealthIcon className="size-5" />
            {health.label}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
