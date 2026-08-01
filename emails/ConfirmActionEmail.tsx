import { Body, Container, Head, Heading, Html, Link, Preview, Text } from "@react-email/components";

export type ConfirmActionEmailProps = {
  siteName: string | null;
  action: "wipe_data" | "delete_account";
  confirmUrl: string;
};

const COPY = {
  wipe_data: {
    preview: "Confirm: delete all data",
    heading: "Confirm data deletion",
    body: "You (or someone with access to your account) asked to delete all data for {site} — every inverter, every logged reading, every alert. Your login itself stays intact, so this starts you fresh, like a brand-new account.",
  },
  delete_account: {
    preview: "Confirm: delete your account",
    heading: "Confirm account deletion",
    body: "You (or someone with access to your account) asked to permanently delete your Solar Dashboard account for {site} — your data and your login itself. This can't be undone.",
  },
} as const;

export function ConfirmActionEmail({ siteName, action, confirmUrl }: ConfirmActionEmailProps) {
  const copy = COPY[action];
  const body = copy.body.replace("{site}", siteName ?? "your site");

  return (
    <Html>
      <Head />
      <Preview>{copy.preview}</Preview>
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
          <Heading style={{ fontSize: "20px", margin: "0 0 4px" }}>{copy.heading}</Heading>
          <Text style={{ color: "#3f3f46", margin: "0 0 16px" }}>{body}</Text>
          <Link
            href={confirmUrl}
            style={{
              display: "inline-block",
              backgroundColor: "#dc2626",
              color: "#ffffff",
              padding: "10px 20px",
              borderRadius: "6px",
              textDecoration: "none",
              fontSize: "14px",
            }}
          >
            Review and confirm
          </Link>
          <Text style={{ color: "#a1a1aa", fontSize: "12px", margin: "24px 0 0" }}>
            This link expires in 30 minutes and opens a page where you&apos;ll need to confirm
            again before anything is deleted. Didn&apos;t request this? You can safely ignore this
            email — nothing happens unless you click through and confirm.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
