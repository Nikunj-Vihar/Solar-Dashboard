import { redirect } from "next/navigation";
import { getCurrentSite } from "@/lib/data/site";

export default async function SettingsPage() {
  const site = await getCurrentSite();
  if (!site) {
    redirect("/setup");
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold">Settings</h1>
      <p className="mt-2 text-muted-foreground">Settings coming later in the build.</p>
    </div>
  );
}
