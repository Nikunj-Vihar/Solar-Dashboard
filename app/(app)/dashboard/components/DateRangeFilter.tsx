"use client";

import { useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarRange, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { addDays, addMonths, startOfMonth } from "@/lib/date";
import { resolveDateRange } from "@/lib/calc/range";
import { formatRangeLabel } from "@/lib/format";

type Preset = { key: string; label: string; from: string; to: string };

export function DateRangeFilter({ today, earliestDate }: { today: string; earliestDate: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [customOpen, setCustomOpen] = useState(false);

  // Reuses the exact same resolution the server used for this request, so
  // the highlighted preset (and the fallback when nothing's in the URL yet)
  // always matches what's actually on screen.
  const { from, to } = resolveDateRange(
    searchParams.get("from") ?? undefined,
    searchParams.get("to") ?? undefined,
    today,
  );

  const [draftFrom, setDraftFrom] = useState(from);
  const [draftTo, setDraftTo] = useState(to);

  const presets = useMemo<Preset[]>(() => {
    const thisMonthStart = startOfMonth(today);
    const lastMonthStart = addMonths(thisMonthStart, -1);
    const lastMonthEnd = addDays(thisMonthStart, -1);
    return [
      { key: "today", label: "Today", from: today, to: today },
      { key: "7d", label: "Last 7 days", from: addDays(today, -6), to: today },
      { key: "30d", label: "Last 30 days", from: addDays(today, -29), to: today },
      { key: "this_month", label: "This month", from: thisMonthStart, to: today },
      { key: "last_month", label: "Last month", from: lastMonthStart, to: lastMonthEnd },
      { key: "90d", label: "Last 90 days", from: addDays(today, -89), to: today },
      { key: "lifetime", label: "Lifetime", from: earliestDate, to: today },
    ];
  }, [today, earliestDate]);

  const activePreset = presets.find((p) => p.from === from && p.to === to);
  const activeLabel = activePreset?.label ?? formatRangeLabel(from, to);

  function navigate(nextFrom: string, nextTo: string) {
    startTransition(() => {
      router.push(`${pathname}?from=${nextFrom}&to=${nextTo}`);
    });
  }

  function applyCustom() {
    if (!draftFrom || !draftTo || draftFrom > draftTo) return;
    setCustomOpen(false);
    navigate(draftFrom, draftTo);
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <div
        className={`flex flex-wrap items-center gap-1.5 transition-opacity ${isPending ? "opacity-60" : "opacity-100"}`}
      >
        {presets.map((p) => {
          const isActive = activePreset?.key === p.key;
          return (
            <Button
              key={p.key}
              variant={isActive ? "default" : "outline"}
              size="sm"
              onClick={() => navigate(p.from, p.to)}
            >
              {isActive && <Check className="size-3.5" />}
              {p.label}
            </Button>
          );
        })}
        <Popover
          open={customOpen}
          onOpenChange={(open) => {
            setCustomOpen(open);
            if (open) {
              setDraftFrom(from);
              setDraftTo(to);
            }
          }}
        >
          <PopoverTrigger render={<Button variant={!activePreset ? "default" : "outline"} size="sm" />}>
            {!activePreset ? <Check className="size-3.5" /> : <CalendarRange className="size-3.5" />}
            {!activePreset ? formatRangeLabel(from, to) : "Custom"}
          </PopoverTrigger>
          <PopoverContent className="w-auto">
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <div className="flex flex-col gap-1">
                  <Label htmlFor="range-from" className="text-xs text-muted-foreground">
                    From
                  </Label>
                  <Input
                    id="range-from"
                    type="date"
                    value={draftFrom}
                    min={earliestDate}
                    max={draftTo || today}
                    onChange={(e) => setDraftFrom(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="range-to" className="text-xs text-muted-foreground">
                    To
                  </Label>
                  <Input
                    id="range-to"
                    type="date"
                    value={draftTo}
                    min={draftFrom || earliestDate}
                    max={today}
                    onChange={(e) => setDraftTo(e.target.value)}
                  />
                </div>
              </div>
              <Button
                size="sm"
                disabled={!draftFrom || !draftTo || draftFrom > draftTo}
                onClick={applyCustom}
              >
                Apply
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
      <p className="text-xs text-muted-foreground">
        Showing <span className="font-medium text-foreground">{activeLabel}</span>
      </p>
    </div>
  );
}
