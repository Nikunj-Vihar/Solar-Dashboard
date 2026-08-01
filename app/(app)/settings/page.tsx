import { redirect } from "next/navigation";
import { getCurrentSite } from "@/lib/data/site";
import { PublicShareCard } from "./PublicShareCard";

export const metadata = {
  title: "Settings — Solar Dashboard",
};

export default async function SettingsPage() {
  const site = await getCurrentSite();
  if (!site) {
    redirect("/setup");
  }

  return (
    <div className="max-w-lg space-y-4">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <PublicShareCard initialIsPublic={site.is_public} initialSlug={site.public_share_slug} />
    </div>
  );
}
