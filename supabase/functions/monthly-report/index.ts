// Monthly report Edge Function (spec §6). Runs on Supabase's Deno edge
// runtime — deployed via `supabase functions deploy monthly-report`,
// scheduled by pg_cron (see supabase/migrations/0006_monthly_report_cron.sql),
// and invokable manually for testing:
//   supabase functions invoke monthly-report
import { createClient } from "npm:@supabase/supabase-js@2.111.0";
import { Resend } from "npm:resend@6.18.1";
import React from "npm:react@19";
import { render } from "npm:@react-email/render@1.0.4";
import { MonthlyReportEmail } from "./email-template.tsx";

// Vendored from lib/calc/kpis.ts and lib/calc/monthlyReport.ts — Deno can't
// resolve this project's "@/" path alias or npm-installed zod etc, and these
// functions have zero dependencies, so a direct copy is the pragmatic choice
// over a build step just for two files. Keep in sync if the formulas change.
function computeCUF(totalKwh: number, capacityKwp: number, days: number): number {
  if (capacityKwp <= 0 || days <= 0) return 0;
  return (totalKwh / (capacityKwp * 24 * days)) * 100;
}
function computeSpecificYield(totalKwh: number, capacityKwp: number): number {
  if (capacityKwp <= 0) return 0;
  return totalKwh / capacityKwp;
}
function computeRupeeSaved(totalKwh: number, tariffRateInrPerKwh: number | null): number | null {
  if (tariffRateInrPerKwh === null || tariffRateInrPerKwh === undefined) return null;
  return totalKwh * tariffRateInrPerKwh;
}
function computeCo2OffsetKg(totalKwh: number, gridEmissionFactorKgPerKwh: number): number {
  return totalKwh * gridEmissionFactorKgPerKwh;
}
function computeVsPercent(actual: number, expected: number): number | null {
  if (!(expected > 0)) return null;
  return ((actual - expected) / expected) * 100;
}

const MIN_DAYS_WITH_DATA = 20; // data-sufficiency guard, out of ~28-31 days in the month

