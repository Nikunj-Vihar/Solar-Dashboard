"use client";

import { Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// Tap/click-triggered (not hover-only) so it works the same on a phone as on
// desktop -- most of this dashboard's real usage is on mobile.
export function InfoTooltip({ children }: { children: React.ReactNode }) {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <button
            type="button"
            className="text-muted-foreground/60 hover:text-muted-foreground"
            aria-label="More info"
          />
        }
      >
        <Info className="size-3.5" />
      </PopoverTrigger>
      <PopoverContent className="text-muted-foreground">{children}</PopoverContent>
    </Popover>
  );
}
