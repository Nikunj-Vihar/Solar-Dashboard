import { AlertOctagon, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Alert = {
  id: string;
  message: string;
  severity: "watch" | "needs_attention";
};

export function AlertsList({ alerts }: { alerts: Alert[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Alerts</CardTitle>
      </CardHeader>
      <CardContent>
        {alerts.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="size-4 text-(--viz-status-good)" />
            No alerts — everything looks normal.
          </div>
        ) : (
          <ul className="space-y-2">
            {alerts.map((alert) => {
              const Icon = alert.severity === "needs_attention" ? AlertOctagon : AlertTriangle;
              const colorClass =
                alert.severity === "needs_attention"
                  ? "text-(--viz-status-critical)"
                  : "text-(--viz-status-warning)";
              return (
                <li key={alert.id} className={`flex items-start gap-2 text-sm ${colorClass}`}>
                  <Icon className="mt-0.5 size-4 shrink-0" />
                  <span className="text-foreground">{alert.message}</span>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
