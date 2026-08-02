// Generation report Edge Function (spec §6, generalized for the per-site
// report frequency setting) — deployed via
// `supabase functions deploy generation-report`, scheduled daily by pg_cron
// (see supabase/migrations/0008_report_frequency.sql; runs every day and
// decides per-site whether today is that site's send day), and invokable
// manually for testing: supabase functions invoke generation-report
import { createClient } from "npm:@supabase/supabase-js@2.111.0";
import { Resend } from "npm:resend@6.18.1";
import React from "npm:react@19";
import { render } from "npm:@react-email/render@1.0.4";
import { GenerationReportEmail } from "./email-template.tsx";

// Vendored from lib/calc/kpis.ts and lib/calc/reportPeriod.ts — Deno can't
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

type ReportFrequency = "daily" | "weekly" | "monthly" | "off";

type ReportPeriod = {
  label: string;
  start: string;
  end: string;
  days: number;
  previousStart: string;
  previousEnd: string;
  minDaysWithData: number;
  baselineMonth: number;
};

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function ymd(date: Date): string {
  return date.toISOString().slice(0, 10);
}
function addUtcDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}
function shortLabel(date: Date): string {
  return `${MONTH_NAMES[date.getUTCMonth()].slice(0, 3)} ${date.getUTCDate()}`;
}

function isReportDay(frequency: ReportFrequency, today: Date): boolean {
  if (frequency === "off") return false;
  if (frequency === "daily") return true;
  if (frequency === "weekly") return today.getUTCDay() === 1; // Monday
  return today.getUTCDate() === 1; // monthly: 1st of the month
}

function computeReportPeriod(
  frequency: "daily" | "weekly" | "monthly",
  today: Date,
): ReportPeriod {
  if (frequency === "daily") {
    const day = addUtcDays(today, -1);
    const prevDay = addUtcDays(today, -2);
    return {
      label: `${shortLabel(day)}, ${day.getUTCFullYear()}`,
      start: ymd(day),
      end: ymd(day),
      days: 1,
      previousStart: ymd(prevDay),
      previousEnd: ymd(prevDay),
      minDaysWithData: 1,
      baselineMonth: day.getUTCMonth() + 1,
    };
  }

  if (frequency === "weekly") {
    const end = addUtcDays(today, -1);
    const start = addUtcDays(today, -7);
    const prevEnd = addUtcDays(today, -8);
    const prevStart = addUtcDays(today, -14);
    return {
      label: `${shortLabel(start)} – ${shortLabel(end)}, ${end.getUTCFullYear()}`,
      start: ymd(start),
      end: ymd(end),
      days: 7,
      previousStart: ymd(prevStart),
      previousEnd: ymd(prevEnd),
      minDaysWithData: 4,
      baselineMonth: end.getUTCMonth() + 1,
    };
  }

  const thisMonthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const periodStart = new Date(
    Date.UTC(thisMonthStart.getUTCFullYear(), thisMonthStart.getUTCMonth() - 1, 1),
  );
  const daysInMonth = new Date(
    Date.UTC(periodStart.getUTCFullYear(), periodStart.getUTCMonth() + 1, 0),
  ).getUTCDate();
  const periodEnd = new Date(
    Date.UTC(periodStart.getUTCFullYear(), periodStart.getUTCMonth(), daysInMonth),
  );

  const prevPeriodStart = new Date(
    Date.UTC(periodStart.getUTCFullYear(), periodStart.getUTCMonth() - 1, 1),
  );
  const prevDaysInMonth = new Date(
    Date.UTC(prevPeriodStart.getUTCFullYear(), prevPeriodStart.getUTCMonth() + 1, 0),
  ).getUTCDate();
  const prevPeriodEnd = new Date(
    Date.UTC(prevPeriodStart.getUTCFullYear(), prevPeriodStart.getUTCMonth(), prevDaysInMonth),
  );

  return {
    label: `${MONTH_NAMES[periodStart.getUTCMonth()]} ${periodStart.getUTCFullYear()}`,
    start: ymd(periodStart),
    end: ymd(periodEnd),
    days: daysInMonth,
    previousStart: ymd(prevPeriodStart),
    previousEnd: ymd(prevPeriodEnd),
    minDaysWithData: Math.min(20, daysInMonth),
    baselineMonth: periodStart.getUTCMonth() + 1,
  };
}

