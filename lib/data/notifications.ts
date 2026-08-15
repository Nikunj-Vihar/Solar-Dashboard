import "server-only";
import { createClient } from "@/lib/supabase/server";
import { todayInTimezone, addDays } from "@/lib/date";
import { getLoggedDatesForSite } from "./readings";
import { getMissedDatesThisMonth } from "@/lib/calc/missedDates";
import { RECENT_BASELINE_DEVIATION_DAYS } from "@/lib/calc/health";
import type { SiteWithInverters } from "./site";

export type NotificationItem = {
  /** Stable per underlying occurrence -- a still-ongoing condition keeps its
   * id (so dismissing it sticks), while a resolved-then-recurring alert or a
   * missed-days list that's grown gets a new one (so it resurfaces). */
  id: string;
  severity: "watch" | "needs_attention";
  message: string;
  detail?: string;
};

const SEVERITY_RANK: Record<NotificationItem["severity"], number> = {
  needs_attention: 0,
  watch: 1,
};

export async function getNotificationsForSite(site: SiteWithInverters): Promise<NotificationItem[]> {
  const supabase = await createClient();
  const today = todayInTimezone(site.timezone);

  const [{ logged, skipped }, { data: alertRows }, { data: dismissedRows }] = await Promise.all([
    getLoggedDatesForSite(site.id),
    supabase
      .from("alerts")
      .select("id, message, severity")
      .eq("site_id", site.id)
      .eq("is_resolved", false)
      .or(
        `alert_type.neq.baseline_deviation,reading_date.gte.${addDays(today, -RECENT_BASELINE_DEVIATION_DAYS)}`,
      )
      .order("created_at", { ascending: false }),
    supabase.from("dismissed_notifications").select("notification_id").eq("site_id", site.id),
  ]);

  const dismissed = new Set((dismissedRows ?? []).map((r) => r.notification_id));
  const items: NotificationItem[] = [];

  const missedDates = getMissedDatesThisMonth({ loggedDates: logged, skippedDates: skipped, today });
  if (missedDates.length > 0) {
    items.push({
      id: `missed-days:${missedDates.join(",")}`,
      severity: "watch",
      message:
        missedDates.length === 1
          ? "You missed a day this month"
          : `You missed ${missedDates.length} days this month`,
      detail: missedDates
        .map((d) => new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" }))
        .join(", "),
    });
  }

  for (const a of alertRows ?? []) {
    items.push({
      id: `alert:${a.id}`,
      severity: a.severity as NotificationItem["severity"],
      message: a.message,
    });
  }

  return items
    .filter((item) => !dismissed.has(item.id))
    .sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
}
