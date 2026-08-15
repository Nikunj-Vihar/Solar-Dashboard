"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, LayoutDashboard, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const links = [
  { href: "/log", label: "Log", icon: ClipboardList },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/settings", label: "Settings", icon: Settings },
];

// Fixed-size, always-rendered dot so toggling it never shifts layout. Given
// an initial animation delay so a fast (already-prefetched) navigation never
// flashes it -- it only appears once a click is genuinely taking a moment.
function PendingHint() {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden
      className={cn(
        "size-1 rounded-full bg-current transition-opacity",
        pending ? "animate-pulse opacity-100" : "opacity-0",
      )}
      style={pending ? { animationDelay: "100ms" } : undefined}
    />
  );
}

/** The floating pill itself -- same tabs, same active-state language as the
 * dashboard's date-range filter (active = solid bg-primary capsule), reused
 * for both the desktop "top island" and the mobile "bottom island". */
function NavPill() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1 rounded-full border bg-background/95 p-1.5 shadow-lg backdrop-blur-md supports-backdrop-filter:bg-background/80">
      {links.map(({ href, label, icon: Icon }) => {
        const active = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/50",
            )}
          >
            <Icon className="size-4" />
            <span>{label}</span>
            <PendingHint />
          </Link>
        );
      })}
    </nav>
  );
}

/** Desktop: a pill docked in the header's center column, popped forward off
 * the header with its own border/shadow so it reads as a floating "island"
 * rather than flush chrome -- same idea as iOS's dynamic island, just top and
 * stationary instead of adapting shape. Stays visible on scroll because the
 * header itself is already sticky. */
export function DesktopNavIsland() {
  return (
    <div className="hidden sm:block">
      <NavPill />
    </div>
  );
}

/** Mobile: the same pill, detached from the header entirely and pinned to
 * the bottom of the viewport -- the thumb-reachable, unmistakable spot every
 * native app (and this client) already expects primary navigation to live.
 * `env(safe-area-inset-bottom)` keeps it clear of the iPhone home indicator. */
export function MobileNavIsland() {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] z-20 flex justify-center sm:hidden">
      <div className="pointer-events-auto">
        <NavPill />
      </div>
    </div>
  );
}
