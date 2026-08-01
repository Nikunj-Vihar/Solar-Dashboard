import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Text,
} from "@react-email/components";

export type WelcomeEmailProps = {
  name: string | null;
  setupUrl: string;
};

export function WelcomeEmail({ name, setupUrl }: WelcomeEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Your Solar Dashboard account is ready</Preview>
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
          <Heading style={{ fontSize: "20px", margin: "0 0 4px" }}>
            Welcome{name ? `, ${name}` : ""}
          </Heading>
          <Text style={{ color: "#3f3f46", margin: "0 0 16px" }}>
            Your Solar Dashboard account is set up. Add your site and inverters to start tracking
            daily generation, and we&apos;ll take it from there — health status, trends, and a
            monthly report land in your dashboard automatically.
          </Text>
          <Link
            href={setupUrl}
            style={{
              display: "inline-block",
              backgroundColor: "#18181b",
              color: "#ffffff",
              padding: "10px 20px",
              borderRadius: "6px",
              textDecoration: "none",
              fontSize: "14px",
            }}
          >
            Set up your site
          </Link>
          <Text style={{ color: "#a1a1aa", fontSize: "12px", margin: "24px 0 0" }}>
            Didn&apos;t create this account? You can safely ignore this email.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
