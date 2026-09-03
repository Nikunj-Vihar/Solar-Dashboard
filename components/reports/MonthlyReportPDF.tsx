import { Document, Page, Text, View, Svg, Rect, StyleSheet } from "@react-pdf/renderer";
import type { MonthlyReportData } from "@/lib/calc/monthlyReport";
import { formatKwh, formatPercent } from "@/lib/format";

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

const CONTENT_WIDTH = 515;
const DAILY_CHART_HEIGHT = 90;
const COMPARISON_CHART_HEIGHT = 70;

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica", color: COLOR.ink },
  watermark: {
    backgroundColor: COLOR.warningBg,
    color: COLOR.warningText,
    padding: 8,
    borderRadius: 4,
    fontSize: 9,
    marginBottom: 20,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  siteName: { fontSize: 20, fontWeight: 700 },
  subtitle: { fontSize: 11, color: COLOR.subtext, marginTop: 2 },
  generatedOn: { fontSize: 8, color: COLOR.faint },

  heroBlock: { marginTop: 20 },
  heroValue: { fontSize: 32, fontWeight: 700 },
  insightLine: { fontSize: 9, color: COLOR.subtext, marginTop: 4 },

  deltaGroup: { flexDirection: "row", gap: 28, marginTop: 12 },
  deltaValue: { fontSize: 15, fontWeight: 700 },
  deltaLabel: { fontSize: 8, color: COLOR.muted, marginTop: 1 },

  hr: { borderBottomWidth: 1, borderBottomColor: COLOR.border, marginVertical: 14 },
  sectionTitle: { fontSize: 11, fontWeight: 700, marginBottom: 10 },

  chartWrap: { position: "relative", width: CONTENT_WIDTH },
  axisLabel: { position: "absolute", fontSize: 7, color: COLOR.faint },

  compareRow: { flexDirection: "row", justifyContent: "center", gap: 36, width: CONTENT_WIDTH },
  compareColumn: { alignItems: "center", width: 90 },
  compareValue: { fontSize: 8, fontWeight: 700, marginBottom: 4 },
  compareBar: { width: 44, borderRadius: 3 },
  compareLabel: { fontSize: 8, color: COLOR.muted, marginTop: 6, textAlign: "center" },

  kpiGrid: { flexDirection: "row", flexWrap: "wrap" },
  kpiBox: { width: "33%", marginBottom: 14 },
  kpiLabel: { fontSize: 8, color: COLOR.muted, marginBottom: 3 },
  kpiValue: { fontSize: 15, fontWeight: 700 },
  kpiSub: { fontSize: 7, color: COLOR.faint, marginTop: 2 },

  inverterRow: { marginBottom: 9 },
  inverterLabelRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 3 },
  inverterName: { fontSize: 9, fontWeight: 700 },
  inverterValue: { fontSize: 9, color: COLOR.muted },
  meterTrack: { height: 5, borderRadius: 3, backgroundColor: COLOR.accentTrack },
  meterFill: { height: 5, borderRadius: 3, backgroundColor: COLOR.accent },
  inverterTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: COLOR.border,
    marginTop: 4,
    paddingTop: 8,
  },
  inverterTotalLabel: { fontSize: 9, fontWeight: 700 },
  inverterTotalValue: { fontSize: 9, fontWeight: 700 },

  alertLine: { fontSize: 9, color: COLOR.subtext, marginBottom: 4 },

  footer: { fontSize: 8, color: COLOR.faint, lineHeight: 1.5 },
});

function pct(n: number | null): string {
  if (n === null) return "—";
  return formatPercent(n, { showSign: true });
}

type Bar = { x: number; y: number; width: number; height: number };

/** One bar per day of the month; a day with no reading gets no bar at all (an honest gap, not a fabricated zero). */
function buildDailyBars(series: MonthlyReportData["dailySeries"], width: number, height: number): Bar[] {
  const max = Math.max(1, ...series.map((d) => d.kwh ?? 0));
  const gap = 2;
  const barWidth = Math.max(1, (width - gap * (series.length - 1)) / series.length);
  return series.map((d, i) => {
    const barHeight = d.kwh === null ? 0 : Math.max(0.5, (d.kwh / max) * height);
    return { x: i * (barWidth + gap), y: height - barHeight, width: barWidth, height: barHeight };
  });
}

function DailyGenerationChart({ series }: { series: MonthlyReportData["dailySeries"] }) {
  const bars = buildDailyBars(series, CONTENT_WIDTH, DAILY_CHART_HEIGHT);
  const barWidth = bars[0]?.width ?? 0;
  const labelIndices = new Set<number>();
  series.forEach((d, i) => {
    const day = Number(d.date.slice(8, 10));
    if (day === 1 || day % 5 === 0 || i === series.length - 1) labelIndices.add(i);
  });

  return (
    <View style={styles.chartWrap}>
      <Svg width={CONTENT_WIDTH} height={DAILY_CHART_HEIGHT}>
        {bars.map((b, i) => (
          <Rect key={i} x={b.x} y={b.y} width={barWidth} height={b.height} rx={1} fill={COLOR.accent} />
        ))}
      </Svg>
      {[...labelIndices].map((i) => (
        <Text key={i} style={[styles.axisLabel, { left: bars[i].x - 4, top: DAILY_CHART_HEIGHT + 4 }]}>
          {Number(series[i].date.slice(8, 10))}
        </Text>
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
        <DailyGenerationChart series={report.dailySeries} />

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

        <View style={styles.hr} />

        <Text style={styles.sectionTitle}>Environmental & financial impact</Text>
        <View style={styles.kpiGrid}>
          {report.rupeeSaved !== null && (
            <KpiTile
              label="Estimated savings"
              // "Rs." not "₹" -- react-pdf's built-in Helvetica has no glyph for U+20B9.
              value={`Rs. ${Math.round(report.rupeeSaved).toLocaleString("en-IN")}`}
            />
          )}
          <KpiTile label="Estimated CO2 offset" value={`${Math.round(report.co2OffsetKg).toLocaleString()} kg`} />
          <KpiTile label="Equivalent to" value={`${report.treesEquivalent.toLocaleString()} trees/yr`} />
          <KpiTile label="Lifetime generation" value={formatKwh(report.lifetimeKwh)} />
        </View>

        <View style={styles.hr} />
        <Text style={styles.footer}>
          Based on daily readings and cumulative meter values logged manually at the site — there
          is no irradiance/weather sensor, so comparisons are against this site&apos;s own past
          generation rather than an external theoretical baseline. Savings, CO2, and
          trees-equivalent figures are estimates, not certified measurements. View the live
          dashboard at {report.dashboardUrl}.
        </Text>
      </Page>
    </Document>
  );
}
