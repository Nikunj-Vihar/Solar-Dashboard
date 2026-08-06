"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { changePasswordSchema, type ChangePasswordInput } from "@/lib/validation/schemas";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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

export function ChangePasswordCard({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<ChangePasswordInput>({ resolver: zodResolver(changePasswordSchema) });

  async function onSubmit(values: ChangePasswordInput) {
    setSubmitting(true);
    const supabase = createClient();

    // Re-verify the current password before changing anything -- an active
    // session alone (e.g. an unlocked, unattended laptop) shouldn't be
    // enough to silently take over the account's credentials.
    const { error: verifyErr } = await supabase.auth.signInWithPassword({
      email,
      password: values.currentPassword,
    });
    if (verifyErr) {
      setSubmitting(false);
      setError("currentPassword", { message: "Current password is incorrect" });
      return;
    }

    const { error: updateErr } = await supabase.auth.updateUser({
      password: values.newPassword,
    });
    setSubmitting(false);
    if (updateErr) {
      toast.error(updateErr.message);
      return;
    }

    toast.success("Password updated");
    reset();
    setOpen(false);
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base">Password</CardTitle>
          <CardDescription>Change the password you sign in with.</CardDescription>
        </div>
        <Dialog
          open={open}
          onOpenChange={(v) => {
            setOpen(v);
            if (v) reset();
          }}
        >
          <DialogTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-foreground"
                aria-label="Change password"
                nativeButton
              />
            }
          >
            <KeyRound className="size-4" />
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleSubmit(onSubmit)}>
              <DialogHeader>
                <DialogTitle>Change password</DialogTitle>
                <DialogDescription>
                  You&apos;ll need your current password to set a new one.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label htmlFor="current-password-input">Current password</Label>
                  <Input
                    id="current-password-input"
                    type="password"
                    autoComplete="current-password"
                    {...register("currentPassword")}
                  />
                  {errors.currentPassword && (
                    <p className="text-sm text-destructive">{errors.currentPassword.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-password-input">New password</Label>
                  <Input
                    id="new-password-input"
                    type="password"
                    autoComplete="new-password"
                    {...register("newPassword")}
                  />
                  {errors.newPassword && (
                    <p className="text-sm text-destructive">{errors.newPassword.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-new-password-input">Confirm new password</Label>
                  <Input
                    id="confirm-new-password-input"
                    type="password"
                    autoComplete="new-password"
                    {...register("confirmNewPassword")}
                  />
                  {errors.confirmNewPassword && (
                    <p className="text-sm text-destructive">
                      {errors.confirmNewPassword.message}
                    </p>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={submitting}>
                  {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
                  Update password
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
    </Card>
  );
}
