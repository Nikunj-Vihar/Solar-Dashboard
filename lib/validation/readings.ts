export type CrossCheckResult = { status: "ok" } | { status: "cumulative_decreased" };

/**
 * Spec §4: a given inverter's cumulative reading must be >= yesterday's,
 * unless explicitly flagged as a reset. A pure function so it's identically
 * enforced regardless of entry path (today's Server Action, a future CSV
 * import, etc).
 */
export function checkCumulativeAndCrossCheck(input: {
  cumulativeMwh: number;
  previousCumulativeMwh: number | null;
  isReset: boolean;
}): CrossCheckResult {
  const { cumulativeMwh, previousCumulativeMwh, isReset } = input;

  // Nothing to compare against yet (first-ever reading for this inverter).
  if (previousCumulativeMwh === null) {
    return { status: "ok" };
  }

  if (!isReset && cumulativeMwh < previousCumulativeMwh) {
    return { status: "cumulative_decreased" };
  }

  return { status: "ok" };
}

/**
 * Spec §8: reject a daily kWh entry wildly above what the inverter could
 * physically produce in a day. 24h window with a 15% margin over the
 * theoretical max (DC capacity is rarely sustained for a full 24h, so this
 * is a deliberately generous ceiling meant to catch typos, not to model real
 * output). Keyed off DC capacity (kWp) rather than AC-rated capacity (kW) --
 * setup only collects kWp now, and kWp is always >= kW, so this ceiling is
 * if anything slightly more permissive than before, never tighter.
 */
export function exceedsPhysicalCapacity(dailyKwh: number, dcCapacityKwp: number): boolean {
  return dailyKwh > dcCapacityKwp * 24 * 1.15;
}
