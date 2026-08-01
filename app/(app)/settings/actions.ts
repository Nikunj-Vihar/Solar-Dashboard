"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAuthedUser } from "@/lib/data/site";
import { inverterSchema, type InverterInput } from "@/lib/validation/schemas";

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
  | { ok: true; inverter: { id: string; name: string; ratedCapacityKw: number; dcCapacityKwp: number } }
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

  const { name, manufacturer, model, ratedCapacityKw, dcCapacityKwp, installDate } = parsed.data;
  const { data: inserted, error } = await supabase
    .from("inverters")
    .insert({
      site_id: siteId,
      name,
      manufacturer: manufacturer || null,
      model: model || null,
      rated_capacity_kw: ratedCapacityKw,
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
  return { ok: true, inverter: { id: inserted.id, name, ratedCapacityKw, dcCapacityKwp } };
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
