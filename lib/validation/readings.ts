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
