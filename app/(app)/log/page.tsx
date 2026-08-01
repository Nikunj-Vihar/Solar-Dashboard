import { redirect } from "next/navigation";
import { getCurrentSite } from "@/lib/data/site";

export default async function LogPage() {
  const site = await getCurrentSite();
  if (!site) {
    redirect("/setup");
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold">Log today&apos;s readings</h1>
      <p className="mt-2 text-muted-foreground">Logging form coming next in the build.</p>
    </div>
  );
}
