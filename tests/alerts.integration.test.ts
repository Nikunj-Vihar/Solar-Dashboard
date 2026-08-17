import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { computeHealthStatus } from "@/lib/calc/health";

// Verifies the real Postgres functions (refresh_alerts, get_public_dashboard)
// in supabase/migrations/0005_alerts_and_cron.sql and
// 0017_self_referential_baseline.sql -- these can't be unit tested since the
// logic lives in the database, not in TS.

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hasCredentials = Boolean(url && serviceRoleKey);
const describeIfLive = hasCredentials ? describe : describe.skip;

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function daysAgo(n: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}

describeIfLive("alert generation (refresh_alerts, get_public_dashboard)", () => {
  let admin: SupabaseClient;
  let userId: string;
  let siteId: string;
  let inverterIds: string[];

  /** Creates a fresh confirmed test user + 4-inverter site. */
  async function seedSite(label: string) {
    const { data: user, error: userErr } = await admin.auth.admin.createUser({
      email: `alerts-test-${label}-${Date.now()}@example.com`,
      password: "test-password-12345",
      email_confirm: true,
    });
    if (userErr) throw userErr;
    const newUserId = user.user.id;

    const { data: site, error: siteErr } = await admin
      .from("sites")
      .insert({
        owner_id: newUserId,
        name: `${label} Site`,
        latitude: 18.52,
        longitude: 73.86,
        timezone: "Asia/Kolkata",
      })
      .select()
      .single();
    if (siteErr) throw siteErr;

    const { data: inverters, error: invErr } = await admin
      .from("inverters")
      .insert(
        Array.from({ length: 4 }, (_, i) => ({
          site_id: site.id,
          name: `Inverter ${i + 1}`,
          rated_capacity_kw: 5.5,
          dc_capacity_kwp: 6.6,
        })),
      )
      .select();
    if (invErr) throw invErr;

    return { userId: newUserId, siteId: site.id as string, inverterIds: inverters.map((i) => i.id as string) };
  }

  async function insertReadingsInChunks(rows: Record<string, unknown>[]) {
    for (let i = 0; i < rows.length; i += 100) {
      const { error } = await admin.from("daily_readings").insert(rows.slice(i, i + 100));
      if (error) throw error;
    }
  }

  /**
   * Deletes the site row first (fast, simple delete, cascades to
   * inverters/readings/alerts), then the auth user -- deleting a user with a
   * large cascade in one GoTrue-managed transaction can time out
   * (AuthRetryableFetchError), which silently orphaned test accounts when
   * this only called deleteUser() directly.
   */
  async function cleanupSite(id: string) {
    await admin.from("sites").delete().eq("owner_id", id);
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) throw new Error(`Failed to clean up test user ${id}: ${error.message}`);
  }

  beforeAll(async () => {
    admin = createClient(url!, serviceRoleKey!);
    const seeded = await seedSite("underperf");
    userId = seeded.userId;
    siteId = seeded.siteId;
    inverterIds = seeded.inverterIds;
  });

  afterAll(async () => {
    await cleanupSite(userId);
  });

  it("flags the one inverter deliberately logged low, and no one else", async () => {
    const rows = [];
    // 37 days of history: inverters 0-2 steady at 25 kWh/day throughout.
    // Inverter 3 also steady at 25 for the first 30 days (baseline window),
    // then drops to 10 kWh/day (60% down) for the most recent 7 days.
    for (let d = 36; d >= 0; d--) {
      const date = ymd(daysAgo(d));
      for (let i = 0; i < 4; i++) {
        const isDroppedInverter = i === 3 && d <= 6;
        rows.push({
          inverter_id: inverterIds[i],
          site_id: siteId,
          reading_date: date,
          daily_kwh: isDroppedInverter ? 10 : 25,
          cumulative_mwh: 10 + (36 - d) * 0.025,
          entered_by: userId,
        });
      }
    }
    await insertReadingsInChunks(rows);

    const { data: alerts, error } = await admin
      .from("alerts")
      .select("inverter_id, alert_type, severity, message")
      .eq("site_id", siteId)
      .eq("alert_type", "underperformance")
      .eq("is_resolved", false);
    if (error) throw error;

    expect(alerts).toHaveLength(1);
    expect(alerts[0].inverter_id).toBe(inverterIds[3]);
    expect(alerts[0].message).toMatch(/Inverter 4/);
    expect(alerts[0].message).toMatch(/below its 30-day average/);
  });

  it("does not flag normal day-to-day variation across all inverters", async () => {
    const site2 = await seedSite("normal");

    // +/-10% variation, well under the 20% underperformance threshold.
    const rows = [];
    for (let d = 36; d >= 0; d--) {
      const date = ymd(daysAgo(d));
      for (let i = 0; i < 4; i++) {
        const variation = ((d * 7 + i * 3) % 10) - 5; // deterministic -5..+4
        rows.push({
          inverter_id: site2.inverterIds[i],
          site_id: site2.siteId,
          reading_date: date,
          daily_kwh: 25 + variation,
          cumulative_mwh: 10 + (36 - d) * 0.025,
          entered_by: site2.userId,
        });
      }
    }
    await insertReadingsInChunks(rows);

    const { data: alerts, error } = await admin
      .from("alerts")
      .select("id")
      .eq("site_id", site2.siteId)
      .in("alert_type", ["underperformance", "site_underperformance"])
      .eq("is_resolved", false);
    if (error) throw error;

    expect(alerts).toEqual([]);

    await cleanupSite(site2.userId);
  });

  it("a no_reading entry resolves the missing-reading alert", async () => {
    const site5 = await seedSite("noreading");

    // Stale for 4 days -> missing_reading should fire for every inverter.
    const staleDate = ymd(daysAgo(4));
    await insertReadingsInChunks(
      site5.inverterIds.map((id) => ({
        inverter_id: id,
        site_id: site5.siteId,
        reading_date: staleDate,
        daily_kwh: 25,
        cumulative_mwh: 10.025,
        entered_by: site5.userId,
      })),
    );
    const { error: rpcErr1 } = await admin.rpc("refresh_alerts", { p_site_id: site5.siteId });
    if (rpcErr1) throw rpcErr1;
    const { data: before, error: beforeErr } = await admin
      .from("alerts")
      .select("id")
      .eq("site_id", site5.siteId)
      .eq("alert_type", "missing_reading")
      .eq("is_resolved", false);
    if (beforeErr) throw beforeErr;
    expect(before.length).toBe(4);

    // Explicitly mark every inverter as "no reading" for today rather than
    // logging real numbers.
    const today = ymd(daysAgo(0));
    await insertReadingsInChunks(
      site5.inverterIds.map((id) => ({
        inverter_id: id,
        site_id: site5.siteId,
        reading_date: today,
        daily_kwh: null,
        cumulative_mwh: null,
        no_reading: true,
        entered_by: site5.userId,
      })),
    );
    const { error: rpcErr2 } = await admin.rpc("refresh_alerts", { p_site_id: site5.siteId });
    if (rpcErr2) throw rpcErr2;

    const { data: afterMissing, error: afterErr } = await admin
      .from("alerts")
      .select("id")
      .eq("site_id", site5.siteId)
      .eq("alert_type", "missing_reading")
      .eq("is_resolved", false);
    if (afterErr) throw afterErr;
    expect(afterMissing).toEqual([]);

    await cleanupSite(site5.userId);
  });

  it("flags a missing reading after 2+ days of silence", async () => {
    const site4 = await seedSite("missing");

    // Last reading is 4 days ago for every inverter — nothing logged since.
    const staleDate = ymd(daysAgo(4));
    await insertReadingsInChunks(
      site4.inverterIds.map((id) => ({
        inverter_id: id,
        site_id: site4.siteId,
        reading_date: staleDate,
        daily_kwh: 25,
        cumulative_mwh: 10.025,
        entered_by: site4.userId,
      })),
    );

    // The insert trigger already ran refresh_alerts, but call it again
    // explicitly too, matching the daily pg_cron sweep's job.
    const { error: rpcErr } = await admin.rpc("refresh_alerts", { p_site_id: site4.siteId });
    if (rpcErr) throw rpcErr;

    const { data: alerts, error } = await admin
      .from("alerts")
      .select("inverter_id, message")
      .eq("site_id", site4.siteId)
      .eq("alert_type", "missing_reading")
      .eq("is_resolved", false);
    if (error) throw error;

    expect(alerts.length).toBe(4);
    expect(alerts[0].message).toMatch(/No reading logged/);

    await cleanupSite(site4.userId);
  });

  it("flags a site-wide underperformance drop and resolves it once corrected", async () => {
    const site3 = await seedSite("site-underperf");

    // 37 days of history, all 4 inverters: steady at 25 kWh/day for the
    // first 30 days (the trailing-30-day baseline window), then dropped to
    // 15 kWh/day (40% down) for the most recent 7 days -- past the site-wide
    // check's -20% threshold (same threshold as the per-inverter check,
    // applied to the site-wide daily total instead of one inverter).
    const rows = [];
    for (let d = 36; d >= 0; d--) {
      const date = ymd(daysAgo(d));
      for (const id of site3.inverterIds) {
        rows.push({
          inverter_id: id,
          site_id: site3.siteId,
          reading_date: date,
          daily_kwh: d <= 6 ? 15 : 25,
          cumulative_mwh: 10 + (36 - d) * 0.025,
          entered_by: site3.userId,
        });
      }
    }
    await insertReadingsInChunks(rows);

    const { data: siteAlerts, error: siteErr } = await admin
      .from("alerts")
      .select("id, inverter_id, message")
      .eq("site_id", site3.siteId)
      .eq("alert_type", "site_underperformance")
      .eq("is_resolved", false);
    if (siteErr) throw siteErr;

    expect(siteAlerts).toHaveLength(1);
    expect(siteAlerts[0].inverter_id).toBeNull();
    expect(siteAlerts[0].message).toMatch(/Total site generation/);
    expect(siteAlerts[0].message).toMatch(/below its own 30-day average/);

    // Correct the most recent 7 days back to the normal 25 kWh/day.
    const cutoff = ymd(daysAgo(6));
    const { error: updErr } = await admin
      .from("daily_readings")
      .update({ daily_kwh: 25 })
      .eq("site_id", site3.siteId)
      .gte("reading_date", cutoff);
    if (updErr) throw updErr;
    const { error: rpcErr } = await admin.rpc("refresh_alerts", { p_site_id: site3.siteId });
    if (rpcErr) throw rpcErr;

    const { data: resolvedCheck, error: resErr } = await admin
      .from("alerts")
      .select("id")
      .eq("site_id", site3.siteId)
      .eq("alert_type", "site_underperformance")
      .eq("is_resolved", false);
    if (resErr) throw resErr;

    expect(resolvedCheck).toEqual([]);

    await cleanupSite(site3.userId);
  });

  it("get_public_dashboard returns raw unresolved alert rows in the shape computeHealthStatus expects", async () => {
    const site6 = await seedSite("public-health");
    const slug = `public-health-${Date.now()}`;
    const { error: publicErr } = await admin
      .from("sites")
      .update({ is_public: true, public_share_slug: slug })
      .eq("id", site6.siteId);
    if (publicErr) throw publicErr;

    const { data: emptyData, error: emptyErr } = await admin.rpc("get_public_dashboard", {
      p_slug: slug,
    });
    if (emptyErr) throw emptyErr;
    expect(emptyData.alerts).toEqual([]);
    expect(computeHealthStatus(emptyData.alerts)).toBe("good");

    const { error: insertErr } = await admin.from("alerts").insert({
      site_id: site6.siteId,
      alert_type: "missing_reading",
      severity: "watch",
      message: "No reading logged for Inverter 1 for 3 days.",
      reading_date: ymd(daysAgo(0)),
      is_resolved: false,
    });
    if (insertErr) throw insertErr;

    const { data, error } = await admin.rpc("get_public_dashboard", { p_slug: slug });
    if (error) throw error;
    expect(data.alerts).toHaveLength(1);
    expect(data.alerts[0]).toMatchObject({ alert_type: "missing_reading", severity: "watch" });
    expect(computeHealthStatus(data.alerts)).toBe("watch");

    await cleanupSite(site6.userId);
  });

  it("get_public_dashboard returns full reading history and active inverters for the range filter", async () => {
    const site7 = await seedSite("public-range");
    const slug = `public-range-${Date.now()}`;
    const { error: publicErr } = await admin
      .from("sites")
      .update({ is_public: true, public_share_slug: slug })
      .eq("id", site7.siteId);
    if (publicErr) throw publicErr;

    const rows = site7.inverterIds.map((invId) => ({
      site_id: site7.siteId,
      inverter_id: invId,
      reading_date: ymd(daysAgo(1)),
      daily_kwh: 20,
      cumulative_mwh: 1,
      no_reading: false,
      entered_by: site7.userId,
    }));
    await insertReadingsInChunks(rows);

    const { data, error } = await admin.rpc("get_public_dashboard", { p_slug: slug });
    if (error) throw error;
    expect(data.inverters).toHaveLength(4);
    expect(data.readings).toHaveLength(4);
    expect(data.readings[0]).toMatchObject({ daily_kwh: 20, no_reading: false });

    await cleanupSite(site7.userId);
  });
});
