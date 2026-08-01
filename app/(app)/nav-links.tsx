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

export function NavLinks() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1">
      {links.map(({ href, label, icon: Icon }) => {
        const active = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-secondary text-secondary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/50",
            )}
          >
            <Icon className="size-4" />
            <span className="hidden sm:inline">{label}</span>
            <PendingHint />
          </Link>
        );
      })}
    </nav>
  );
}
