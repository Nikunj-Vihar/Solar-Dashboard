"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { updateSiteNameSchema, type UpdateSiteNameInput } from "@/lib/validation/schemas";
import { updateSiteName } from "./actions";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
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

export function SiteNameCard({ initialName }: { initialName: string }) {
  const [name, setName] = useState(initialName);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<UpdateSiteNameInput>({
    resolver: zodResolver(updateSiteNameSchema),
    defaultValues: { name },
  });

  async function onSubmit(values: UpdateSiteNameInput) {
    setSubmitting(true);
    const result = await updateSiteName(values.name);
    setSubmitting(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setName(values.name);
    toast.success("Site name updated");
    setOpen(false);
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base">Site name</CardTitle>
          <p className="mt-1 text-sm">{name}</p>
        </div>
        <Dialog
          open={open}
          onOpenChange={(v) => {
            setOpen(v);
            if (v) reset({ name });
          }}
        >
          <DialogTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-foreground"
                aria-label="Edit site name"
                nativeButton
              />
            }
          >
            <Pencil className="size-4" />
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleSubmit(onSubmit)}>
              <DialogHeader>
                <DialogTitle>Edit site name</DialogTitle>
                <DialogDescription>
                  Shown across the dashboard, the header, and any report emails.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2 py-2">
                <Label htmlFor="site-name-input">Name</Label>
                <Input id="site-name-input" {...register("name")} />
                {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
              </div>
              <DialogFooter>
                <Button type="submit" disabled={submitting}>
                  {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
                  Save changes
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
    </Card>
  );
}
