import { redirect } from "next/navigation";
import { getCurrentSite } from "@/lib/data/site";

export default async function SetupPage() {
  const site = await getCurrentSite();
  if (site) {
    redirect("/dashboard");
  }

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-2xl font-semibold">Set up your site</h1>
      <p className="mt-2 text-muted-foreground">
        The setup wizard is coming next in the build.
      </p>
    </div>
  );
}
