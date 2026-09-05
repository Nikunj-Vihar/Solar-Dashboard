import { Document, Page, Text, View, Svg, Rect, StyleSheet } from "@react-pdf/renderer";
import type { MonthlyReportData } from "@/lib/calc/monthlyReport";
import { formatKwh, formatPercent, formatShortDate } from "@/lib/format";

// Same accent used throughout the live app for magnitude series
// (app/globals.css's --viz-series-1, validated via the dataviz skill's
// palette checker) -- react-pdf can't read CSS custom properties, so the
// hex values are duplicated here rather than imported.
const COLOR = {
  ink: "#18181b",
  subtext: "#52525b",
  muted: "#71717a",
  faint: "#a1a1aa",
  border: "#e4e4e7",
  accent: "#2a78d6",
  accentTrack: "#dce8f8",
  compareBarFill: "#d4d4d8",
  warningBg: "#fef3c7",
  warningText: "#92400e",
};

const CONTENT_WIDTH = 539;
const DAILY_CHART_HEIGHT = 45;
const COMPARISON_CHART_HEIGHT = 38;

// Slots 1-4 (blue/orange/aqua/yellow) of the dataviz skill's validated 8-hue
// categorical palette (references/palette.md) -- that order passes the
// adjacent-pair CVD gate for stacked bars at all 8 slots, so 4 is safe with
// no new validation needed. Slot 1 matches the app's existing --viz-series-1
// accent, kept as the first (bottom) segment. Only used up to 4 inverters;
// a 5th would need a new slot decision, out of scope for this client.
const INVERTER_COLORS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100"];

// Everything below is sized to fit the whole report on one A4 page --
// keep new sections/values this compact, or the page will overflow to a
// second page (react-pdf clips nothing; it just flows onto page 2).
const styles = StyleSheet.create({
  page: { padding: 28, fontSize: 8, fontFamily: "Helvetica", color: COLOR.ink },
  watermark: {
    backgroundColor: COLOR.warningBg,
    color: COLOR.warningText,
    padding: 5,
    borderRadius: 3,
    fontSize: 7,
    marginBottom: 8,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  siteName: { fontSize: 15, fontWeight: 700 },
  subtitle: { fontSize: 8, color: COLOR.subtext, marginTop: 1 },
  generatedOn: { fontSize: 6.5, color: COLOR.faint },

  heroBlock: { marginTop: 8 },
  heroValue: { fontSize: 22, fontWeight: 700 },
  insightLine: { fontSize: 7.5, color: COLOR.subtext, marginTop: 2 },

  deltaGroup: { flexDirection: "row", gap: 20, marginTop: 6 },
  deltaValue: { fontSize: 11, fontWeight: 700 },
  deltaLabel: { fontSize: 6.5, color: COLOR.muted, marginTop: 1 },

  hr: { borderBottomWidth: 1, borderBottomColor: COLOR.border, marginVertical: 5 },
  sectionTitle: { fontSize: 9, fontWeight: 700, marginBottom: 4 },

  chartWrap: { position: "relative", width: CONTENT_WIDTH },
  axisLabel: { position: "absolute", fontSize: 6, color: COLOR.faint },

  legendRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 12 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 3 },
  legendSwatch: { width: 6, height: 6, borderRadius: 1 },
  legendText: { fontSize: 6.5, color: COLOR.subtext },

  compareRow: { flexDirection: "row", justifyContent: "center", gap: 20, width: CONTENT_WIDTH },
  compareColumn: { alignItems: "center", width: 90 },
  compareValue: { fontSize: 7, fontWeight: 700, marginBottom: 2 },
  compareBar: { width: 36, borderRadius: 3 },
  compareLabel: { fontSize: 6.5, color: COLOR.muted, marginTop: 3, textAlign: "center" },

  kpiGrid: { flexDirection: "row", flexWrap: "wrap" },
  kpiBox: { width: "33%", marginBottom: 6 },
  kpiLabel: { fontSize: 6.5, color: COLOR.muted, marginBottom: 1 },
  kpiValue: { fontSize: 11, fontWeight: 700 },
  kpiSub: { fontSize: 6, color: COLOR.faint, marginTop: 1 },

  inverterRow: { marginBottom: 4 },
  inverterLabelRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 2 },
  inverterName: { fontSize: 7.5, fontWeight: 700 },
  inverterValue: { fontSize: 7.5, color: COLOR.muted },
  meterTrack: { height: 4, borderRadius: 2, backgroundColor: COLOR.accentTrack },
  meterFill: { height: 4, borderRadius: 2, backgroundColor: COLOR.accent },
  inverterTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: COLOR.border,
    marginTop: 2,
    paddingTop: 4,
  },
  inverterTotalLabel: { fontSize: 7.5, fontWeight: 700 },
  inverterTotalValue: { fontSize: 7.5, fontWeight: 700 },

  alertLine: { fontSize: 7.5, color: COLOR.subtext, marginBottom: 2 },

  footer: { fontSize: 6.5, color: COLOR.faint, lineHeight: 1.3 },
});

