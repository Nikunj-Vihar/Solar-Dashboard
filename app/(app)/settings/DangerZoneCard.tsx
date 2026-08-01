"use client";

import { useState } from "react";
import { Loader2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { requestAccountAction, type AccountAction } from "./actions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const COPY: Record<
  AccountAction,
  { trigger: string; title: string; description: string; confirmLabel: string }
> = {
  wipe_data: {
    trigger: "Delete all data",
    title: "Delete all data?",
    description:
      "Every inverter, every logged reading, and every alert will be permanently removed. Your login stays intact — you'll land back on setup, like a brand-new account. We'll email you a confirmation link first; nothing is deleted until you click through it.",
    confirmLabel: "Send confirmation email",
  },
  delete_account: {
    trigger: "Delete account",
    title: "Delete your account?",
    description:
      "Your data and your login will both be permanently removed, and you'll be signed out. This can't be undone. We'll email you a confirmation link first; nothing is deleted until you click through it.",
    confirmLabel: "Send confirmation email",
  },
};

function AccountActionDialog({ action, siteName }: { action: AccountAction; siteName: string }) {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const copy = COPY[action];
  const canConfirm = confirmText.trim() === siteName;

  async function handleRequest() {
    setSubmitting(true);
    const result = await requestAccountAction(action);
    setSubmitting(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Check your email to confirm — the link expires in 30 minutes.");
    setConfirmText("");
    setOpen(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setConfirmText("");
      }}
    >
      <DialogTrigger render={<Button type="button" variant="destructive" size="sm" nativeButton />}>
        {copy.trigger}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Label htmlFor={`confirm-${action}`}>
            Type <span className="font-mono font-medium">{siteName}</span> to confirm
          </Label>
          <Input
            id={`confirm-${action}`}
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            autoComplete="off"
          />
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="destructive"
            onClick={handleRequest}
            disabled={!canConfirm || submitting}
          >
            {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
            {copy.confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function DangerZoneCard({ siteName }: { siteName: string }) {
  return (
    <Card className="border-destructive/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5 text-base text-destructive">
          <ShieldAlert className="size-4" />
          Danger zone
        </CardTitle>
        <CardDescription>
          Both actions below require confirming a link we email you before anything is deleted.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <AccountActionDialog action="wipe_data" siteName={siteName} />
        <AccountActionDialog action="delete_account" siteName={siteName} />
      </CardContent>
    </Card>
  );
}
