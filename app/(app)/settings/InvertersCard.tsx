"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Plus, Trash2, Pencil, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { inverterSchema, type InverterInput } from "@/lib/validation/schemas";

type InverterFormValues = z.input<typeof inverterSchema>;
import { addInverter, updateInverter, removeInverter } from "./actions";
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
  manufacturer: string | null;
  model: string | null;
  dcCapacityKwp: number;
  installDate: string | null;
};

function blankValues(): InverterFormValues {
  return { name: "", manufacturer: "", model: "", dcCapacityKwp: 0, installDate: "" };
}

function inverterToFormValues(inverter: Inverter): InverterFormValues {
  return {
    name: inverter.name,
    manufacturer: inverter.manufacturer ?? "",
    model: inverter.model ?? "",
    dcCapacityKwp: inverter.dcCapacityKwp,
    installDate: inverter.installDate ?? "",
  };
}

function InverterFields({
  idPrefix,
  register,
  errors,
}: {
  idPrefix: string;
  register: ReturnType<typeof useForm<InverterFormValues, unknown, InverterInput>>["register"];
  errors: ReturnType<typeof useForm<InverterFormValues, unknown, InverterInput>>["formState"]["errors"];
}) {
  return (
    <div className="space-y-3 py-2">
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-name`}>Name / label</Label>
        <Input id={`${idPrefix}-name`} {...register("name")} />
        {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-manufacturer`}>Manufacturer</Label>
          <Input id={`${idPrefix}-manufacturer`} {...register("manufacturer")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-model`}>Model</Label>
          <Input id={`${idPrefix}-model`} {...register("model")} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-dc`}>DC capacity (kWp)</Label>
        <Input id={`${idPrefix}-dc`} type="number" step="0.01" {...register("dcCapacityKwp")} />
        {errors.dcCapacityKwp && (
          <p className="text-sm text-destructive">{errors.dcCapacityKwp.message}</p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-install`}>Install date (optional)</Label>
        <Input id={`${idPrefix}-install`} type="date" {...register("installDate")} />
      </div>
    </div>
  );
}

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
    defaultValues: blankValues(),
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
    onAdded({
      id: result.inverter.id,
      name: values.name,
      manufacturer: values.manufacturer || null,
      model: values.model || null,
      dcCapacityKwp: values.dcCapacityKwp,
      installDate: values.installDate || null,
    });
    reset(blankValues());
    setOpen(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset(blankValues());
      }}
    >
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
          <InverterFields idPrefix="new-inv" register={register} errors={errors} />
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

function EditInverterDialog({
  inverter,
  onUpdated,
}: {
  inverter: Inverter;
  onUpdated: (inv: Inverter) => void;
}) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<InverterFormValues, unknown, InverterInput>({
    resolver: zodResolver(inverterSchema),
    defaultValues: inverterToFormValues(inverter),
  });

  async function onSubmit(values: InverterInput) {
    setSubmitting(true);
    const result = await updateInverter(inverter.id, values);
    setSubmitting(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`${values.name} updated`);
    onUpdated({
      id: inverter.id,
      name: values.name,
      manufacturer: values.manufacturer || null,
      model: values.model || null,
      dcCapacityKwp: values.dcCapacityKwp,
      installDate: values.installDate || null,
    });
    setOpen(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) reset(inverterToFormValues(inverter));
      }}
    >
      <DialogTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-foreground"
            aria-label={`Edit ${inverter.name}`}
            nativeButton
          />
        }
      >
        <Pencil className="size-4" />
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>Edit {inverter.name}</DialogTitle>
            <DialogDescription>
              Changes apply right away to the logging screen and dashboard.
            </DialogDescription>
          </DialogHeader>
          <InverterFields idPrefix={`edit-inv-${inverter.id}`} register={register} errors={errors} />
          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
              Save changes
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
          <CardDescription>Add, edit, or remove inverters as your setup changes.</CardDescription>
        </div>
        <AddInverterDialog onAdded={(inv) => setInverters((prev) => [...prev, inv])} />
      </CardHeader>
      <CardContent className="space-y-2">
        {inverters.map((inv) => (
          <div
            key={inv.id}
            className="flex items-center justify-between rounded-md border px-3 py-2"
          >
            <div>
              <p className="text-sm font-medium">{inv.name}</p>
              <p className="text-xs text-muted-foreground">{inv.dcCapacityKwp} kWp DC</p>
            </div>
            <div className="flex items-center gap-0.5">
              <EditInverterDialog
                inverter={inv}
                onUpdated={(updated) =>
                  setInverters((prev) => prev.map((i) => (i.id === updated.id ? updated : i)))
                }
              />
              <RemoveInverterDialog
                inverter={inv}
                disabled={inverters.length <= 1}
                onRemoved={(id) => setInverters((prev) => prev.filter((i) => i.id !== id))}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
