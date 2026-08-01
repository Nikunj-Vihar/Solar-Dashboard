"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronLeft, ChevronRight, Loader2, AlertTriangle, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  dailyLogSchema,
  type DailyLogFormValues,
  type DailyLogInput,
} from "@/lib/validation/schemas";
import { submitDailyLog, deleteDailyReading, type ConfirmationIssue } from "./actions";
import { addDays } from "@/lib/date";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type InverterRowData = {
  id: string;
  name: string;
  ratedCapacityKw: number;
  existing: { dailyKwh: number; cumulativeMwh: number; isReset: boolean } | null;
  previousDailyKwh: number | null;
  previousCumulativeMwh: number | null;
};

function DeleteReadingDialog({
  inverterName,
  onConfirm,
}: {
  inverterName: string;
  onConfirm: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground hover:text-destructive"
            aria-label={`Delete ${inverterName}'s reading`}
            nativeButton
          />
        }
      >
        <Trash2 className="size-4" />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete this reading?</DialogTitle>
          <DialogDescription>
            {inverterName}&apos;s entry for this day will be removed so you can log it fresh.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="destructive"
            onClick={() => {
              onConfirm();
              setOpen(false);
            }}
          >
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function LoggingForm({
  date,
  today,
  inverters,
}: {
  date: string;
  today: string;
  inverters: InverterRowData[];
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [issuesByInverter, setIssuesByInverter] = useState<Record<string, ConfirmationIssue>>({});
  const [editingIds, setEditingIds] = useState<Set<string>>(new Set());

  const defaultValues: DailyLogFormValues = {
    date,
    readings: inverters.map((inv) => ({
      inverterId: inv.id,
      dailyKwh: inv.existing ? String(inv.existing.dailyKwh) : "",
      cumulativeMwh: inv.existing ? String(inv.existing.cumulativeMwh) : "",
      isReset: inv.existing?.isReset ?? false,
      confirmMismatch: false,
    })),
  };

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<DailyLogFormValues, unknown, DailyLogInput>({
    resolver: zodResolver(dailyLogSchema),
    defaultValues,
  });

  function goToDate(newDate: string) {
    router.push(`/log?date=${newDate}`);
  }

  async function onSubmit(values: DailyLogInput) {
    setSubmitting(true);
    const result = await submitDailyLog(values);
    setSubmitting(false);

    if (result.ok) {
      setIssuesByInverter({});
      setEditingIds(new Set());
      toast.success("Readings saved");
      router.refresh();
      return;
    }

    if (result.needsConfirmation) {
      const byInverter: Record<string, ConfirmationIssue> = {};
      for (const issue of result.needsConfirmation) {
        byInverter[issue.inverterId] = issue;
      }
      setIssuesByInverter(byInverter);
      toast.error("Double-check the flagged readings before saving");
      return;
    }

    toast.error(result.error);
  }

  async function handleDelete(inverterId: string) {
    const result = await deleteDailyReading(inverterId, date);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    const index = inverters.findIndex((inv) => inv.id === inverterId);
    if (index !== -1) {
      setValue(`readings.${index}.dailyKwh`, "");
      setValue(`readings.${index}.cumulativeMwh`, "");
    }
    setEditingIds((prev) => new Set(prev).add(inverterId));
    toast.success("Reading deleted");
    router.refresh();
  }

  const isToday = date === today;

  return (
    <div className="mx-auto max-w-lg pb-24">
      <div className="mb-4 flex items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => goToDate(addDays(date, -1))}
          aria-label="Previous day"
        >
          <ChevronLeft className="size-4" />
        </Button>
        <div className="text-center">
          <p className="text-sm font-medium">
            {new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
              weekday: "short",
              month: "short",
              day: "numeric",
            })}
          </p>
          {isToday && <p className="text-xs text-muted-foreground">Today</p>}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => goToDate(addDays(date, 1))}
          disabled={isToday}
          aria-label="Next day"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        {inverters.map((inv, i) => {
          const issue = issuesByInverter[inv.id];
          const isEditing = editingIds.has(inv.id) || !inv.existing;

          return (
            <Card key={inv.id}>
              <CardContent className="space-y-3 pt-4">
                {isEditing ? (
                  <>
                    <span className="font-medium">{inv.name}</span>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor={`daily-${i}`} className="text-xs">
                          Daily (kWh)
                        </Label>
                        <Input
                          id={`daily-${i}`}
                          inputMode="decimal"
                          autoComplete="off"
                          placeholder={
                            inv.previousDailyKwh !== null
                              ? `Yesterday: ${inv.previousDailyKwh}`
                              : "0"
                          }
                          {...register(`readings.${i}.dailyKwh`)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={`cumulative-${i}`} className="text-xs">
                          Cumulative (MWh)
                        </Label>
                        <Input
                          id={`cumulative-${i}`}
                          inputMode="decimal"
                          autoComplete="off"
                          placeholder={
                            inv.previousCumulativeMwh !== null
                              ? `Yesterday: ${inv.previousCumulativeMwh}`
                              : "0"
                          }
                          {...register(`readings.${i}.cumulativeMwh`)}
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium">{inv.name}</span>
                      <p className="text-sm text-muted-foreground">
                        {inv.existing!.dailyKwh} kWh · cumulative {inv.existing!.cumulativeMwh} MWh
                      </p>
                    </div>
                    <div className="flex items-center gap-0.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="text-muted-foreground hover:text-foreground"
                        aria-label={`Edit ${inv.name}'s reading`}
                        onClick={() => setEditingIds((prev) => new Set(prev).add(inv.id))}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <DeleteReadingDialog
                        inverterName={inv.name}
                        onConfirm={() => handleDelete(inv.id)}
                      />
                    </div>
                  </div>
                )}

                {(errors.readings?.[i]?.dailyKwh || errors.readings?.[i]?.cumulativeMwh) && (
                  <p className="text-sm text-destructive">
                    {errors.readings?.[i]?.dailyKwh?.message ??
                      errors.readings?.[i]?.cumulativeMwh?.message}
                  </p>
                )}

                {issue && (
                  <Alert variant="destructive">
                    <AlertTriangle className="size-4" />
                    <AlertDescription>
                      {issue.message}
                      {issue.issue === "mismatch" && (
                        <label className="mt-2 flex items-center gap-1.5 text-sm font-medium">
                          <Checkbox
                            checked={watch(`readings.${i}.confirmMismatch`) ?? false}
                            onCheckedChange={(v) =>
                              setValue(`readings.${i}.confirmMismatch`, v === true)
                            }
                          />
                          Yes, this is correct
                        </label>
                      )}
                      {issue.issue === "cumulative_decreased" && (
                        <label className="mt-2 flex items-center gap-1.5 text-sm font-medium">
                          <Checkbox
                            checked={watch(`readings.${i}.isReset`) ?? false}
                            onCheckedChange={(v) => setValue(`readings.${i}.isReset`, v === true)}
                          />
                          Yes, the meter was replaced or reset
                        </label>
                      )}
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          );
        })}

        <div className="fixed inset-x-0 bottom-0 border-t bg-background p-4">
          <div className="mx-auto max-w-lg">
            <Button type="submit" className="w-full" size="lg" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Saving...
                </>
              ) : (
                "Save readings"
              )}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
