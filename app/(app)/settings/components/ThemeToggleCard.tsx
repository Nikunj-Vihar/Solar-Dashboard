"use client";

import { useTheme } from "next-themes";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { key: "light", label: "Light" },
  { key: "dark", label: "Dark" },
  { key: "system", label: "System" },
] as const;

export function ThemeToggleCard() {
  // theme is undefined on the server and on the client's first render
  // (next-themes only knows the persisted value after mount), so
  // aria-pressed/className here will always differ from the server-rendered
  // markup once next-themes resolves and re-renders -- suppressHydrationWarning
  // is next-themes' own documented fix for exactly this (a "mounted" gate
  // would dodge it too, but doing that via setState-in-an-effect trips this
  // repo's react-hooks/set-state-in-effect rule).
  const { theme, setTheme } = useTheme();
  // No explicit choice ever made (theme is undefined, not yet "system")
  // reads the same as "following system" -- the ThemeProvider's own
  // defaultTheme -- so the System pill shows active rather than none of them.
  const isActive = (key: (typeof OPTIONS)[number]["key"]) =>
    theme === key || (theme === undefined && key === "system");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Appearance</CardTitle>
        <CardDescription>Choose how the dashboard looks on this device.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="inline-flex items-center gap-0.5 rounded-full bg-secondary p-0.5 text-sm leading-none">
          {OPTIONS.map((o) => (
            <button
              key={o.key}
              type="button"
              onClick={() => setTheme(o.key)}
              aria-pressed={isActive(o.key)}
              suppressHydrationWarning
              className={cn(
                "rounded-full px-3 py-1.5 font-medium transition-colors",
                isActive(o.key)
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
