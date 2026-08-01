import {
  Body,
  Column,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Row,
  Section,
  Text,
} from "@react-email/components";

export type StatusEmailProps = {
  siteName: string;
  todayKwh: number;
  monthKwh: number;
  lifetimeKwh: number;
  healthLabel: string;
  rupeeSaved: number | null;
  co2OffsetKg: number;
  alertMessages: string[];
  dashboardUrl: string;
};

export function StatusEmail({
  siteName,
  todayKwh,
  monthKwh,
  lifetimeKwh,
  healthLabel,
  rupeeSaved,
  co2OffsetKg,
  alertMessages,
  dashboardUrl,
}: StatusEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>
        {siteName}: {todayKwh.toLocaleString()} kWh today, status {healthLabel}
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
          <Heading style={{ fontSize: "20px", margin: "0 0 4px" }}>{siteName}</Heading>
          <Text style={{ color: "#71717a", margin: "0 0 24px" }}>
            Status snapshot — {new Date().toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </Text>

          <Section>
            <Row>
              <Column>
                <Text style={{ margin: 0, fontSize: "13px", color: "#71717a" }}>Today</Text>
                <Text style={{ margin: 0, fontSize: "18px", fontWeight: 600 }}>
                  {todayKwh.toLocaleString()} kWh
                </Text>
              </Column>
              <Column>
                <Text style={{ margin: 0, fontSize: "13px", color: "#71717a" }}>This month</Text>
                <Text style={{ margin: 0, fontSize: "18px", fontWeight: 600 }}>
                  {monthKwh.toLocaleString()} kWh
                </Text>
              </Column>
              <Column>
                <Text style={{ margin: 0, fontSize: "13px", color: "#71717a" }}>Lifetime</Text>
                <Text style={{ margin: 0, fontSize: "18px", fontWeight: 600 }}>
                  {lifetimeKwh.toLocaleString()} kWh
                </Text>
              </Column>
            </Row>
          </Section>

          <Hr style={{ margin: "24px 0", borderColor: "#e4e4e7" }} />

          <Section>
            <Text style={{ margin: 0, fontSize: "13px", color: "#71717a" }}>Health status</Text>
            <Text style={{ margin: 0, fontSize: "16px", fontWeight: 600 }}>{healthLabel}</Text>
            <Row style={{ marginTop: "12px" }}>
              {rupeeSaved !== null && (
                <Column>
                  <Text style={{ margin: 0, fontSize: "13px", color: "#71717a" }}>
                    Est. savings this month
                  </Text>
                  <Text style={{ margin: 0, fontSize: "16px", fontWeight: 600 }}>
                    ₹{Math.round(rupeeSaved).toLocaleString("en-IN")}
                  </Text>
                </Column>
              )}
              <Column>
                <Text style={{ margin: 0, fontSize: "13px", color: "#71717a" }}>
                  Est. CO2 offset this month
                </Text>
                <Text style={{ margin: 0, fontSize: "16px", fontWeight: 600 }}>
                  {Math.round(co2OffsetKg).toLocaleString()} kg
                </Text>
              </Column>
            </Row>
          </Section>

          {alertMessages.length > 0 && (
            <>
              <Hr style={{ margin: "24px 0", borderColor: "#e4e4e7" }} />
              <Section>
                <Heading as="h2" style={{ fontSize: "14px", margin: "0 0 8px" }}>
                  Active alerts
                </Heading>
                {alertMessages.map((msg, i) => (
                  <Text key={i} style={{ margin: "0 0 4px", fontSize: "13px", color: "#52525b" }}>
                    • {msg}
                  </Text>
                ))}
              </Section>
            </>
          )}

          <Hr style={{ margin: "24px 0", borderColor: "#e4e4e7" }} />

          <Link href={dashboardUrl} style={{ fontSize: "14px" }}>
            View the live dashboard →
          </Link>
          <Text style={{ marginTop: "24px", fontSize: "12px", color: "#a1a1aa" }}>
            Savings and CO2 figures are estimates, not certified measurements. You requested this
            snapshot from Settings — it isn&apos;t a scheduled report.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
