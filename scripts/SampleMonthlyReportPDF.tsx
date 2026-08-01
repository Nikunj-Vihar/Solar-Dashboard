import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { MonthlyReportData } from "@/lib/calc/monthlyReport";

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 11, fontFamily: "Helvetica", color: "#18181b" },
  watermark: {
    backgroundColor: "#fef3c7",
    color: "#92400e",
    padding: 8,
    borderRadius: 4,
    fontSize: 9,
    marginBottom: 20,
  },
  siteName: { fontSize: 20, fontWeight: 700, marginBottom: 2 },
  subtitle: { fontSize: 12, color: "#71717a", marginBottom: 20 },
  headline: { fontSize: 28, fontWeight: 700, marginBottom: 2 },
  headlineSub: { fontSize: 11, color: "#52525b", marginBottom: 20 },
  hr: { borderBottomWidth: 1, borderBottomColor: "#e4e4e7", marginVertical: 16 },
  sectionTitle: { fontSize: 12, fontWeight: 700, marginBottom: 8 },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  kpiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 20 },
  kpiBox: { width: "45%", marginBottom: 12 },
  kpiLabel: { fontSize: 9, color: "#71717a", marginBottom: 2 },
  kpiValue: { fontSize: 15, fontWeight: 700 },
  alertLine: { fontSize: 10, color: "#52525b", marginBottom: 3 },
  footer: { fontSize: 9, color: "#a1a1aa", marginTop: 24 },
});

function pct(n: number | null): string {
  if (n === null) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}

export function SampleMonthlyReportPDF({ report }: { report: MonthlyReportData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.watermark}>
          SAMPLE REPORT — illustrative data, not a real client&apos;s figures. This is what your
          monthly email will look like once you&apos;re logging data.
        </Text>

        <Text style={styles.siteName}>{report.siteName}</Text>
        <Text style={styles.subtitle}>Monthly generation report — {report.monthLabel}</Text>

        <Text style={styles.headline}>{report.totalKwh.toLocaleString()} kWh</Text>
        <Text style={styles.headlineSub}>
          {pct(report.vsPreviousMonthPercent)} vs. last month · {pct(report.vsExpectedPercent)} vs.
          expected
        </Text>

        <View style={styles.hr} />

        <Text style={styles.sectionTitle}>Per-inverter breakdown</Text>
        {report.perInverterKwh.map((inv) => (
          <View key={inv.name} style={styles.row}>
            <Text>{inv.name}</Text>
            <Text>{inv.kwh.toLocaleString()} kWh</Text>
          </View>
        ))}

        <View style={styles.hr} />

        <Text style={styles.sectionTitle}>Performance</Text>
        <View style={styles.kpiGrid}>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiLabel}>Capacity Utilization Factor</Text>
            <Text style={styles.kpiValue}>{report.cufPercent.toFixed(1)}%</Text>
          </View>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiLabel}>Specific yield</Text>
            <Text style={styles.kpiValue}>{report.specificYieldKwhPerKwp.toFixed(1)} kWh/kWp</Text>
          </View>
          {report.rupeeSaved !== null && (
            <View style={styles.kpiBox}>
              <Text style={styles.kpiLabel}>Estimated savings</Text>
              {/* "Rs." not "₹" — react-pdf's built-in Helvetica has no glyph for U+20B9 */}
              <Text style={styles.kpiValue}>
                Rs. {Math.round(report.rupeeSaved).toLocaleString("en-IN")}
              </Text>
            </View>
          )}
          <View style={styles.kpiBox}>
            <Text style={styles.kpiLabel}>Estimated CO2 offset</Text>
            <Text style={styles.kpiValue}>
              {Math.round(report.co2OffsetKg).toLocaleString()} kg
            </Text>
          </View>
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
        <Text style={styles.footer}>
          Savings and CO2 figures are estimates, not certified measurements. View the live
          dashboard at {report.dashboardUrl}.
        </Text>
      </Page>
    </Document>
  );
}