Deno.serve(async (req: Request) => {
  const authHeader = req.headers.get("Authorization") ?? "";
  const expected = `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`;
  if (authHeader !== expected) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const resend = resendApiKey ? new Resend(resendApiKey) : null;
  const siteUrl = Deno.env.get("SITE_URL") ?? "https://solar-dashboard.vercel.app";
  const fromAddress = Deno.env.get("RESEND_FROM") ?? "Solar Dashboard <onboarding@resend.dev>";

  // Previous calendar month, in UTC — a day or two of ambiguity around the
  // month boundary in a specific site's local timezone is an acceptable
  // trade-off for a report that only needs to be roughly "last month".
  const now = new Date();
  const reportMonthDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const year = reportMonthDate.getUTCFullYear();
  const month = reportMonthDate.getUTCMonth() + 1;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const monthEnd = `${year}-${String(month).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;

  const prevMonthDate = new Date(Date.UTC(year, month - 2, 1));
  const prevYear = prevMonthDate.getUTCFullYear();
  const prevMonth = prevMonthDate.getUTCMonth() + 1;
  const prevDaysInMonth = new Date(Date.UTC(prevYear, prevMonth, 0)).getUTCDate();
  const prevMonthStart = `${prevYear}-${String(prevMonth).padStart(2, "0")}-01`;
  const prevMonthEnd = `${prevYear}-${String(prevMonth).padStart(2, "0")}-${String(prevDaysInMonth).padStart(2, "0")}`;

  const { data: sites, error: sitesErr } = await supabase.from("sites").select(
    "id, name, owner_id, tariff_rate_inr_per_kwh, grid_emission_factor_kg_per_kwh",
  );
  if (sitesErr) {
    return new Response(JSON.stringify({ error: sitesErr.message }), { status: 500 });
  }

  const results: Record<string, unknown>[] = [];

  for (const site of sites ?? []) {
    const { data: inverters } = await supabase
      .from("inverters")
      .select("id, name, dc_capacity_kwp")
      .eq("site_id", site.id);
    if (!inverters || inverters.length === 0) {
      results.push({ site: site.name, status: "skipped", reason: "no inverters" });
      continue;
    }
    const totalDcCapacityKwp = inverters.reduce((sum, i) => sum + Number(i.dc_capacity_kwp), 0);
    const inverterIds = inverters.map((i) => i.id);

    const { data: readings } = await supabase
      .from("daily_readings")
      .select("inverter_id, reading_date, daily_kwh")
      .in("inverter_id", inverterIds)
      .gte("reading_date", monthStart)
      .lte("reading_date", monthEnd);

    const distinctDays = new Set((readings ?? []).map((r) => r.reading_date)).size;
    if (distinctDays < MIN_DAYS_WITH_DATA) {
      results.push({
        site: site.name,
        status: "skipped",
        reason: `insufficient data (${distinctDays}/${daysInMonth} days logged)`,
      });
      continue;
    }

    const { data: prevReadings } = await supabase
      .from("daily_readings")
      .select("daily_kwh")
      .in("inverter_id", inverterIds)
      .gte("reading_date", prevMonthStart)
      .lte("reading_date", prevMonthEnd);
    const previousMonthKwh = prevReadings && prevReadings.length > 0
      ? prevReadings.reduce((sum, r) => sum + Number(r.daily_kwh), 0)
      : null;

    const { data: baselineRow } = await supabase
      .from("expected_baseline_monthly")
      .select("expected_daily_kwh_mid")
      .eq("site_id", site.id)
      .eq("month", month)
      .maybeSingle();
    const expectedKwh = baselineRow ? Number(baselineRow.expected_daily_kwh_mid) * daysInMonth : null;

    const { data: alerts } = await supabase
      .from("alerts")
      .select("message")
      .eq("site_id", site.id)
      .gte("created_at", `${monthStart}T00:00:00Z`)
      .lt("created_at", `${monthEnd}T23:59:59Z`);

    const totalKwh = (readings ?? []).reduce((sum, r) => sum + Number(r.daily_kwh), 0);
    const perInverterKwh = inverters.map((inv) => ({
      name: inv.name,
      kwh: (readings ?? [])
        .filter((r) => r.inverter_id === inv.id)
        .reduce((sum, r) => sum + Number(r.daily_kwh), 0),
    }));

    const { data: ownerData, error: ownerErr } = await supabase.auth.admin.getUserById(
      site.owner_id,
    );
    if (ownerErr || !ownerData?.user?.email) {
      results.push({ site: site.name, status: "skipped", reason: "no owner email found" });
      continue;
    }

    const reportMonthLabel = monthLabel(year, month);

    const emailProps = {
      siteName: site.name,
      monthLabel: reportMonthLabel,
      totalKwh: round2(totalKwh),
      vsPreviousMonthPercent: previousMonthKwh !== null ? computeVsPercent(totalKwh, previousMonthKwh) : null,
      vsExpectedPercent: expectedKwh !== null ? computeVsPercent(totalKwh, expectedKwh) : null,
      cufPercent: round2(computeCUF(totalKwh, totalDcCapacityKwp, daysInMonth)),
      specificYieldKwhPerKwp: round2(computeSpecificYield(totalKwh, totalDcCapacityKwp)),
      rupeeSaved: computeRupeeSaved(totalKwh, site.tariff_rate_inr_per_kwh),
      co2OffsetKg: round2(computeCo2OffsetKg(totalKwh, site.grid_emission_factor_kg_per_kwh)),
      perInverterKwh: perInverterKwh.map((i) => ({ name: i.name, kwh: round2(i.kwh) })),
      alertMessages: (alerts ?? []).map((a) => a.message),
      dashboardUrl: `${siteUrl}/dashboard`,
    };

    if (!resend) {
      results.push({ site: site.name, status: "skipped", reason: "RESEND_API_KEY not configured" });
      continue;
    }

    const html = await render(React.createElement(MonthlyReportEmail, emailProps));
    const { error: sendErr } = await resend.emails.send({
      from: fromAddress,
      to: ownerData.user.email,
      subject: `${site.name}: ${reportMonthLabel} generation report`,
      html,
    });

    if (sendErr) {
      results.push({ site: site.name, status: "error", reason: sendErr.message });
    } else {
      results.push({ site: site.name, status: "sent", to: ownerData.user.email, totalKwh });
    }
  }

  return new Response(JSON.stringify({ month: monthLabel(year, month), results }, null, 2), {
    headers: { "Content-Type": "application/json" },
  });
});

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
function monthLabel(year: number, month: number): string {
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
