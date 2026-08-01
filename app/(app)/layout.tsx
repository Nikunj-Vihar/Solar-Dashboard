import { redirect } from "next/navigation";
import Link from "next/link";
import { Sun } from "lucide-react";
import { getAuthedUser, getCurrentSite } from "@/lib/data/site";
import { NavLinks } from "./nav-links";
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
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-2 px-4">
          <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
            <Sun className="size-5 text-amber-500" />
            <span className="hidden sm:inline">{site?.name ?? "Solar Dashboard"}</span>
          </Link>
          {site && <NavLinks />}
          <SignOutButton />
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
