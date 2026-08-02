import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Verifies spec §10.3 against the real Postgres functions (refresh_alerts,
// check_daily_baseline_deviation) in supabase/migrations/0005_alerts_and_cron.sql —
// these can't be unit tested since the logic lives in the database, not in TS.

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

describeIfLive("alert generation (refresh_alerts, check_daily_baseline_deviation)", () => {
  let admin: SupabaseClient;
  let userId: string;
  let siteId: string;
  let inverterIds: string[];

  /** Creates a fresh confirmed test user + 4-inverter site, with a flat baseline. */
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

    const { error: baselineErr } = await admin.from("expected_baseline_monthly").insert(
      Array.from({ length: 12 }, (_, i) => ({
        site_id: site.id,
        month: i + 1,
        avg_daily_irradiance_kwh_per_m2: 5,
        expected_daily_kwh_low: 85,
        expected_daily_kwh_mid: 100,
        expected_daily_kwh_high: 115,
      })),
    );
    if (baselineErr) throw baselineErr;

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
      .eq("alert_type", "underperformance")
      .eq("is_resolved", false);
    if (error) throw error;

    expect(alerts).toEqual([]);

    await cleanupSite(site2.userId);
  });

  it("a no_reading entry resolves the missing-reading alert without faking a baseline deviation", async () => {
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

    // A day where every inverter is no_reading has zero real generation to
    // compare against the baseline -- it should be skipped, not flagged as
    // "100% below baseline".
    const { error: baselineErr } = await admin.rpc("check_daily_baseline_deviation", {
      p_site_id: site5.siteId,
      p_reading_date: today,
    });
    if (baselineErr) throw baselineErr;
    const { data: deviationAlerts, error: devErr } = await admin
      .from("alerts")
      .select("id")
      .eq("site_id", site5.siteId)
      .eq("alert_type", "baseline_deviation")
      .eq("is_resolved", false);
    if (devErr) throw devErr;
    expect(deviationAlerts).toEqual([]);

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

  it("flags a site-wide baseline deviation and resolves it once corrected", async () => {
    const site3 = await seedSite("baseline");
    const date = ymd(daysAgo(0));

    // Total = 4 * 10 = 40 kWh, vs expected 100 -> 60% below, past the 35% threshold.
    await insertReadingsInChunks(
      site3.inverterIds.map((id) => ({
        inverter_id: id,
        site_id: site3.siteId,
        reading_date: date,
        daily_kwh: 10,
        cumulative_mwh: 10.01,
        entered_by: site3.userId,
      })),
    );

    const { data: deviationAlerts, error: devErr } = await admin
      .from("alerts")
      .select("id, message")
      .eq("site_id", site3.siteId)
      .eq("alert_type", "baseline_deviation")
      .eq("is_resolved", false);
    if (devErr) throw devErr;

    expect(deviationAlerts).toHaveLength(1);
    expect(deviationAlerts[0].message).toMatch(/below the expected baseline/);

    // Correct it: update all 4 to a normal ~25 kWh/day (total 100, matching expected).
    for (const id of site3.inverterIds) {
      const { error: updErr } = await admin
        .from("daily_readings")
        .update({ daily_kwh: 25, cumulative_mwh: 10.025 })
        .eq("inverter_id", id)
        .eq("reading_date", date);
      if (updErr) throw updErr;
    }

    const { data: resolvedCheck, error: resErr } = await admin
      .from("alerts")
      .select("id")
      .eq("site_id", site3.siteId)
      .eq("alert_type", "baseline_deviation")
      .eq("is_resolved", false);
    if (resErr) throw resErr;

    expect(resolvedCheck).toEqual([]);

    await cleanupSite(site3.userId);
  });

  it("get_public_dashboard doesn't get stuck on a stale baseline_deviation alert", async () => {
    const site6 = await seedSite("public-health");
    const slug = `public-health-${Date.now()}`;
    const { error: publicErr } = await admin
      .from("sites")
      .update({ is_public: true, public_share_slug: slug })
      .eq("id", site6.siteId);
    if (publicErr) throw publicErr;

    // A baseline_deviation alert from 10 days ago -- an old, never-"resolved"
    // event, not a current condition -- must not keep health status stuck.
    const staleDate = ymd(daysAgo(10));
    const { error: insertErr } = await admin.from("alerts").insert({
      site_id: site6.siteId,
      alert_type: "baseline_deviation",
      severity: "watch",
      message: "stale deviation",
      reading_date: staleDate,
      is_resolved: false,
    });
    if (insertErr) throw insertErr;

    const { data: staleResult, error: staleErr } = await admin.rpc("get_public_dashboard", {
      p_slug: slug,
    });
    if (staleErr) throw staleErr;
    expect(staleResult.health_status).toBe("Good");

    // A baseline_deviation alert from today should still count as current.
    const { error: recentErr } = await admin.from("alerts").insert({
      site_id: site6.siteId,
      alert_type: "baseline_deviation",
      severity: "watch",
      message: "recent deviation",
      reading_date: ymd(daysAgo(0)),
      is_resolved: false,
    });
    if (recentErr) throw recentErr;

    const { data: recentResult, error: recentFetchErr } = await admin.rpc("get_public_dashboard", {
      p_slug: slug,
    });
    if (recentFetchErr) throw recentFetchErr;
    expect(recentResult.health_status).toBe("Watch");

    await cleanupSite(site6.userId);
  });
});
