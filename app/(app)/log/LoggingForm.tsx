"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronLeft, ChevronRight, Loader2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  dailyLogSchema,
  type DailyLogFormValues,
  type DailyLogInput,
} from "@/lib/validation/schemas";
import { submitDailyLog, deleteDailyReading } from "./actions";
import { addDays } from "@/lib/date";
import { LogCalendar } from "./LogCalendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
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
  existing: {
    dailyKwh: number | null;
    noReading: boolean;
  } | null;
  previousDailyKwh: number | null;
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
  loggedDates,
  skippedDates,
}: {
  date: string;
  today: string;
  inverters: InverterRowData[];
  loggedDates: string[];
  skippedDates: string[];
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [editingIds, setEditingIds] = useState<Set<string>>(new Set());
  const loggedDatesSet = useMemo(() => new Set(loggedDates), [loggedDates]);
  const skippedDatesSet = useMemo(() => new Set(skippedDates), [skippedDates]);
  // Same isPending-driven fade already used for the dashboard's trend-chart
  // tabs: keeps the current reading cards visible (dimmed) while the new
  // date's data streams in, instead of an abrupt jump to the route's
  // loading.tsx skeleton -- reads as "updating in place" rather than
  // "reloading the page."
  const [isPending, startTransition] = useTransition();

  const defaultValues: DailyLogFormValues = useMemo(
    () => ({
      date,
      readings: inverters.map((inv) => ({
        inverterId: inv.id,
        noReading: inv.existing?.noReading ?? false,
        dailyKwh: inv.existing?.dailyKwh != null ? String(inv.existing.dailyKwh) : "",
      })),
    }),
    [date, inverters],
  );

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<DailyLogFormValues, unknown, DailyLogInput>({
    resolver: zodResolver(dailyLogSchema),
    defaultValues,
  });

  // react-hook-form only applies `defaultValues` on first mount -- navigating
  // to a different date via the calendar/mobile date input/chevrons is a
  // client-side transition, not a remount, so without this the form would
  // keep showing whatever was typed for the previously-viewed date.
  useEffect(() => {
    reset(defaultValues);
    setEditingIds(new Set());
  }, [defaultValues, reset]);

  function goToDate(newDate: string) {
    startTransition(() => {
      router.push(`/log?date=${newDate}`);
    });
  }

  async function onSubmit(values: DailyLogInput) {
    setSubmitting(true);
    const result = await submitDailyLog(values);
    setSubmitting(false);

    if (result.ok) {
      setEditingIds(new Set());
      toast.success("Readings saved");
      router.refresh();
      return;
    }

    toast.error(result.error);
  }

  // Recomputed on every render from the live form values so the collective
  // total below updates as soon as the user types, not just after a submit.
  const rowStates = inverters.map((_, i) => {
    // dailyKwh goes through z.preprocess (see schemas.ts), which widens its
    // react-hook-form path type to `unknown` -- cast back to the string the
    // underlying <input> actually produces.
    const dailyKwhStr = String(watch(`readings.${i}.dailyKwh`) ?? "");
    const noReadingVal = watch(`readings.${i}.noReading`) ?? false;
    return { index: i, dailyKwhStr, noReadingVal };
  });
  const totalKwh = rowStates.reduce((sum, rs) => {
    if (rs.noReadingVal) return sum;
    const n = Number(rs.dailyKwhStr);
    return Number.isFinite(n) ? sum + n : sum;
  }, 0);
  const roundedTotalKwh = Math.round(totalKwh * 100) / 100;

  async function handleDelete(inverterId: string) {
    const result = await deleteDailyReading(inverterId, date);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    const index = inverters.findIndex((inv) => inv.id === inverterId);
    if (index !== -1) {
      setValue(`readings.${index}.dailyKwh`, "");
      setValue(`readings.${index}.noReading`, false);
    }
    setEditingIds((prev) => new Set(prev).add(inverterId));
    toast.success("Reading deleted");
    router.refresh();
  }

  const isToday = date === today;

  return (
    <div className="mx-auto max-w-3xl pb-48 sm:pb-24 md:grid md:grid-cols-[280px_1fr] md:items-start md:gap-6">
      <div className="hidden md:block">
        <LogCalendar
          selectedDate={date}
          today={today}
          loggedDates={loggedDatesSet}
          skippedDates={skippedDatesSet}
          onSelect={goToDate}
        />
      </div>

      <div
        className={`mx-auto w-full max-w-lg transition-opacity duration-150 md:mx-0 md:max-w-none ${isPending ? "opacity-50" : "opacity-100"}`}
      >
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

        <Input
          type="date"
          value={date}
          max={today}
          onChange={(e) => e.target.value && goToDate(e.target.value)}
          aria-label="Jump to date"
          className="mb-4 md:hidden"
        />

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          {inverters.map((inv, i) => {
            const rs = rowStates[i];
            const isEditing = editingIds.has(inv.id) || !inv.existing;

            return (
              <Card key={inv.id}>
                <CardContent className="space-y-3 pt-4">
                  {isEditing ? (
                    <>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{inv.name}</span>
                        <button
                          type="button"
                          className="shrink-0 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                          onClick={() => {
                            const next = !rs.noReadingVal;
                            setValue(`readings.${i}.noReading`, next);
                            if (next) {
                              setValue(`readings.${i}.dailyKwh`, "");
                            }
                          }}
                        >
                          {rs.noReadingVal ? "Enter a reading instead" : "No reading for this day"}
                        </button>
                      </div>
                      {rs.noReadingVal ? (
                        <p className="text-sm text-muted-foreground">
                          Marked as no reading for this day.
                        </p>
                      ) : (
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
                      )}
                    </>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-medium">{inv.name}</span>
                        {inv.existing!.noReading ? (
                          <p className="text-sm text-muted-foreground">
                            No reading logged for this day.
                          </p>
                        ) : (
                          <p className="text-sm text-muted-foreground">{inv.existing!.dailyKwh} kWh</p>
                        )}
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

                  {!rs.noReadingVal && errors.readings?.[i]?.dailyKwh && (
                    <p className="text-sm text-destructive">
                      {errors.readings?.[i]?.dailyKwh?.message}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}

          <div className="fixed inset-x-0 bottom-24 border-t bg-background p-4 sm:bottom-0">
            <div className="mx-auto max-w-lg space-y-3">
              <div className="flex items-center justify-between text-sm font-medium">
                <span className="text-muted-foreground">Total</span>
                <span>{roundedTotalKwh} kWh</span>
              </div>
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
    </div>
  );
}
