// Deno-only file (deployed as part of the monthly-report Edge Function) —
// uses npm: specifiers since this runs on Supabase's Deno edge runtime, not
// Next.js/Node. See lib/calc/monthlyReport.ts for the shared KPI math this
// template's data is computed with.
import React from "npm:react@19";
import {
  Body,
  Container,
  Column,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Row,
  Section,
  Text,
} from "npm:@react-email/components@0.0.31";

export type MonthlyReportEmailProps = {
  siteName: string;
  monthLabel: string;
  totalKwh: number;
  vsPreviousMonthPercent: number | null;
  vsExpectedPercent: number | null;
  cufPercent: number;
  specificYieldKwhPerKwp: number;
  rupeeSaved: number | null;
  co2OffsetKg: number;
  perInverterKwh: { name: string; kwh: number }[];
  alertMessages: string[];
  dashboardUrl: string;
};

function pct(n: number | null): string {
  if (n === null) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}

export function MonthlyReportEmail(props: MonthlyReportEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>
        {props.siteName}: {props.totalKwh.toLocaleString()} kWh generated in {props.monthLabel}
      </Preview>
      <Body style={{ backgroundColor: "#f4f4f5", fontFamily: "sans-serif" }}>
        <Container
          style={{
            backgroundColor: "#ffffff",
            margin: "0 auto",
            padding: "32px",
            borderRadius: "8px",
            maxWidth: "480px",
          }}
        >
          <Heading style={{ fontSize: "20px", margin: "0 0 4px" }}>{props.siteName}</Heading>
          <Text style={{ color: "#71717a", margin: "0 0 24px" }}>
            Monthly generation report — {props.monthLabel}
          </Text>

          <Section>
            <Text style={{ fontSize: "28px", fontWeight: 700, margin: "0" }}>
              {props.totalKwh.toLocaleString()} kWh
            </Text>
            <Text style={{ color: "#52525b", margin: "4px 0 0", fontSize: "14px" }}>
              {pct(props.vsPreviousMonthPercent)} vs. last month · {pct(props.vsExpectedPercent)} vs.
              expected
            </Text>
          </Section>

          <Hr style={{ margin: "24px 0", borderColor: "#e4e4e7" }} />

          <Section>
            <Heading as="h2" style={{ fontSize: "14px", margin: "0 0 8px" }}>
              Per-inverter breakdown
            </Heading>
            {props.perInverterKwh.map((inv) => (
              <Row key={inv.name} style={{ marginBottom: "4px" }}>
                <Column>
                  <Text style={{ margin: 0, fontSize: "14px" }}>{inv.name}</Text>
                </Column>
                <Column align="right">
                  <Text style={{ margin: 0, fontSize: "14px" }}>
                    {inv.kwh.toLocaleString()} kWh
                  </Text>
                </Column>
              </Row>
            ))}
          </Section>

          <Hr style={{ margin: "24px 0", borderColor: "#e4e4e7" }} />

          <Section>
            <Row>
              <Column>
                <Text style={{ margin: 0, fontSize: "13px", color: "#71717a" }}>CUF</Text>
                <Text style={{ margin: 0, fontSize: "16px", fontWeight: 600 }}>
                  {props.cufPercent.toFixed(1)}%
                </Text>
              </Column>
              <Column>
                <Text style={{ margin: 0, fontSize: "13px", color: "#71717a" }}>
                  Specific yield
                </Text>
                <Text style={{ margin: 0, fontSize: "16px", fontWeight: 600 }}>
                  {props.specificYieldKwhPerKwp.toFixed(1)} kWh/kWp
                </Text>
              </Column>
            </Row>
            <Row style={{ marginTop: "12px" }}>
              {props.rupeeSaved !== null && (
                <Column>
                  <Text style={{ margin: 0, fontSize: "13px", color: "#71717a" }}>
                    Est. savings
                  </Text>
                  <Text style={{ margin: 0, fontSize: "16px", fontWeight: 600 }}>
                    ₹{Math.round(props.rupeeSaved).toLocaleString("en-IN")}
                  </Text>
                </Column>
              )}
              <Column>
                <Text style={{ margin: 0, fontSize: "13px", color: "#71717a" }}>
                  Est. CO2 offset
                </Text>
                <Text style={{ margin: 0, fontSize: "16px", fontWeight: 600 }}>
                  {Math.round(props.co2OffsetKg).toLocaleString()} kg
                </Text>
              </Column>
            </Row>
          </Section>

          {props.alertMessages.length > 0 && (
            <>
              <Hr style={{ margin: "24px 0", borderColor: "#e4e4e7" }} />
              <Section>
                <Heading as="h2" style={{ fontSize: "14px", margin: "0 0 8px" }}>
                  Flags raised this month
                </Heading>
                {props.alertMessages.map((msg, i) => (
                  <Text key={i} style={{ margin: "0 0 4px", fontSize: "13px", color: "#52525b" }}>
                    • {msg}
                  </Text>
                ))}
              </Section>
            </>
          )}

          <Hr style={{ margin: "24px 0", borderColor: "#e4e4e7" }} />

          <Link href={props.dashboardUrl} style={{ fontSize: "14px" }}>
            View the live dashboard →
          </Link>
          <Text style={{ marginTop: "24px", fontSize: "12px", color: "#a1a1aa" }}>
            Savings and CO2 figures are estimates, not certified measurements.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
