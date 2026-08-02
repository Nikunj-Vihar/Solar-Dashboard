"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { Resend } from "resend";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthedUser, getCurrentSite } from "@/lib/data/site";
import { getDashboardData } from "@/lib/data/dashboard";
import { computeHealthStatus, type HealthStatus } from "@/lib/calc/health";
import { computeRupeeSaved, computeCo2OffsetKg } from "@/lib/calc/kpis";
import { inverterSchema, reportFrequencySchema, type InverterInput, type ReportFrequency } from "@/lib/validation/schemas";
import { ConfirmActionEmail } from "@/emails/ConfirmActionEmail";
import { StatusEmail } from "@/emails/StatusEmail";

export type TogglePublicShareResult =
  | { ok: true; isPublic: boolean; slug: string | null }
  | { ok: false; error: string };

export async function togglePublicShare(enable: boolean): Promise<TogglePublicShareResult> {
  const user = await getAuthedUser();
  if (!user) {
    return { ok: false, error: "You must be signed in." };
  }

  const supabase = await createClient();
  const { data: site, error: siteErr } = await supabase
    .from("sites")
    .select("id, public_share_slug")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (siteErr || !site) {
    return { ok: false, error: "Site not found." };
  }

  // Generate a slug the first time sharing is enabled; keep it stable across
  // later toggles so a previously-shared link doesn't silently break.
  const slug = site.public_share_slug ?? randomUUID();

  const { error: updateErr } = await supabase
    .from("sites")
    .update({ is_public: enable, public_share_slug: slug })
    .eq("id", site.id);

  if (updateErr) {
    return { ok: false, error: updateErr.message };
  }

  revalidatePath("/settings");
  return { ok: true, isPublic: enable, slug };
}

type ActionResult = { ok: true } | { ok: false; error: string };

async function getOwnedSiteId(userId: string, supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: site } = await supabase
    .from("sites")
    .select("id")
    .eq("owner_id", userId)
    .maybeSingle();
  return site?.id ?? null;
}

export type AddInverterResult =
  | { ok: true; inverter: { id: string; name: string; dcCapacityKwp: number } }
  | { ok: false; error: string };

export async function addInverter(input: InverterInput): Promise<AddInverterResult> {
  const user = await getAuthedUser();
  if (!user) {
    return { ok: false, error: "You must be signed in." };
  }

  const parsed = inverterSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid inverter details." };
  }

  const supabase = await createClient();
  const siteId = await getOwnedSiteId(user.id, supabase);
  if (!siteId) {
    return { ok: false, error: "Site not found." };
  }

  const { name, manufacturer, model, dcCapacityKwp, installDate } = parsed.data;
  const { data: inserted, error } = await supabase
    .from("inverters")
    .insert({
      site_id: siteId,
      name,
      manufacturer: manufacturer || null,
      model: model || null,
      dc_capacity_kwp: dcCapacityKwp,
      install_date: installDate || null,
    })
    .select("id")
    .single();
  if (error || !inserted) {
    return { ok: false, error: error?.message ?? "Failed to add inverter." };
  }

  revalidatePath("/settings");
  revalidatePath("/log");
  revalidatePath("/dashboard");
  return { ok: true, inverter: { id: inserted.id, name, dcCapacityKwp } };
}

export async function updateInverter(
  inverterId: string,
  input: InverterInput,
): Promise<ActionResult> {
  const user = await getAuthedUser();
  if (!user) {
    return { ok: false, error: "You must be signed in." };
  }

  const parsed = inverterSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid inverter details." };
  }

  const supabase = await createClient();
  const siteId = await getOwnedSiteId(user.id, supabase);
  if (!siteId) {
    return { ok: false, error: "Site not found." };
  }

  const { name, manufacturer, model, dcCapacityKwp, installDate } = parsed.data;
  const { error } = await supabase
    .from("inverters")
    .update({
      name,
      manufacturer: manufacturer || null,
      model: model || null,
      dc_capacity_kwp: dcCapacityKwp,
      install_date: installDate || null,
    })
    .eq("id", inverterId)
    .eq("site_id", siteId);
  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/settings");
  revalidatePath("/log");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function removeInverter(inverterId: string): Promise<ActionResult> {
  const user = await getAuthedUser();
  if (!user) {
    return { ok: false, error: "You must be signed in." };
  }

  const supabase = await createClient();
  const siteId = await getOwnedSiteId(user.id, supabase);
  if (!siteId) {
    return { ok: false, error: "Site not found." };
  }

  // Soft delete only -- daily_readings references inverter_id, and a hard
  // delete would cascade and destroy that inverter's whole logged history.
  // Deactivating keeps the audit trail while hiding it from logging/dashboard.
  const { count } = await supabase
    .from("inverters")
    .select("id", { count: "exact", head: true })
    .eq("site_id", siteId)
    .eq("is_active", true);
  if ((count ?? 0) <= 1) {
    return { ok: false, error: "You need at least one active inverter." };
  }

  const { error } = await supabase
    .from("inverters")
    .update({ is_active: false })
    .eq("id", inverterId)
    .eq("site_id", siteId);
  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/settings");
  revalidatePath("/log");
  revalidatePath("/dashboard");
  return { ok: true };
}

export type AccountAction = "wipe_data" | "delete_account";

export type RequestAccountActionResult = { ok: true } | { ok: false; error: string };

/**
 * Sends a confirmation link for a destructive account action; nothing is
 * deleted until the user opens the emailed link AND explicitly confirms
 * again on /settings/confirm (see confirmAccountAction below).
 */
