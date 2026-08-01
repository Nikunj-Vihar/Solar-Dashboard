"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { inverterSchema, type InverterInput } from "@/lib/validation/schemas";

type InverterFormValues = z.input<typeof inverterSchema>;
import { addInverter, removeInverter } from "./actions";
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

type Inverter = {
  id: string;
  name: string;
  ratedCapacityKw: number;
  dcCapacityKwp: number;
};

function AddInverterDialog({ onAdded }: { onAdded: (inv: Inverter) => void }) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<InverterFormValues, unknown, InverterInput>({
    resolver: zodResolver(inverterSchema),
    defaultValues: {
      name: "",
      manufacturer: "",
      model: "",
      ratedCapacityKw: 0,
      dcCapacityKwp: 0,
      installDate: "",
    },
  });

  async function onSubmit(values: InverterInput) {
    setSubmitting(true);
    const result = await addInverter(values);
    setSubmitting(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`${values.name} added`);
    onAdded(result.inverter);
    reset();
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button type="button" variant="outline" size="sm" nativeButton />}>
        <Plus className="size-4" />
        Add inverter
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>Add an inverter</DialogTitle>
            <DialogDescription>
              It&apos;ll show up on the daily logging screen right away.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label htmlFor="new-inv-name">Name / label</Label>
              <Input id="new-inv-name" {...register("name")} />
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="new-inv-rated">Rated capacity (kW)</Label>
                <Input id="new-inv-rated" type="number" step="0.01" {...register("ratedCapacityKw")} />
                {errors.ratedCapacityKw && (
                  <p className="text-sm text-destructive">{errors.ratedCapacityKw.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-inv-dc">DC capacity (kWp)</Label>
                <Input id="new-inv-dc" type="number" step="0.01" {...register("dcCapacityKwp")} />
                {errors.dcCapacityKwp && (
                  <p className="text-sm text-destructive">{errors.dcCapacityKwp.message}</p>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
              Add inverter
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RemoveInverterDialog({
  inverter,
  disabled,
  onRemoved,
}: {
  inverter: Inverter;
  disabled: boolean;
  onRemoved: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleRemove() {
    setSubmitting(true);
    const result = await removeInverter(inverter.id);
    setSubmitting(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`${inverter.name} removed`);
    onRemoved(inverter.id);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-destructive"
            disabled={disabled}
            aria-label={`Remove ${inverter.name}`}
            nativeButton
          />
        }
      >
        <Trash2 className="size-4" />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove {inverter.name}?</DialogTitle>
          <DialogDescription>
            It&apos;ll disappear from daily logging and the dashboard, but its history stays on
            record and can be recovered by support if needed.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="destructive" onClick={handleRemove} disabled={submitting}>
            {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
            Remove
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function InvertersCard({ initialInverters }: { initialInverters: Inverter[] }) {
  const [inverters, setInverters] = useState(initialInverters);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base">Inverters</CardTitle>
          <CardDescription>Add or remove inverters as your setup changes.</CardDescription>
        </div>
        <AddInverterDialog
          onAdded={(inv) => setInverters((prev) => [...prev, inv])}
        />
      </CardHeader>
      <CardContent className="space-y-2">
        {inverters.map((inv) => (
          <div
            key={inv.id}
            className="flex items-center justify-between rounded-md border px-3 py-2"
          >
            <div>
              <p className="text-sm font-medium">{inv.name}</p>
              <p className="text-xs text-muted-foreground">
                {inv.ratedCapacityKw} kW rated · {inv.dcCapacityKwp} kWp DC
              </p>
            </div>
            <RemoveInverterDialog
              inverter={inv}
              disabled={inverters.length <= 1}
              onRemoved={(id) => setInverters((prev) => prev.filter((i) => i.id !== id))}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
