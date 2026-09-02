"use client";

import { useState } from "react";
import { FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { AvailableReportMonth } from "@/lib/data/monthlyReport";

export function DownloadReportButton({ months }: { months: AvailableReportMonth[] }) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Download monthly report"
            nativeButton
          />
        }
      >
        <FileDown className="size-4" />
      </PopoverTrigger>
      <PopoverContent className="w-56" align="end">
        <p className="mb-2 font-medium text-foreground">Monthly reports</p>
        {months.length === 0 ? (
          <p className="text-muted-foreground">No completed months yet.</p>
        ) : (
          <ul className="-mx-3 max-h-72 space-y-0.5 overflow-y-auto">
            {months.map((m) => (
              <li key={m.value}>
                <a
                  href={`/reports/${m.value}`}
                  download
                  onClick={() => setOpen(false)}
                  className="block rounded-md px-3 py-1.5 text-foreground hover:bg-accent hover:text-accent-foreground"
                >
                  {m.label}
                </a>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
