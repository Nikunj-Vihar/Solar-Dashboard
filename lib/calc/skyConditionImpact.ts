import { SKY_CONDITIONS, SKY_CONDITION_LABELS, type SkyCondition } from "@/lib/validation/schemas";

export type SkyConditionImpactPoint = {
  condition: SkyCondition;
  label: string;
  avgKwh: number;
  dayCount: number;
};

/**
 * Groups a site's daily generation totals by the sky condition logged that
 * same day, averaging within each condition -- a day with no real
 * generation (null) or no sky-condition entry can't be attributed to
 * either bucket, so it's skipped rather than treated as a 0. Returned in
 * SKY_CONDITIONS' fixed clearest-to-worst order, omitting any condition
 * with zero attributable days.
 */
export function computeSkyConditionImpact(
  dailyTotals: { date: string; totalKwh: number | null }[],
  skyConditionByDate: Map<string, SkyCondition>,
): SkyConditionImpactPoint[] {
  const sums = new Map<SkyCondition, number>();
  const counts = new Map<SkyCondition, number>();

  for (const { date, totalKwh } of dailyTotals) {
    if (totalKwh === null) continue;
    const condition = skyConditionByDate.get(date);
    if (!condition) continue;
    sums.set(condition, (sums.get(condition) ?? 0) + totalKwh);
    counts.set(condition, (counts.get(condition) ?? 0) + 1);
  }

  return SKY_CONDITIONS.filter((condition) => counts.has(condition)).map((condition) => {
    const dayCount = counts.get(condition)!;
    const total = sums.get(condition)!;
    return {
      condition,
      label: SKY_CONDITION_LABELS[condition],
      avgKwh: round2(total / dayCount),
      dayCount,
    };
  });
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
