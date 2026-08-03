export type HealthStatus = "good" | "watch" | "needs_attention";

export function computeHealthStatus(
  alerts: { severity: "watch" | "needs_attention" }[],
): HealthStatus {
  if (alerts.some((a) => a.severity === "needs_attention")) return "needs_attention";
  if (alerts.some((a) => a.severity === "watch")) return "watch";
  return "good";
}

/**
 * The one-line "why" shown next to the health badge -- the most severe
 * matching alert's own message, not a generic restatement of the status
 * name. Callers pass alerts already ordered most-recent-first, so among
 * equally severe alerts this picks the newest. Null for "good" (nothing to
 * explain).
 */
export function pickHealthReason<T extends { severity: "watch" | "needs_attention"; message: string }>(
  alerts: T[],
  status: HealthStatus,
): string | null {
  if (status === "good") return null;
  return alerts.find((a) => a.severity === status)?.message ?? null;
}

/**
 * A same-day visual signal for the per-inverter bar chart: since all 4
 * inverters sit under the same sun, one meaningfully behind the others
 * today is the clearest fault signal available (spec §5). This is a
 * lightweight today-only comparison, distinct from the persisted
 * trailing-7d-vs-30d alert in refresh_alerts (Phase 5) which drives the
 * alerts list.
 */
export function findUnderperformingInverter(
  perInverterToday: { inverterId: string; kwh: number }[],
): string | null {
  if (perInverterToday.length < 2) return null;

  const total = perInverterToday.reduce((sum, i) => sum + i.kwh, 0);
  if (total <= 0) return null;

  const worst = perInverterToday.reduce((min, i) => (i.kwh < min.kwh ? i : min));
  const others = perInverterToday.filter((i) => i.inverterId !== worst.inverterId);
  const othersAvg = others.reduce((sum, i) => sum + i.kwh, 0) / others.length;
  if (othersAvg <= 0) return null;

  return worst.kwh / othersAvg < 0.8 ? worst.inverterId : null;
}
