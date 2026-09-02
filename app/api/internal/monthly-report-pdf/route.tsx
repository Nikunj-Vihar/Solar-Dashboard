import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMonthlyReportData } from "@/lib/data/monthlyReport";
import { MonthlyReportPDF } from "@/components/reports/MonthlyReportPDF";
import type { SiteWithInverters } from "@/lib/data/site";

// Server-to-server only -- called by the generation-report Edge Function to
// attach a real PDF to the automatic monthly email. Not reachable from the
// browser: gated on a shared secret rather than a user session, since the
// Edge Function has no user to sign in as. Uses the service-role client
// (bypasses RLS) and looks the site up directly by id.
export async function GET(request: Request) {
  const secret = process.env.REPORTS_INTERNAL_SECRET;
  if (!secret || request.headers.get("x-internal-secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const siteId = searchParams.get("siteId");
  const period = searchParams.get("period") ?? "";
  const match = /^(\d{4})-(\d{2})$/.exec(period);
  if (!siteId || !match) {
    return NextResponse.json({ error: "siteId and period=YYYY-MM are required" }, { status: 400 });
  }
  const year = Number(match[1]);
  const month = Number(match[2]);

  const supabase = createAdminClient();
  const { data: site } = await supabase
    .from("sites")
    .select("*, inverters(*)")
    .order("name", { referencedTable: "inverters" })
    .eq("id", siteId)
    .maybeSingle();
  if (!site) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 });
  }

  const report = await getMonthlyReportData(supabase, site as SiteWithInverters, year, month);
  if (!report) {
    return NextResponse.json({ error: "Nothing was logged that month." }, { status: 404 });
  }

  const buffer = await renderToBuffer(<MonthlyReportPDF report={report} />);
  return new NextResponse(new Uint8Array(buffer), {
    headers: { "Content-Type": "application/pdf" },
  });
}