Deno.serve(async (req: Request) => {
  // A dedicated secret rather than comparing against SUPABASE_SERVICE_ROLE_KEY
  // directly — Supabase's own key format has changed across projects/rotations
  // (legacy long JWT vs. newer short sb_secret_... keys), so pinning auth to
  // a value we mint and control ourselves avoids depending on that. This
  // function is deployed with --no-verify-jwt since callers (pg_cron, manual
  // testing) authenticate with this secret instead of a Supabase-issued JWT.
  const authHeader = req.headers.get("Authorization") ?? "";
  const expected = `Bearer ${Deno.env.get("MONTHLY_REPORT_SECRET")}`;
  if (authHeader !== expected) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const resend = resendApiKey ? new Resend(resendApiKey) : null;
  const siteUrl = Deno.env.get("SITE_URL") ?? "https://solar-dashboard-flax.vercel.app";
  const fromAddress = Deno.env.get("RESEND_FROM") ?? "Solar Dashboard <onboarding@resend.dev>";

  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  const { data: sites, error: sitesErr } = await supabase.from("sites").select(
    "id, name, owner_id, tariff_rate_inr_per_kwh, grid_emission_factor_kg_per_kwh, report_frequency",
  );
  if (sitesErr) {
    return new Response(JSON.stringify({ error: sitesErr.message }), { status: 500 });
  }

  const results: Record<string, unknown>[] = [];

  for (const site of sites ?? []) {
    const frequency = site.report_frequency as ReportFrequency;
    if (frequency === "off") {
      continue; // steady-state for an opted-out site -- not worth a result row
    }
    if (!isReportDay(frequency, today)) {
      continue; // not this site's send day
    }

    const period = computeReportPeriod(frequency, today);

    const { data: inverters } = await supabase
      .from("inverters")
      .select("id, name, dc_capacity_kwp")
      .eq("site_id", site.id);
    if (!inverters || inverters.length === 0) {
      results.push({ site: site.name, frequency, status: "skipped", reason: "no inverters" });
      continue;
    }
    const totalDcCapacityKwp = inverters.reduce((sum, i) => sum + Number(i.dc_capacity_kwp), 0);
    const inverterIds = inverters.map((i) => i.id);

    const { data: readings } = await supabase
      .from("daily_readings")
      .select("inverter_id, reading_date, daily_kwh")
      .in("inverter_id", inverterIds)
      .gte("reading_date", period.start)
      .lte("reading_date", period.end);

    // Only count days with at least one real reading -- a day where every
    // inverter was marked "no reading" has a row but no real daily_kwh, and
    // shouldn't count toward "enough data to report on".
    const distinctDays = new Set(
      (readings ?? []).filter((r) => r.daily_kwh !== null).map((r) => r.reading_date),
    ).size;
    if (distinctDays < period.minDaysWithData) {
      results.push({
        site: site.name,
        frequency,
        status: "skipped",
        reason: `insufficient data (${distinctDays}/${period.days} days logged)`,
      });
      continue;
    }

    const { data: prevReadings } = await supabase
      .from("daily_readings")
      .select("daily_kwh")
      .in("inverter_id", inverterIds)
      .gte("reading_date", period.previousStart)
      .lte("reading_date", period.previousEnd);
    const previousPeriodKwh =
      prevReadings && prevReadings.length > 0
        ? prevReadings.reduce((sum, r) => sum + Number(r.daily_kwh), 0)
        : null;

    const { data: baselineRow } = await supabase
      .from("expected_baseline_monthly")
      .select("expected_daily_kwh_mid")
      .eq("site_id", site.id)
      .eq("month", period.baselineMonth)
      .maybeSingle();
    // Approximation for periods spanning a month boundary (mainly weekly):
    // uses the baseline for the month containing the period's end date,
    // consistent with this dashboard's "estimate, not certified" framing.
    const expectedKwh = baselineRow
      ? Number(baselineRow.expected_daily_kwh_mid) * period.days
      : null;

    const { data: alerts } = await supabase
      .from("alerts")
      .select("message")
      .eq("site_id", site.id)
      .gte("created_at", `${period.start}T00:00:00Z`)
      .lt("created_at", `${period.end}T23:59:59Z`);

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
      results.push({
        site: site.name,
        frequency,
        status: "skipped",
        reason: "no owner email found",
      });
      continue;
    }

    const emailProps = {
      siteName: site.name,
      frequency,
      periodLabel: period.label,
      totalKwh: round2(totalKwh),
      vsPreviousPeriodPercent:
        previousPeriodKwh !== null ? computeVsPercent(totalKwh, previousPeriodKwh) : null,
      vsExpectedPercent: expectedKwh !== null ? computeVsPercent(totalKwh, expectedKwh) : null,
      cufPercent: round2(computeCUF(totalKwh, totalDcCapacityKwp, period.days)),
      specificYieldKwhPerKwp: round2(computeSpecificYield(totalKwh, totalDcCapacityKwp)),
      rupeeSaved: computeRupeeSaved(totalKwh, site.tariff_rate_inr_per_kwh),
      co2OffsetKg: round2(computeCo2OffsetKg(totalKwh, site.grid_emission_factor_kg_per_kwh)),
      perInverterKwh: perInverterKwh.map((i) => ({ name: i.name, kwh: round2(i.kwh) })),
      alertMessages: (alerts ?? []).map((a) => a.message),
      dashboardUrl: `${siteUrl}/dashboard`,
    };

    if (!resend) {
      results.push({
        site: site.name,
        frequency,
        status: "skipped",
        reason: "RESEND_API_KEY not configured",
      });
      continue;
    }

    const html = await render(React.createElement(GenerationReportEmail, emailProps));
    const { error: sendErr } = await resend.emails.send({
      from: fromAddress,
      to: ownerData.user.email,
      subject: `${site.name}: ${period.label} generation report`,
      html,
    });

    if (sendErr) {
      results.push({ site: site.name, frequency, status: "error", reason: sendErr.message });
    } else {
      results.push({ site: site.name, frequency, status: "sent", to: ownerData.user.email, totalKwh });
    }
  }

  return new Response(JSON.stringify({ date: ymd(today), results }, null, 2), {
    headers: { "Content-Type": "application/json" },
  });
});

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
