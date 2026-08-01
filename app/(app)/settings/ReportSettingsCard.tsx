"use client";

import { useState } from "react";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { updateReportFrequency, sendStatusEmailNow } from "./actions";
import type { ReportFrequency } from "@/lib/validation/schemas";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const FREQUENCY_LABEL: Record<ReportFrequency, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  off: "Off",
};

export function ReportSettingsCard({
  initialFrequency,
}: {
  initialFrequency: ReportFrequency;
}) {
  const [frequency, setFrequency] = useState<ReportFrequency>(initialFrequency);
  const [savingFrequency, setSavingFrequency] = useState(false);
  const [sendingStatus, setSendingStatus] = useState(false);

  async function handleFrequencyChange(next: ReportFrequency) {
    const previous = frequency;
    setFrequency(next);
    setSavingFrequency(true);
    const result = await updateReportFrequency(next);
    setSavingFrequency(false);
    if (!result.ok) {
      setFrequency(previous);
      toast.error(result.error);
      return;
    }
    toast.success(
      next === "off" ? "Report emails turned off" : `You'll get a ${FREQUENCY_LABEL[next].toLowerCase()} report email`,
    );
  }

  async function handleSendStatus() {
    setSendingStatus(true);
    const result = await sendStatusEmailNow();
    setSendingStatus(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Status email sent");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Email reports</CardTitle>
        <CardDescription>
          Choose how often we email you a generation report, or send yourself a snapshot right
          now.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <Label htmlFor="report-frequency">Report frequency</Label>
          <Select
            value={frequency}
            onValueChange={(v) => handleFrequencyChange(v as ReportFrequency)}
            disabled={savingFrequency}
          >
            <SelectTrigger id="report-frequency" className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(FREQUENCY_LABEL) as ReportFrequency[]).map((value) => (
                <SelectItem key={value} value={value}>
                  {FREQUENCY_LABEL[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleSendStatus}
          disabled={sendingStatus}
        >
          {sendingStatus ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          Email current status now
        </Button>
      </CardContent>
    </Card>
  );
}