function pct(n: number | null): string {
  if (n === null) return "—";
  return formatPercent(n, { showSign: true });
}

type StackedBar = { x: number; width: number; segments: { y: number; height: number; color: string }[] };

/**
 * One stacked bar per day of the month, one segment per inverter (fixed
 * order, bottom-to-top) -- a day with no reading gets no bar at all (an
 * honest gap, not a fabricated zero). Segment heights are proportional to
 * each inverter's share of that day's total, with a small surface-color gap
 * between segments (dataviz skill's stacked-mark spec) so touching
 * inverters read as distinct without drawing a border.
 */
function buildStackedDailyBars(
  dailySeries: MonthlyReportData["dailySeries"],
  perInverterDailySeries: MonthlyReportData["perInverterDailySeries"],
  width: number,
  height: number,
): StackedBar[] {
  const max = Math.max(1, ...dailySeries.map((d) => d.kwh ?? 0));
  const gap = 2;
  const segmentGap = 1;
  const barWidth = Math.max(1, (width - gap * (dailySeries.length - 1)) / dailySeries.length);

  return dailySeries.map((d, dayIndex) => {
    const x = dayIndex * (barWidth + gap);
    if (d.kwh === null || d.kwh <= 0) return { x, width: barWidth, segments: [] };

    const totalBarHeight = Math.max(0.5, (d.kwh / max) * height);
    let bottomY = height;
    const segments: StackedBar["segments"] = [];
    perInverterDailySeries.forEach((inv, invIndex) => {
      const invKwh = inv.series[dayIndex]?.kwh ?? 0;
      if (invKwh <= 0) return;
      const segHeight = Math.max(0, (invKwh / d.kwh!) * totalBarHeight - segmentGap);
      const topY = bottomY - segHeight;
      segments.push({ y: topY, height: segHeight, color: INVERTER_COLORS[invIndex % INVERTER_COLORS.length] });
      bottomY = topY - segmentGap;
    });
    return { x, width: barWidth, segments };
  });
}

function DailyGenerationChart({ report }: { report: MonthlyReportData }) {
  const bars = buildStackedDailyBars(
    report.dailySeries,
    report.perInverterDailySeries,
    CONTENT_WIDTH,
    DAILY_CHART_HEIGHT,
  );
  const barWidth = bars[0]?.width ?? 0;
  const labelIndices = new Set<number>();
  report.dailySeries.forEach((d, i) => {
    const day = Number(d.date.slice(8, 10));
    if (day === 1 || day % 5 === 0 || i === report.dailySeries.length - 1) labelIndices.add(i);
  });

  return (
    <View style={styles.chartWrap}>
      <Svg width={CONTENT_WIDTH} height={DAILY_CHART_HEIGHT}>
        {bars.map((b, i) =>
          b.segments.map((seg, si) => (
            <Rect key={`${i}-${si}`} x={b.x} y={seg.y} width={barWidth} height={seg.height} rx={1} fill={seg.color} />
          )),
        )}
      </Svg>
      {[...labelIndices].map((i) => (
        <Text key={i} style={[styles.axisLabel, { left: bars[i].x - 4, top: DAILY_CHART_HEIGHT + 4 }]}>
          {Number(report.dailySeries[i].date.slice(8, 10))}
        </Text>
      ))}
    </View>
  );
}

