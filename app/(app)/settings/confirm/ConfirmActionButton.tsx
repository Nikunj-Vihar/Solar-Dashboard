"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { confirmAccountAction, type AccountAction } from "../actions";
import { Button } from "@/components/ui/button";

const LABEL: Record<AccountAction, string> = {
  wipe_data: "Yes, permanently delete all data",
  delete_account: "Yes, permanently delete my account",
};

const DESTINATION: Record<AccountAction, string> = {
  wipe_data: "/setup",
  delete_account: "/login",
};

export function ConfirmActionButton({ token, action }: { token: string; action: AccountAction }) {
  const [submitting, setSubmitting] = useState(false);

  async function handleConfirm() {
    setSubmitting(true);
    const result = await confirmAccountAction(token);
    if (!result.ok) {
      setSubmitting(false);
      toast.error(result.error);
      return;
    }
    // Hard navigation: this account/session state just changed underneath
    // the client router cache, same reasoning as the setup-wizard fix
    // elsewhere in this codebase -- a soft navigation risks serving a stale
    // pre-deletion RSC payload.
    window.location.href = DESTINATION[result.action];
  }

  return (
    <Button
      type="button"
      variant="destructive"
      className="w-full"
      onClick={handleConfirm}
      disabled={submitting}
    >
      {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
      {LABEL[action]}
    </Button>
  );
}
