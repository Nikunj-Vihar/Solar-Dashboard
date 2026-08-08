"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
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
import { submitDailyLog, deleteDailyReading } from "./actions";
import { checkCumulativeAndCrossCheck, type CrossCheckResult } from "@/lib/validation/readings";
import { addDays } from "@/lib/date";
import { LogCalendar } from "./LogCalendar";
import { InfoTooltip } from "@/components/InfoTooltip";
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
  existing: {
    dailyKwh: number | null;
    cumulativeMwh: number | null;
    isReset: boolean;
    noReading: boolean;
  } | null;
  previousDailyKwh: number | null;
  previousCumulativeMwh: number | null;
};

// Runs the same pure cross-check the server uses (lib/validation/readings.ts)
// against whatever's currently typed, so a mismatched/decreased reading shows
// up as the user types instead of only after a blocked submit -- returns null
// while a field is still empty/unparseable rather than warning prematurely.
function getLiveStatus(
  inv: InverterRowData,
  dailyKwhStr: string,
  cumulativeMwhStr: string,
  isReset: boolean,
): CrossCheckResult | null {
  const dailyKwh = Number(dailyKwhStr);
  const cumulativeMwh = Number(cumulativeMwhStr);
  if (
    dailyKwhStr === "" ||
    cumulativeMwhStr === "" ||
    !Number.isFinite(dailyKwh) ||
    !Number.isFinite(cumulativeMwh)
  ) {
    return null;
  }
  return checkCumulativeAndCrossCheck({
    dailyKwh,
    cumulativeMwh,
    previousCumulativeMwh: inv.previousCumulativeMwh,
    isReset,
  });
}

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
        cumulativeMwh: inv.existing?.cumulativeMwh != null ? String(inv.existing.cumulativeMwh) : "",
        isReset: inv.existing?.isReset ?? false,
        confirmMismatch: false,
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

    if (result.needsConfirmation) {
      // The live checks below should already have surfaced (and let the user
      // confirm) anything the server would flag, so this is just a fallback
      // for the rare case they diverge -- e.g. someone else logged the
      // previous day's reading in between loading this page and submitting.
      toast.error("Double-check the flagged readings before saving");
      return;
    }

    toast.error(result.error);
  }

  // Recomputed on every render from the live form values (not just on
  // submit) so a mismatch/reset warning shows up as soon as it's true,
  // instead of only after a blocked submit round trip.
  const rowChecks = inverters.map((inv, i) => {
    const editing = editingIds.has(inv.id) || !inv.existing;
    // These two fields go through z.preprocess (see schemas.ts), which widens
    // their react-hook-form path type to `unknown` -- cast back to the string
    // the underlying <input> actually produces.
    const dailyKwhStr = String(watch(`readings.${i}.dailyKwh`) ?? "");
    const cumulativeMwhStr = String(watch(`readings.${i}.cumulativeMwh`) ?? "");
    const isResetVal = watch(`readings.${i}.isReset`) ?? false;
    const confirmMismatchVal = watch(`readings.${i}.confirmMismatch`) ?? false;
    const noReadingVal = watch(`readings.${i}.noReading`) ?? false;
    const status =
      editing && !noReadingVal ? getLiveStatus(inv, dailyKwhStr, cumulativeMwhStr, isResetVal) : null;
    return { index: i, dailyKwhStr, cumulativeMwhStr, isResetVal, confirmMismatchVal, noReadingVal, status };
  });
  // "Same MWh as yesterday" (and similar small mismatches) used to force a
  // per-inverter red error + checkbox on every single save -- now it's one
  // low-key warning above Save that clears every flagged row in one tick.
  const mismatchCandidates = rowChecks.filter((rc) => rc.status?.status === "mismatch");
  const allMismatchesConfirmed =
    mismatchCandidates.length > 0 && mismatchCandidates.every((rc) => rc.confirmMismatchVal);

  // Site-wide totals for this day, computed live from whatever's currently
  // in the form (not just saved rows) -- Total ED is the plant's combined
  // output for the day, Total ET is the plant's combined lifetime cumulative
  // (the sum of each inverter's own non-resetting counter).
  const totalEd = rowChecks.reduce((sum, rc) => {
    if (rc.noReadingVal) return sum;
    const v = Number(rc.dailyKwhStr);
    return Number.isFinite(v) ? sum + v : sum;
  }, 0);
  const totalEt = rowChecks.reduce((sum, rc) => {
    if (rc.noReadingVal) return sum;
    const v = Number(rc.cumulativeMwhStr);
    return Number.isFinite(v) ? sum + v : sum;
  }, 0);

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
      setValue(`readings.${index}.noReading`, false);
    }
    setEditingIds((prev) => new Set(prev).add(inverterId));
    toast.success("Reading deleted");
    router.refresh();
  }

  const isToday = date === today;

  return (
    <div
      className={`mx-auto max-w-3xl md:grid md:grid-cols-[280px_1fr] md:items-start md:gap-6 ${mismatchCandidates.length > 0 ? "pb-72 sm:pb-44" : "pb-48 sm:pb-24"}`}
    >
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

        <Card className="mb-3">
          <CardContent className="grid grid-cols-2 gap-3 py-4">
            <div>
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                Total ED (kWh)
                <InfoTooltip>Sum of today&apos;s kWh across all active inverters.</InfoTooltip>
              </p>
              <p className="mt-0.5 text-lg font-semibold">
                {totalEd.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </p>
            </div>
            <div>
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                Total ET (MWh)
                <InfoTooltip>
                  Sum of every active inverter&apos;s own cumulative (lifetime) meter reading.
                </InfoTooltip>
              </p>
              <p className="mt-0.5 text-lg font-semibold">
                {totalEt.toLocaleString(undefined, { maximumFractionDigits: 3 })}
              </p>
            </div>
          </CardContent>
        </Card>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          {inverters.map((inv, i) => {
            const rc = rowChecks[i];
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
                            const next = !rc.noReadingVal;
                            setValue(`readings.${i}.noReading`, next);
                            if (next) {
                              setValue(`readings.${i}.dailyKwh`, "");
                              setValue(`readings.${i}.cumulativeMwh`, "");
                            }
                          }}
                        >
                          {rc.noReadingVal ? "Enter a reading instead" : "No reading for this day"}
                        </button>
                      </div>
                      {rc.noReadingVal ? (
                        <p className="text-sm text-muted-foreground">
                          Marked as no reading for this day.
                        </p>
                      ) : (
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <Label htmlFor={`daily-${i}`} className="text-xs">
                              Daily (kWh · ED)
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
                              Cumulative (MWh · ET)
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
                          <p className="text-sm text-muted-foreground">
                            {inv.existing!.dailyKwh} kWh (ED) · cumulative{" "}
                            {inv.existing!.cumulativeMwh} MWh (ET)
                          </p>
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

                  {!rc.noReadingVal &&
                    (errors.readings?.[i]?.dailyKwh || errors.readings?.[i]?.cumulativeMwh) && (
                    <p className="text-sm text-destructive">
                      {errors.readings?.[i]?.dailyKwh?.message ??
                        errors.readings?.[i]?.cumulativeMwh?.message}
                    </p>
                  )}

                  {rc.status?.status === "cumulative_decreased" && (
                    <Alert variant="warning">
                      <AlertTriangle className="size-4" />
                      <AlertDescription>
                        {`Cumulative (${rc.cumulativeMwhStr} MWh) is lower than yesterday's (${inv.previousCumulativeMwh} MWh).`}
                        <label className="mt-2 flex items-center gap-1.5 text-sm font-medium">
                          <Checkbox
                            checked={rc.isResetVal}
                            onCheckedChange={(v) =>
                              setValue(`readings.${i}.isReset`, v === true)
                            }
                          />
                          Yes, the meter was replaced or reset
                        </label>
                      </AlertDescription>
                    </Alert>
                  )}

                  {rc.status?.status === "mismatch" && !rc.confirmMismatchVal && (
                    <p className="flex items-start gap-1.5 text-sm text-(--viz-status-warning)">
                      <AlertTriangle className="size-3.5 shrink-0 translate-y-0.5" />
                      Entered {rc.dailyKwhStr} kWh, but the cumulative counter only moved{" "}
                      {rc.status.computedDeltaKwh} kWh since yesterday.
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}

          <div className="fixed inset-x-0 bottom-24 border-t bg-background p-4 sm:bottom-0">
            <div className="mx-auto max-w-lg space-y-3">
              {mismatchCandidates.length > 0 && (
                <Alert variant="warning">
                  <AlertTriangle className="size-4" />
                  <AlertDescription>
                    {mismatchCandidates.length === 1
                      ? `${inverters[mismatchCandidates[0].index].name}'s reading doesn't quite match its cumulative counter.`
                      : `${mismatchCandidates.length} readings don't quite match their cumulative counters.`}{" "}
                    Double-check them above.
                    <label className="mt-2 flex items-center gap-1.5 text-sm font-medium">
                      <Checkbox
                        checked={allMismatchesConfirmed}
                        onCheckedChange={(v) => {
                          for (const rc of mismatchCandidates) {
                            setValue(`readings.${rc.index}.confirmMismatch`, v === true);
                          }
                        }}
                      />
                      Yes, these are correct
                    </label>
                  </AlertDescription>
                </Alert>
              )}
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
