/**
 * Shared KPI math (spec §2) — used by the dashboard now, and by the monthly
 * email report and sample PDF later, so the numbers are always computed one
 * way. All pure functions: no I/O, fully unit-testable.
 */

/** Capacity Utilization Factor, as a percentage. */
export function computeCUF(totalKwh: number, capacityKwp: number, days: number): number {
  if (capacityKwp <= 0 || days <= 0) return 0;
  return (totalKwh / (capacityKwp * 24 * days)) * 100;
}

/** Specific yield: kWh generated per kWp of installed capacity, for the period given. */
export function computeSpecificYield(totalKwh: number, capacityKwp: number): number {
  if (capacityKwp <= 0) return 0;
  return totalKwh / capacityKwp;
}

/** Estimated ₹ saved at the site's grid tariff rate. Null if no tariff was set. */
export function computeRupeeSaved(
  totalKwh: number,
  tariffRateInrPerKwh: number | null,
): number | null {
  if (tariffRateInrPerKwh === null || tariffRateInrPerKwh === undefined) return null;
  return totalKwh * tariffRateInrPerKwh;
}

/** Estimated CO2 offset in kg, using the site's configured grid emission factor. */
export function computeCo2OffsetKg(totalKwh: number, gridEmissionFactorKgPerKwh: number): number {
  return totalKwh * gridEmissionFactorKgPerKwh;
}

/** How far actual generation is from the expected baseline, as a signed percentage. */
export function computeVsBaselinePercent(
  actualKwh: number,
  expectedKwh: number,
): number | null {
  if (!(expectedKwh > 0)) return null;
  return ((actualKwh - expectedKwh) / expectedKwh) * 100;
}
