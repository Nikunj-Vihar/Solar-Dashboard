"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bell, AlertTriangle, AlertOctagon, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { clearNotifications } from "../actions";
import type { NotificationItem } from "@/lib/data/notifications";

const SEVERITY_CONFIG = {
  needs_attention: { icon: AlertOctagon, className: "text-(--viz-status-critical)" },
  watch: { icon: AlertTriangle, className: "text-(--viz-status-warning)" },
} as const;

export function NotificationBell({ notifications }: { notifications: NotificationItem[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [clearing, startClearing] = useTransition();
  const count = notifications.length;
  const badgeColor = notifications.some((n) => n.severity === "needs_attention")
    ? "bg-(--viz-status-critical)"
    : "bg-(--viz-status-warning)";

  function handleClearAll() {
    const ids = notifications.map((n) => n.id);
    startClearing(async () => {
      const result = await clearNotifications(ids);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            className="relative"
            aria-label={count > 0 ? `${count} notification${count === 1 ? "" : "s"}` : "Notifications"}
            nativeButton
          />
        }
      >
        <Bell className="size-4" />
        {count > 0 && (
          <span
            className={`absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold text-white ${badgeColor}`}
          >
            {count > 9 ? "9+" : count}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="mb-2 flex items-center justify-between">
          <p className="font-medium text-foreground">Notifications</p>
          {count > 0 && (
            <button
              type="button"
              onClick={handleClearAll}
              disabled={clearing}
              className="flex items-center gap-1 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline disabled:opacity-50"
            >
              {clearing && <Loader2 className="size-3 animate-spin" />}
              Clear all
            </button>
          )}
        </div>
        {count === 0 ? (
          <p className="text-muted-foreground">You&apos;re all caught up.</p>
        ) : (
          <ul className="max-h-80 space-y-3 overflow-y-auto">
            {notifications.map((n) => {
              const { icon: Icon, className } = SEVERITY_CONFIG[n.severity];
              return (
                <li key={n.id} className="flex gap-2">
                  <Icon className={`size-4 shrink-0 translate-y-0.5 ${className}`} />
                  <div>
                    <p className="text-foreground">{n.message}</p>
                    {n.detail && <p className="mt-0.5 text-muted-foreground">{n.detail}</p>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