export async function requestAccountAction(
  action: AccountAction,
): Promise<RequestAccountActionResult> {
  const user = await getAuthedUser();
  if (!user?.email) {
    return { ok: false, error: "You must be signed in." };
  }

  const supabase = await createClient();
  const { data: site } = await supabase
    .from("sites")
    .select("name")
    .eq("owner_id", user.id)
    .maybeSingle();

  const token = randomUUID();
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

  const { error: upsertErr } = await supabase
    .from("pending_account_actions")
    .upsert({ user_id: user.id, action, token, expires_at: expiresAt }, { onConflict: "user_id" });
  if (upsertErr) {
    return { ok: false, error: upsertErr.message };
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "Email isn't configured yet — contact support." };
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://solar-dashboard-flax.vercel.app";
  const resend = new Resend(apiKey);
  const { error: sendErr } = await resend.emails.send({
    from: "Solar Dashboard <onboarding@resend.dev>",
    to: user.email,
    subject: action === "wipe_data" ? "Confirm: delete all data" : "Confirm: delete your account",
    react: ConfirmActionEmail({
      siteName: site?.name ?? null,
      action,
      confirmUrl: `${siteUrl}/settings/confirm?token=${token}`,
    }),
  });
  if (sendErr) {
    return { ok: false, error: sendErr.message };
  }

  return { ok: true };
}

export type ConfirmAccountActionResult =
  | { ok: true; action: AccountAction }
  | { ok: false; error: string };

/** Performs the actual deletion. Called only from the explicit confirm button on /settings/confirm. */
export async function confirmAccountAction(token: string): Promise<ConfirmAccountActionResult> {
  const user = await getAuthedUser();
  if (!user) {
    return { ok: false, error: "You must be signed in." };
  }

  const supabase = await createClient();
  const { data: pending } = await supabase
    .from("pending_account_actions")
    .select("id, action, expires_at")
    .eq("token", token)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!pending) {
    return { ok: false, error: "This link is invalid or was already used." };
  }

  await supabase.from("pending_account_actions").delete().eq("id", pending.id);

  if (new Date(pending.expires_at) < new Date()) {
    return { ok: false, error: "This link has expired — request a new one from Settings." };
  }

  const action = pending.action as AccountAction;

  if (action === "wipe_data") {
    const { error } = await supabase.from("sites").delete().eq("owner_id", user.id);
    if (error) {
      return { ok: false, error: error.message };
    }
    return { ok: true, action };
  }

  // delete_account: delete the sites row first, same as wipe_data, before
  // touching the auth user at all. GoTrue runs deleteUser's cascade in one
  // transaction, and letting it walk a real site's full reading/audit-log
  // history in the same call as the user delete can time out
  // (AuthRetryableFetchError) -- confirmed by this exact failure in
  // tests/accountDeletion.integration.test.ts. Pre-deleting sites leaves
  // only the small profiles -> pending_account_actions cascade for
  // deleteUser to walk.
  const { error: siteDeleteErr } = await supabase.from("sites").delete().eq("owner_id", user.id);
  if (siteDeleteErr) {
    return { ok: false, error: siteDeleteErr.message };
  }

  // Sign out this session while it's still valid, then delete the auth user
  // via the service-role client.
  await supabase.auth.signOut();
  const { error } = await createAdminClient().auth.admin.deleteUser(user.id);
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true, action };
}

export type UpdateReportFrequencyResult = { ok: true } | { ok: false; error: string };

export async function updateReportFrequency(
  frequency: ReportFrequency,
): Promise<UpdateReportFrequencyResult> {
  const user = await getAuthedUser();
  if (!user) {
    return { ok: false, error: "You must be signed in." };
  }

  const parsed = reportFrequencySchema.safeParse(frequency);
  if (!parsed.success) {
    return { ok: false, error: "Invalid frequency." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("sites")
    .update({ report_frequency: parsed.data })
    .eq("owner_id", user.id);
  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/settings");
  return { ok: true };
}

const HEALTH_LABEL: Record<HealthStatus, string> = {
  good: "Good",
  watch: "Watch",
  needs_attention: "Needs Attention",
};

export type SendStatusEmailResult = { ok: true } | { ok: false; error: string };

/** On-demand snapshot email -- distinct from the scheduled periodic report (see updateReportFrequency). */
export async function sendStatusEmailNow(): Promise<SendStatusEmailResult> {
  const user = await getAuthedUser();
  if (!user?.email) {
    return { ok: false, error: "You must be signed in." };
  }

  const site = await getCurrentSite();
  if (!site) {
    return { ok: false, error: "Complete setup before sending a status email." };
  }

  const data = await getDashboardData(site);
  const healthStatus = computeHealthStatus(data.alerts);

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "Email isn't configured yet — contact support." };
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://solar-dashboard-flax.vercel.app";
  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from: "Solar Dashboard <onboarding@resend.dev>",
    to: user.email,
    subject: `${site.name}: status snapshot`,
    react: StatusEmail({
      siteName: site.name,
      todayKwh: data.todayKwh,
      monthKwh: data.monthKwh,
      lifetimeKwh: data.lifetimeKwh,
      healthLabel: HEALTH_LABEL[healthStatus],
      rupeeSaved: computeRupeeSaved(data.monthKwh, site.tariff_rate_inr_per_kwh),
      co2OffsetKg: computeCo2OffsetKg(data.monthKwh, site.grid_emission_factor_kg_per_kwh),
      alertMessages: data.alerts.map((a) => a.message),
      dashboardUrl: `${siteUrl}/dashboard`,
    }),
  });
  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}
