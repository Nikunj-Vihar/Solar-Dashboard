import { redirect } from "next/navigation";
import Link from "next/link";
import { Sun } from "lucide-react";
import { getAuthedUser, getCurrentSite } from "@/lib/data/site";
import { DesktopNavIsland, MobileNavIsland } from "./nav-links";
import { SignOutButton } from "@/components/sign-out-button";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getAuthedUser();
  if (!user) {
    redirect("/login");
  }

  const site = await getCurrentSite();

  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
        {/* Grid, not flex-justify-between: with 3 unequal-width children,
            justify-between only pins the outer two to the edges and lets the
            middle one land wherever the leftover space happens to put it --
            so the nav island visibly drifts off-center whenever the site
            name is shorter/longer than the sign-out button. A 1fr/auto/1fr
            grid keeps the middle column genuinely centered regardless. Below
            sm, navigation moves to MobileNavIsland instead, so the middle
            column collapses to nothing and the site name gets the room. */}
        <div className="mx-auto grid h-14 max-w-5xl grid-cols-[1fr_auto_1fr] items-center gap-2 px-4">
          <Link
            href="/dashboard"
            className="flex min-w-0 items-center gap-2 justify-self-start font-semibold"
          >
            <Sun className="size-5 shrink-0 text-amber-500" />
            <span className="truncate">{site?.name ?? "Solar Dashboard"}</span>
          </Link>
          <div className="justify-self-center">{site && <DesktopNavIsland />}</div>
          <div className="justify-self-end">
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-6 pb-24 sm:pb-6">{children}</main>
      {site && <MobileNavIsland />}
    </div>
  );
}
