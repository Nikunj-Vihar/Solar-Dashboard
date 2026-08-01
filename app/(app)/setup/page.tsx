import { redirect } from "next/navigation";
import { getCurrentSite } from "@/lib/data/site";
import { SetupWizard } from "./SetupWizard";

export const metadata = {
  title: "Set up your site — Solar Dashboard",
};

export default async function SetupPage() {
  const site = await getCurrentSite();
  if (site) {
    redirect("/dashboard");
  }

  return <SetupWizard />;
}