function InverterLegend({ perInverterKwh }: { perInverterKwh: MonthlyReportData["perInverterKwh"] }) {
  return (
    <View style={styles.legendRow}>
      {perInverterKwh.map((inv, i) => (
        <View key={inv.name} style={styles.legendItem}>
          <View style={[styles.legendSwatch, { backgroundColor: INVERTER_COLORS[i % INVERTER_COLORS.length] }]} />
          <Text style={styles.legendText}>
            {inv.name} · {formatKwh(inv.kwh)}
          </Text>
        </View>
      ))}
    </View>
  );
}

function ComparisonChart({ report }: { report: MonthlyReportData }) {
  const items: { label: string; value: number }[] = [{ label: "This month", value: report.totalKwh }];
  if (report.previousMonthKwh !== null) items.push({ label: "Last month", value: report.previousMonthKwh });
  if (report.previousYearKwh !== null) items.push({ label: "Same month last year", value: report.previousYearKwh });
  if (items.length === 1) return null;

  const max = Math.max(1, ...items.map((i) => i.value));

  return (
    <View style={styles.compareRow}>
      {items.map((item, i) => (
        <View key={item.label} style={styles.compareColumn}>
          <Text style={styles.compareValue}>{formatKwh(item.value)}</Text>
          <View
            style={[
              styles.compareBar,
              {
                height: Math.max(4, (item.value / max) * COMPARISON_CHART_HEIGHT),
                backgroundColor: i === 0 ? COLOR.accent : COLOR.compareBarFill,
              },
            ]}
          />
          <Text style={styles.compareLabel}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}

function KpiTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <View style={styles.kpiBox}>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={styles.kpiValue}>{value}</Text>
      {sub && <Text style={styles.kpiSub}>{sub}</Text>}
    </View>
  );
}

function insightLine(report: MonthlyReportData): string | null {
  if (report.vsPreviousMonthPercent === null) return null;
  const direction = report.vsPreviousMonthPercent >= 0 ? "up" : "down";
  return `Generation was ${direction} ${Math.abs(report.vsPreviousMonthPercent).toFixed(1)}% from last month.`;
}

export function MonthlyReportPDF({ report, watermark }: { report: MonthlyReportData; watermark?: string }) {
  const insight = insightLine(report);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {watermark && <Text style={styles.watermark}>{watermark}</Text>}

        <View style={styles.headerRow}>
          <View>
            <Text style={styles.siteName}>{report.siteName}</Text>
            <Text style={styles.subtitle}>Monthly Generation Report — {report.monthLabel}</Text>
          </View>
          <Text style={styles.generatedOn}>
            Generated {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          </Text>
        </View>

        <View style={styles.heroBlock}>
          <Text style={styles.heroValue}>{formatKwh(report.totalKwh)}</Text>
          {insight && <Text style={styles.insightLine}>{insight}</Text>}
          <View style={styles.deltaGroup}>
            <View>
              <Text style={styles.deltaValue}>{pct(report.vsPreviousMonthPercent)}</Text>
              <Text style={styles.deltaLabel}>vs last month</Text>
            </View>
            <View>
              <Text style={styles.deltaValue}>{pct(report.vsLastYearPercent)}</Text>
              <Text style={styles.deltaLabel}>vs same month last year</Text>
            </View>
          </View>
        </View>

        <View style={styles.hr} />

        <Text style={styles.sectionTitle}>Daily generation</Text>
        <DailyGenerationChart report={report} />
        <InverterLegend perInverterKwh={report.perInverterKwh} />

        <View style={styles.hr} />

        <ComparisonChart report={report} />

        <View style={styles.hr} />

        <Text style={styles.sectionTitle}>Performance</Text>
        <View style={styles.kpiGrid}>
          <KpiTile label="Capacity Utilization Factor" value={`${report.cufPercent.toFixed(1)}%`} />
          <KpiTile
            label="Specific yield"
            value={`${report.specificYieldKwhPerKwp.toFixed(1)} kWh/kWp`}
          />
          <KpiTile
            label="Data completeness"
            value={`${report.dataCompleteness.logged}/${report.dataCompleteness.total} days`}
            sub="days with a logged reading"
          />
        </View>

        <View style={styles.hr} />

        <Text style={styles.sectionTitle}>Per-inverter breakdown</Text>
        {report.perInverterKwh.map((inv) => {
          const pctOfTotal = report.totalKwh > 0 ? (inv.kwh / report.totalKwh) * 100 : 0;
          return (
            <View key={inv.name} style={styles.inverterRow}>
              <View style={styles.inverterLabelRow}>
                <Text style={styles.inverterName}>{inv.name}</Text>
                <Text style={styles.inverterValue}>
                  {formatKwh(inv.kwh)} · {pctOfTotal.toFixed(0)}%
                </Text>
              </View>
              <View style={styles.meterTrack}>
                <View style={[styles.meterFill, { width: `${Math.max(0, Math.min(pctOfTotal, 100))}%` }]} />
              </View>
            </View>
          );
        })}
        <View style={styles.inverterTotalRow}>
          <Text style={styles.inverterTotalLabel}>Total (all inverters)</Text>
          <Text style={styles.inverterTotalValue}>{formatKwh(report.totalKwh)}</Text>
        </View>

        <View style={styles.hr} />

        <Text style={styles.sectionTitle}>Monthly totals</Text>
        <View style={styles.kpiGrid}>
          <KpiTile
            label="Total generation"
            value={formatKwh(report.totalKwh)}
            sub="sum of daily readings, all inverters"
          />
          <KpiTile
            label="Cumulative generation"
            value={
              report.cumulativeGenerationMwh !== null
                ? `${report.cumulativeGenerationMwh.toLocaleString(undefined, { maximumFractionDigits: 2 })} MWh`
                : "—"
            }
            sub="meter reading, end of month minus start"
          />
        </View>

        {report.alertMessages.length > 0 && (
          <>
            <View style={styles.hr} />
            <Text style={styles.sectionTitle}>Flags raised this month</Text>
            {report.alertMessages.map((msg, i) => (
              <Text key={i} style={styles.alertLine}>
                • {msg}
              </Text>
            ))}
          </>
        )}

        {report.gridOutageDays.length > 0 && (
          <>
            <View style={styles.hr} />
            <Text style={styles.sectionTitle}>Grid power outages</Text>
            <Text style={styles.alertLine}>
              These inverters have no battery, so they shut off entirely for the duration of a
              grid outage (a safety requirement, not a fault) -- {report.totalGridOutageHours}{" "}
              {report.totalGridOutageHours === 1 ? "hour" : "hours"} across {report.gridOutageDays.length}{" "}
              {report.gridOutageDays.length === 1 ? "day" : "days"} this month:{" "}
              {report.gridOutageDays.map((d) => `${formatShortDate(d.date)} (${d.hours}h)`).join(", ")}.
            </Text>
          </>
        )}

        <View style={styles.hr} />

        <Text style={styles.sectionTitle}>Savings & lifetime generation</Text>
        <View style={styles.kpiGrid}>
          {report.rupeeSaved !== null && (
            <KpiTile
              label="Estimated savings"
              // "Rs." not "₹" -- react-pdf's built-in Helvetica has no glyph for U+20B9.
              value={`Rs. ${Math.round(report.rupeeSaved).toLocaleString("en-IN")}`}
            />
          )}
          <KpiTile label="Lifetime generation" value={formatKwh(report.lifetimeKwh)} />
        </View>

        <View style={styles.hr} />
        <Text style={styles.footer}>
          Based on daily readings and cumulative meter values logged manually at the site — there
          is no irradiance/weather sensor, so comparisons are against this site&apos;s own past
          generation rather than an external theoretical baseline. Savings figures are estimates,
          not certified measurements. View the live dashboard at {report.dashboardUrl}.
        </Text>
      </Page>
    </Document>
  );
}
