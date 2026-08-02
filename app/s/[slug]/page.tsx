import type { Metadata } from "next";
import { Sun, CheckCircle2, AlertTriangle, AlertOctagon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatKwh } from "@/lib/format";
import { PublicInverterBarChart, PublicTrendChart } from "./PublicCharts";

export const metadata: Metadata = {
  title: "Shared dashboard — Solar Dashboard",
  robots: { index: false, follow: false },
};

type PublicDashboardData = {
  site_name: string;
  today_kwh: number;
  month_kwh: number;
  lifetime_kwh: number;
  per_inverter_today: { name: string; kwh: number }[];
  trend_90d: { date: string; kwh: number | null }[];
  health_status: "Good" | "Watch" | "Needs Attention";
};

const HEALTH_CONFIG = {
  Good: { icon: CheckCircle2, className: "text-(--viz-status-good)" },
  Watch: { icon: AlertTriangle, className: "text-(--viz-status-warning)" },
  "Needs Attention": { icon: AlertOctagon, className: "text-(--viz-status-critical)" },
} as const;

export default async function PublicDashboardPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_public_dashboard", { p_slug: slug });
  const dashboard = data as PublicDashboardData | null;

  if (!dashboard) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-2 p-4 text-center">
        <Sun className="size-8 text-muted-foreground" />
        <h1 className="text-lg font-semibold">Link not found</h1>
        <p className="text-sm text-muted-foreground">
          This share link is invalid or is no longer public.
        </p>
      </div>
    );
  }

  const health = HEALTH_CONFIG[dashboard.health_status];
  const HealthIcon = health.icon;

  return (
    <div className="min-h-svh bg-muted/20">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <Sun className="size-5 text-amber-500" />
            <span className="font-semibold">{dashboard.site_name}</span>
          </div>
          <span className="rounded-full bg-secondary px-2.5 py-1 text-xs text-secondary-foreground">
            Public view — read only
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-4 p-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Today" value={formatKwh(dashboard.today_kwh)} />
          <StatTile label="This month" value={formatKwh(dashboard.month_kwh)} />
          <StatTile label="Lifetime" value={formatKwh(dashboard.lifetime_kwh)} />
          <div className="rounded-lg border bg-card p-4">
            <p className="text-sm text-muted-foreground">Health status</p>
            <p className={`mt-1 flex items-center gap-1.5 text-xl font-semibold ${health.className}`}>
              <HealthIcon className="size-5" />
              {dashboard.health_status}
            </p>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-4">
          <h2 className="mb-3 text-base font-semibold">Today by inverter</h2>
          <PublicInverterBarChart data={dashboard.per_inverter_today} />
        </div>

        <div className="rounded-lg border bg-card p-4">
          <h2 className="mb-3 text-base font-semibold">Last 90 days</h2>
          {dashboard.trend_90d.length >= 3 ? (
            <PublicTrendChart data={dashboard.trend_90d} />
          ) : (
            <p className="py-12 text-center text-sm text-muted-foreground">
              Not enough history yet to show a trend.
            </p>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Shared read-only view — figures are estimates and update as new readings are logged.
        </p>
      </main>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}
