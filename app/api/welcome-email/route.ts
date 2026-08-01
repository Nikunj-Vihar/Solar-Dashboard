import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@/lib/supabase/server";
import { WelcomeEmail } from "@/emails/WelcomeEmail";

// Fired fire-and-forget by the client right after a successful signup.
// Non-blocking by design: a failure here should never stop someone from
// using the app they just signed up for. The recipient comes from the
// caller's own authenticated session, not a client-supplied body, so this
// can't be used to spam arbitrary addresses.
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return NextResponse.json({ ok: false, reason: "unauthenticated" }, { status: 401 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ ok: false, reason: "RESEND_API_KEY not configured" });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://solar-dashboard-flax.vercel.app";
  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from: "Solar Dashboard <onboarding@resend.dev>",
    to: user.email,
    subject: "Welcome to Solar Dashboard",
    react: WelcomeEmail({
      name: (user.user_metadata?.full_name as string | undefined) ?? null,
      setupUrl: `${siteUrl}/setup`,
    }),
  });

  if (error) {
    return NextResponse.json({ ok: false, reason: error.message });
  }
  return NextResponse.json({ ok: true });
}
