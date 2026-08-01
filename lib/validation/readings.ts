export type CrossCheckResult =
  | { status: "ok" }
  | { status: "cumulative_decreased" }
  | { status: "mismatch"; computedDeltaKwh: number; enteredDailyKwh: number };

/**
 * Spec §4: a given inverter's cumulative reading must be >= yesterday's,
 * unless explicitly flagged as a reset, and (today's cumulative - yesterday's
 * cumulative) should roughly match the entered daily kWh. Both checks live
 * here as pure functions so they're identically enforced regardless of entry
 * path (today's Server Action, a future CSV import, etc) and are directly
 * unit-testable against realistic typo/decimal-shift scenarios (spec §10.1).
 */
export function checkCumulativeAndCrossCheck(input: {
  dailyKwh: number;
  cumulativeMwh: number;
  previousCumulativeMwh: number | null;
  isReset: boolean;
}): CrossCheckResult {
  const { dailyKwh, cumulativeMwh, previousCumulativeMwh, isReset } = input;

  // Nothing to compare against yet (first-ever reading for this inverter).
  if (previousCumulativeMwh === null) {
    return { status: "ok" };
  }

  if (!isReset && cumulativeMwh < previousCumulativeMwh) {
    return { status: "cumulative_decreased" };
  }

  // A reset means the cumulative counter restarted near zero, so there's no
  // meaningful delta to cross-check against yesterday's reading.
  if (isReset) {
    return { status: "ok" };
  }

  // Rounded to avoid IEEE-754 artifacts from subtracting two decimals
  // (e.g. 10.1 - 10.0 === 0.09999999999999964 in JS) tripping the tolerance
  // check right at its own boundary — 2dp matches realistic meter precision.
  const computedDeltaKwh = Math.round((cumulativeMwh - previousCumulativeMwh) * 1000 * 100) / 100;
  // 5%-or-2kWh floor: catches proportional typos (a shifted decimal point)
  // and small-number days (cloudy/monsoon) alike, without a pure percentage
  // being too tight on already-small values.
  const tolerance = Math.max(computedDeltaKwh * 0.05, 2);

  if (Math.abs(computedDeltaKwh - dailyKwh) > tolerance) {
    return { status: "mismatch", computedDeltaKwh, enteredDailyKwh: dailyKwh };
  }

  return { status: "ok" };
}

/**
 * Spec §8: reject a daily kWh entry wildly above what the inverter could
 * physically produce in a day. 24h window with a 15% margin over the
 * theoretical max (rated capacity is rarely sustained for a full 24h, so
 * this is a deliberately generous ceiling meant to catch typos, not to
 * model real output).
 */
export function exceedsPhysicalCapacity(dailyKwh: number, ratedCapacityKw: number): boolean {
  return dailyKwh > ratedCapacityKw * 24 * 1.15;
}
