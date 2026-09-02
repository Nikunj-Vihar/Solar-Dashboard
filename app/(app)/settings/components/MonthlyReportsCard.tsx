"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** value: YYYY-MM, label: "August 2026" */
export type AvailableReportMonth = { value: string; label: string };

export function MonthlyReportsCard({ months }: { months: AvailableReportMonth[] }) {
  const [selected, setSelected] = useState(months[0]?.value ?? "");
  const labelByValue = Object.fromEntries(months.map((m) => [m.value, m.label]));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Monthly reports</CardTitle>
        <CardDescription>
          Download a polished PDF generation report for any completed month.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {months.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No completed months yet — check back after your first full month of logging.
          </p>
        ) : (
          <div className="flex items-center gap-2">
            <Select value={selected} onValueChange={(v) => v && setSelected(v)}>
              <SelectTrigger className="w-40">
                <SelectValue>{(value: string | null) => (value ? labelByValue[value] : "")}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {months.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<a href={`/reports/${selected}`} download />}
            >
              <Download className="size-4" />
              Download PDF
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
