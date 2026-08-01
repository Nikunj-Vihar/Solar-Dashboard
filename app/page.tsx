import { redirect } from "next/navigation";
import { getAuthedUser, getCurrentSite } from "@/lib/data/site";

export default async function RootPage() {
  const user = await getAuthedUser();
  if (!user) {
    redirect("/login");
  }

  const site = await getCurrentSite();
  redirect(site ? "/dashboard" : "/setup");
}
