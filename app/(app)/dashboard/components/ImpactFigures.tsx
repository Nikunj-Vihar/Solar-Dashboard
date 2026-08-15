import { TrendingUp, TrendingDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { InfoTooltip } from "@/components/InfoTooltip";
import { computeRupeeSaved, computeCo2OffsetKg, computeVsBaselinePercent } from "@/lib/calc/kpis";
import { formatInr, formatKwh, formatPercent } from "@/lib/format";

export function ImpactFigures({
  rangeKwh,
  rangeExpectedMidKwh,
  rangeLabel,
  tariffRateInrPerKwh,
  gridEmissionFactorKgPerKwh,
}: {
  rangeKwh: number;
  rangeExpectedMidKwh: number | null;
  rangeLabel: string;
  tariffRateInrPerKwh: number | null;
  gridEmissionFactorKgPerKwh: number;
}) {
  const rupeeSaved = computeRupeeSaved(rangeKwh, tariffRateInrPerKwh);
  const co2OffsetKg = computeCo2OffsetKg(rangeKwh, gridEmissionFactorKgPerKwh);
  const vsBaseline =
    rangeExpectedMidKwh !== null ? computeVsBaselinePercent(rangeKwh, rangeExpectedMidKwh) : null;

  return (
    <>
      {rupeeSaved !== null && (
        <Card>
          <CardContent className="pt-6">
            <p className="flex items-center gap-1 text-sm text-muted-foreground">
              Estimated savings
              <InfoTooltip>
                <p>
                  {formatKwh(rangeKwh)} generated in the selected period ({rangeLabel}) × your
                  configured tariff rate of{" "}
                  {tariffRateInrPerKwh !== null ? `₹${tariffRateInrPerKwh}/kWh` : ""}
                  {" = "}what that electricity would have cost from the grid. An estimate, not a
                  certified figure — change your tariff rate in Settings if it&apos;s out of date.
                </p>
                <p className="mt-2">
                  &quot;vs. expected&quot; compares actual generation to a baseline computed from
                  your site&apos;s solar irradiance (via NASA&apos;s POWER dataset) and installed
                  capacity.
                </p>
              </InfoTooltip>
            </p>
            <p className="mt-1 text-2xl font-semibold">{formatInr(rupeeSaved)}</p>
            {vsBaseline !== null && (
              <p
                className={`mt-1 flex items-center gap-1 text-sm ${
                  vsBaseline >= 0 ? "text-(--viz-status-good)" : "text-muted-foreground"
                }`}
              >
                {vsBaseline >= 0 ? (
                  <TrendingUp className="size-3.5" />
                ) : (
                  <TrendingDown className="size-3.5" />
                )}
                {formatPercent(vsBaseline, { showSign: true })} vs. expected for {rangeLabel}
              </p>
            )}
          </CardContent>
        </Card>
      )}
      <Card>
        <CardContent className="pt-6">
          <p className="flex items-center gap-1 text-sm text-muted-foreground">
            Estimated CO2 offset
            <InfoTooltip>
              {formatKwh(rangeKwh)} generated in the selected period ({rangeLabel}) × a standard
              grid emission factor of {gridEmissionFactorKgPerKwh} kg CO2/kWh — roughly what
              generating that same electricity from the grid would have emitted. An approximation,
              not a certified measurement.
            </InfoTooltip>
          </p>
          <p className="mt-1 text-2xl font-semibold">
            {co2OffsetKg.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg
          </p>
        </CardContent>
      </Card>
    </>
  );
}
