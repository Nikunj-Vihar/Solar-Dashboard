import { TrendingUp, TrendingDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { InfoTooltip } from "@/components/InfoTooltip";
import { computeRupeeSaved, computeCo2OffsetKg, computeVsBaselinePercent } from "@/lib/calc/kpis";
import { formatInr, formatKwh, formatPercent } from "@/lib/format";

export function ImpactFigures({
  monthKwh,
  monthExpectedMidKwh,
  tariffRateInrPerKwh,
  gridEmissionFactorKgPerKwh,
}: {
  monthKwh: number;
  monthExpectedMidKwh: number | null;
  tariffRateInrPerKwh: number | null;
  gridEmissionFactorKgPerKwh: number;
}) {
  const rupeeSaved = computeRupeeSaved(monthKwh, tariffRateInrPerKwh);
  const co2OffsetKg = computeCo2OffsetKg(monthKwh, gridEmissionFactorKgPerKwh);
  const vsBaseline =
    monthExpectedMidKwh !== null ? computeVsBaselinePercent(monthKwh, monthExpectedMidKwh) : null;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {rupeeSaved !== null && (
        <Card>
          <CardContent className="pt-6">
            <p className="flex items-center gap-1 text-sm text-muted-foreground">
              Estimated savings this month
              <InfoTooltip>
                <p>
                  {formatKwh(monthKwh)} generated this month × your configured tariff rate of{" "}
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
                  vsBaseline >= 0 ? "text-[--viz-status-good]" : "text-muted-foreground"
                }`}
              >
                {vsBaseline >= 0 ? (
                  <TrendingUp className="size-3.5" />
                ) : (
                  <TrendingDown className="size-3.5" />
                )}
                {formatPercent(vsBaseline, { showSign: true })} vs. expected for this month
              </p>
            )}
          </CardContent>
        </Card>
      )}
      <Card>
        <CardContent className="pt-6">
          <p className="flex items-center gap-1 text-sm text-muted-foreground">
            Estimated CO2 offset this month
            <InfoTooltip>
              {formatKwh(monthKwh)} generated this month × a standard grid emission factor of{" "}
              {gridEmissionFactorKgPerKwh} kg CO2/kWh — roughly what generating that same
              electricity from the grid would have emitted. An approximation, not a certified
              measurement.
            </InfoTooltip>
          </p>
          <p className="mt-1 text-2xl font-semibold">
            {co2OffsetKg.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
