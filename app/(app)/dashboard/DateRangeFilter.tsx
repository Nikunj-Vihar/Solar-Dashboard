"use client";

import { useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarRange } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { addDays, addMonths, startOfMonth } from "@/lib/date";
import { formatRangeLabel } from "@/lib/format";

type Preset = { key: string; label: string; from: string; to: string };

export function DateRangeFilter({ today, earliestDate }: { today: string; earliestDate: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [customOpen, setCustomOpen] = useState(false);

  const from = searchParams.get("from") ?? today;
  const to = searchParams.get("to") ?? today;

  const [draftFrom, setDraftFrom] = useState(from);
  const [draftTo, setDraftTo] = useState(to);

  const presets = useMemo<Preset[]>(() => {
    const thisMonthStart = startOfMonth(today);
    const lastMonthStart = addMonths(thisMonthStart, -1);
    const lastMonthEnd = addDays(thisMonthStart, -1);
    return [
      { key: "today", label: "Today", from: today, to: today },
      { key: "7d", label: "Last 7 days", from: addDays(today, -6), to: today },
      { key: "this_month", label: "This month", from: thisMonthStart, to: today },
      { key: "last_month", label: "Last month", from: lastMonthStart, to: lastMonthEnd },
      { key: "90d", label: "Last 90 days", from: addDays(today, -89), to: today },
      { key: "lifetime", label: "Lifetime", from: earliestDate, to: today },
    ];
  }, [today, earliestDate]);

  const activePreset = presets.find((p) => p.from === from && p.to === to);

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
    <div
      className={`flex flex-wrap items-center gap-1.5 transition-opacity ${isPending ? "opacity-60" : "opacity-100"}`}
    >
      {presets.map((p) => (
        <Button
          key={p.key}
          variant={activePreset?.key === p.key ? "secondary" : "outline"}
          size="sm"
          onClick={() => navigate(p.from, p.to)}
        >
          {p.label}
        </Button>
      ))}
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
        <PopoverTrigger render={<Button variant={!activePreset ? "secondary" : "outline"} size="sm" />}>
          <CalendarRange className="size-3.5" />
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
  );
}
