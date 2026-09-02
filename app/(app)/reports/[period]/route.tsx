import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { getAuthedUser, getCurrentSite } from "@/lib/data/site";
import { getMonthlyReportData } from "@/lib/data/monthlyReport";
import { MonthlyReportPDF } from "@/components/reports/MonthlyReportPDF";
import { todayInTimezone } from "@/lib/date";

// On-demand download of a real monthly PDF report (Settings > Monthly reports).
// `period` is YYYY-MM. Only fully-closed past months are servable -- the
// current, still-accruing month would make CUF/specific yield and the
// vs-last-month comparison misleading (partial month vs. a full one).
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ period: string }> },
) {
  const user = await getAuthedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const site = await getCurrentSite();
  if (!site) {
    return NextResponse.json({ error: "No site found" }, { status: 404 });
  }

  const { period } = await params;
  const match = /^(\d{4})-(\d{2})$/.exec(period);
  if (!match) {
    return NextResponse.json({ error: "Invalid period, expected YYYY-MM" }, { status: 400 });
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) {
    return NextResponse.json({ error: "Invalid period, expected YYYY-MM" }, { status: 400 });
  }

  const currentYearMonth = todayInTimezone(site.timezone).slice(0, 7);
  if (period >= currentYearMonth) {
    return NextResponse.json(
      { error: "Only fully-closed past months can be downloaded." },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const report = await getMonthlyReportData(supabase, site, year, month);
  if (!report) {
    return NextResponse.json({ error: "Nothing was logged that month." }, { status: 404 });
  }

  const buffer = await renderToBuffer(<MonthlyReportPDF report={report} />);
  const slug = site.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase();

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${slug}-${period}-report.pdf"`,
    },
  });
}
