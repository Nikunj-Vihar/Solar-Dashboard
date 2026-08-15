"use client";

import { Bell, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

function formatShort(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function NotificationBell({ missedDates }: { missedDates: string[] }) {
  const count = missedDates.length;

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            className="relative"
            aria-label={count > 0 ? `${count} missed day${count === 1 ? "" : "s"} this month` : "Notifications"}
            nativeButton
          />
        }
      >
        <Bell className="size-4" />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-(--viz-status-warning) px-1 text-[10px] font-semibold text-white">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-72" align="end">
        {count === 0 ? (
          <p className="text-muted-foreground">You&apos;re all caught up for this month.</p>
        ) : (
          <div className="space-y-2">
            <p className="flex items-center gap-1.5 font-medium text-foreground">
              <AlertTriangle className="size-4 shrink-0 text-(--viz-status-warning)" />
              {count === 1 ? "You missed a day this month" : `You missed ${count} days this month`}
            </p>
            <p className="text-muted-foreground">{missedDates.map(formatShort).join(", ")}</p>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
