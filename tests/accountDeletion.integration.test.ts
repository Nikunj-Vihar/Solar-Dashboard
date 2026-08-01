import { describe, it, expect } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Verifies the two destructive paths behind Settings' "Delete all data" /
// "Delete account" (app/(app)/settings/actions.ts: confirmAccountAction) do
// exactly what they claim at the database level: wiping the `sites` row
// removes everything under it but leaves the account itself intact, while
// deleting the auth user cascades through literally everything, including
// the brand-new pending_account_actions table. Runs against the real linked
// Supabase project using throwaway test users, same as
// tests/alerts.integration.test.ts and tests/rls.integration.test.ts.

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hasCredentials = Boolean(url && serviceRoleKey);
const describeIfLive = hasCredentials ? describe : describe.skip;

describeIfLive("account deletion cascades", () => {
  const admin: SupabaseClient = hasCredentials ? createClient(url!, serviceRoleKey!) : (null as never);

  async function seedSite(label: string) {
    const { data: user, error: userErr } = await admin.auth.admin.createUser({
      email: `account-del-${label}-${Date.now()}@example.com`,
      password: "test-password-12345",
      email_confirm: true,
    });
    if (userErr) throw userErr;
    const userId = user.user.id;

    const { data: site, error: siteErr } = await admin
      .from("sites")
      .insert({ owner_id: userId, name: `${label} Site`, latitude: 18.52, longitude: 73.86 })
      .select()
      .single();
    if (siteErr) throw siteErr;

    const { data: inverter, error: invErr } = await admin
      .from("inverters")
      .insert({
        site_id: site.id,
        name: "Inverter 1",
        rated_capacity_kw: 5,
        dc_capacity_kwp: 6,
      })
      .select()
      .single();
    if (invErr) throw invErr;

    const { error: readingErr } = await admin.from("daily_readings").insert({
      inverter_id: inverter.id,
      site_id: site.id,
      reading_date: "2026-01-01",
      daily_kwh: 20,
      cumulative_mwh: 1,
      entered_by: userId,
    });
    if (readingErr) throw readingErr;

    return { userId, siteId: site.id as string, inverterId: inverter.id as string };
  }

  it("wipe_data: deleting the sites row removes its children but keeps the account", async () => {
    const { userId, siteId, inverterId } = await seedSite("wipe");

    const { error: deleteErr } = await admin.from("sites").delete().eq("id", siteId);
    expect(deleteErr).toBeNull();

    const { data: remainingInverters } = await admin
      .from("inverters")
      .select("id")
      .eq("id", inverterId);
    expect(remainingInverters).toEqual([]);

    const { data: remainingReadings } = await admin
      .from("daily_readings")
      .select("id")
      .eq("site_id", siteId);
    expect(remainingReadings).toEqual([]);

    const { data: profile } = await admin.from("profiles").select("id").eq("id", userId).single();
    expect(profile?.id).toBe(userId);

    const { data: userStillExists, error: getUserErr } = await admin.auth.admin.getUserById(userId);
    expect(getUserErr).toBeNull();
    expect(userStillExists.user?.id).toBe(userId);

    await admin.auth.admin.deleteUser(userId);
  });

  it("delete_account: deleting sites first, then the auth user, cascades through everything", async () => {
    const { userId, siteId, inverterId } = await seedSite("delete");

    const { error: pendingErr } = await admin.from("pending_account_actions").insert({
      user_id: userId,
      action: "delete_account",
      token: `test-token-${Date.now()}`,
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    });
    expect(pendingErr).toBeNull();

    // Mirrors confirmAccountAction's delete_account path exactly: sites
    // first (fast, direct delete, cascades to inverters/readings), then the
    // auth user. Deleting the user directly with a real site's full history
    // still attached can hit GoTrue's AuthRetryableFetchError -- the same
    // failure this codebase's own test-cleanup helper (tests/alerts.integration.test.ts)
    // already works around, and which this test caught for the app code too.
    const { error: siteDeleteErr } = await admin.from("sites").delete().eq("id", siteId);
    expect(siteDeleteErr).toBeNull();

    const { error: deleteErr } = await admin.auth.admin.deleteUser(userId);
    expect(deleteErr).toBeNull();

    const { data: userAfterDelete, error: getUserErr } = await admin.auth.admin.getUserById(userId);
    expect(getUserErr).not.toBeNull();
    expect(userAfterDelete?.user).toBeFalsy();

    const { data: remainingProfile } = await admin.from("profiles").select("id").eq("id", userId);
    expect(remainingProfile).toEqual([]);

    const { data: remainingSites } = await admin.from("sites").select("id").eq("id", siteId);
    expect(remainingSites).toEqual([]);

    const { data: remainingInverters } = await admin
      .from("inverters")
      .select("id")
      .eq("id", inverterId);
    expect(remainingInverters).toEqual([]);

    const { data: remainingReadings } = await admin
      .from("daily_readings")
      .select("id")
      .eq("site_id", siteId);
    expect(remainingReadings).toEqual([]);

    const { data: remainingPending } = await admin
      .from("pending_account_actions")
      .select("id")
      .eq("user_id", userId);
    expect(remainingPending).toEqual([]);
  });
});
