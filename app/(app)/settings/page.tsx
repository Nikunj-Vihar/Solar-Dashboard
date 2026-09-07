import { redirect } from "next/navigation";
import { Download } from "lucide-react";
import { getAuthedUser, getCurrentSite } from "@/lib/data/site";
import { ThemeToggleCard } from "./components/ThemeToggleCard";
import { InstallAppCard } from "./components/InstallAppCard";
import { SiteNameCard } from "./components/SiteNameCard";
import { ChangePasswordCard } from "./components/ChangePasswordCard";
import { PublicShareCard } from "./components/PublicShareCard";
import { InvertersCard } from "./components/InvertersCard";
import { ReportSettingsCard } from "./components/ReportSettingsCard";
import { DangerZoneCard } from "./components/DangerZoneCard";
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
    <div className="mx-auto max-w-lg space-y-6 lg:max-w-none">
      <h1 className="text-2xl font-semibold">Settings</h1>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <h2 className="text-sm font-medium text-muted-foreground">Account</h2>
          <ThemeToggleCard />
          <InstallAppCard />
          <ChangePasswordCard email={user.email} />
        </div>

        <div className="space-y-4">
          <h2 className="text-sm font-medium text-muted-foreground">Site</h2>
          <SiteNameCard initialName={site.name} />
          <PublicShareCard initialIsPublic={site.is_public} initialSlug={site.public_share_slug} />
          <InvertersCard initialInverters={activeInverters} />
          <ReportSettingsCard initialFrequency={site.report_frequency} />
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Export your data</CardTitle>
              <CardDescription>
                Download every reading you&apos;ve ever logged as a CSV file. There&apos;s no
                automatic backup on our end, so keeping your own copy every so often is a good
                habit.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                size="sm"
                nativeButton={false}
                render={<a href="/export" download />}
              >
                <Download className="size-4" />
                Download CSV
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <DangerZoneCard siteName={site.name} />
    </div>
  );
}
