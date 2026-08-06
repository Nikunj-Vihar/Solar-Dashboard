import { redirect } from "next/navigation";
import { Download } from "lucide-react";
import { getAuthedUser, getCurrentSite } from "@/lib/data/site";
import { SiteNameCard } from "./SiteNameCard";
import { ChangePasswordCard } from "./ChangePasswordCard";
import { PublicShareCard } from "./PublicShareCard";
import { InvertersCard } from "./InvertersCard";
import { ReportSettingsCard } from "./ReportSettingsCard";
import { DangerZoneCard } from "./DangerZoneCard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Settings — Solar Dashboard",
};

export default async function SettingsPage() {
  const [user, site] = await Promise.all([getAuthedUser(), getCurrentSite()]);
  if (!user?.email) {
    redirect("/login");
  }
  if (!site) {
    redirect("/setup");
  }

  const activeInverters = site.inverters
    .filter((inv) => inv.is_active)
    .map((inv) => ({
      id: inv.id,
      name: inv.name,
      manufacturer: inv.manufacturer,
      model: inv.model,
      dcCapacityKwp: inv.dc_capacity_kwp,
      installDate: inv.install_date,
    }));

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <SiteNameCard initialName={site.name} />
      <ChangePasswordCard email={user.email} />
      <PublicShareCard initialIsPublic={site.is_public} initialSlug={site.public_share_slug} />
      <InvertersCard initialInverters={activeInverters} />
      <ReportSettingsCard initialFrequency={site.report_frequency} />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Export your data</CardTitle>
          <CardDescription>
            Download every reading you&apos;ve ever logged as a CSV file. There&apos;s no
            automatic backup on our end, so keeping your own copy every so often is a good habit.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" size="sm" nativeButton={false} render={<a href="/export" download />}>
            <Download className="size-4" />
            Download CSV
          </Button>
        </CardContent>
      </Card>
      <DangerZoneCard siteName={site.name} />
    </div>
  );
}
