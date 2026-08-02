"use client";

import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { MapPin, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  setupSchema,
  type SetupFormValues,
  type SetupInput,
  DEFAULT_NUM_INVERTERS,
} from "@/lib/validation/schemas";
import { completeSetup } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const STEPS = ["Site", "Inverters", "Review"] as const;

const defaultValues: SetupFormValues = {
  site: {
    name: "",
    address: "",
    latitude: 0,
    longitude: 0,
    commissioningDate: "",
    tariffRateInrPerKwh: undefined,
    isPublic: false,
  },
  inverters: Array.from({ length: DEFAULT_NUM_INVERTERS }, (_, i) => ({
    name: `Inverter ${i + 1}`,
    manufacturer: "",
    model: "",
    dcCapacityKwp: 0,
    installDate: "",
  })),
};

function blankInverter(n: number) {
  return {
    name: `Inverter ${n}`,
    manufacturer: "",
    model: "",
    dcCapacityKwp: 0,
    installDate: "",
  };
}

export function SetupWizard() {
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [locating, setLocating] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    trigger,
    setValue,
    watch,
    formState: { errors },
  } = useForm<SetupFormValues, unknown, SetupInput>({
    resolver: zodResolver(setupSchema),
    defaultValues,
  });

  const { fields: inverterFields, append, remove } = useFieldArray({
    control,
    name: "inverters",
  });

  const isPublic = watch("site.isPublic");

  async function goNext() {
    const fields =
      step === 0
        ? ["site.name", "site.latitude", "site.longitude"]
        : inverterFields
            .map((_, i) => [`inverters.${i}.name`, `inverters.${i}.dcCapacityKwp`])
            .flat();

    const valid = await trigger(fields as never);
    if (valid) setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      toast.error("Your browser doesn't support location access.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setValue("site.latitude", Number(pos.coords.latitude.toFixed(6)));
        setValue("site.longitude", Number(pos.coords.longitude.toFixed(6)));
        setLocating(false);
        toast.success("Location filled in");
      },
      () => {
        setLocating(false);
        toast.error("Couldn't get your location — enter coordinates manually.");
      },
    );
  }

  async function onSubmit(values: SetupInput) {
    setSubmitting(true);
    const result = await completeSetup(values);
    setSubmitting(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Site set up successfully");
    // Hard navigation, not router.replace(): this is a one-time, low-frequency
    // transition, and a full page load sidesteps the client router cache
    // potentially serving a pre-setup "no site yet" RSC payload for /dashboard
    // and bouncing the user straight back to /setup.
    window.location.href = "/dashboard";
  }

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-6 flex items-center justify-center gap-2">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <div
              className={`flex size-7 items-center justify-center rounded-full text-xs font-medium ${
                i <= step
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {i + 1}
            </div>
            <span className="text-sm text-muted-foreground">{label}</span>
            {i < STEPS.length - 1 && <span className="mx-1 text-muted-foreground">—</span>}
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        {step === 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Site details</CardTitle>
              <CardDescription>
                Used to calculate an expected-generation baseline for your plant.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="site-name">Site name</Label>
                <Input id="site-name" {...register("site.name")} />
                {errors.site?.name && (
                  <p className="text-sm text-destructive">{errors.site.name.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="site-address">Address (optional)</Label>
                <Input id="site-address" {...register("site.address")} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="site-lat">Latitude</Label>
                  <Input
                    id="site-lat"
                    type="number"
                    step="any"
                    {...register("site.latitude")}
                  />
                  {errors.site?.latitude && (
                    <p className="text-sm text-destructive">
                      {errors.site.latitude.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="site-lng">Longitude</Label>
                  <Input
                    id="site-lng"
                    type="number"
                    step="any"
                    {...register("site.longitude")}
                  />
                  {errors.site?.longitude && (
                    <p className="text-sm text-destructive">
                      {errors.site.longitude.message}
                    </p>
                  )}
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={useMyLocation}
                disabled={locating}
              >
                {locating ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <MapPin className="size-4" />
                )}
                Use my current location
              </Button>

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="site-commission">Commissioning date (optional)</Label>
                <Input id="site-commission" type="date" {...register("site.commissioningDate")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="site-tariff">Grid tariff rate — ₹/kWh (optional)</Label>
                <Input
                  id="site-tariff"
                  type="number"
                  step="0.01"
                  {...register("site.tariffRateInrPerKwh")}
                />
                <p className="text-xs text-muted-foreground">
                  Lets us show an estimated ₹ saved figure on your dashboard.
                </p>
              </div>
              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <Label htmlFor="site-public">Public read-only link</Label>
                  <p className="text-xs text-muted-foreground">
                    Share a view-only dashboard link with family or investors.
                  </p>
                </div>
                <Switch
                  id="site-public"
                  checked={isPublic}
                  onCheckedChange={(v) => setValue("site.isPublic", v)}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {step === 1 && (
          <div className="space-y-4">
            {inverterFields.map((field, i) => (
              <Card key={field.id}>
                <CardHeader className="flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-base">Inverter {i + 1}</CardTitle>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => remove(i)}
                    disabled={inverterFields.length <= 1}
                    aria-label="Remove inverter"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor={`inv-${i}-name`}>Name / label</Label>
                    <Input id={`inv-${i}-name`} {...register(`inverters.${i}.name`)} />
                    {errors.inverters?.[i]?.name && (
                      <p className="text-sm text-destructive">
                        {errors.inverters[i]?.name?.message}
                      </p>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor={`inv-${i}-manufacturer`}>Manufacturer</Label>
                      <Input
                        id={`inv-${i}-manufacturer`}
                        {...register(`inverters.${i}.manufacturer`)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`inv-${i}-model`}>Model</Label>
                      <Input id={`inv-${i}-model`} {...register(`inverters.${i}.model`)} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`inv-${i}-dc`}>DC capacity (kWp)</Label>
                    <Input
                      id={`inv-${i}-dc`}
                      type="number"
                      step="0.01"
                      {...register(`inverters.${i}.dcCapacityKwp`)}
                    />
                    {errors.inverters?.[i]?.dcCapacityKwp && (
                      <p className="text-sm text-destructive">
                        {errors.inverters[i]?.dcCapacityKwp?.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`inv-${i}-install`}>Install date (optional)</Label>
                    <Input
                      id={`inv-${i}-install`}
                      type="date"
                      {...register(`inverters.${i}.installDate`)}
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => append(blankInverter(inverterFields.length + 1))}
            >
              <Plus className="size-4" />
              Add inverter
            </Button>
          </div>
        )}

        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle>Review</CardTitle>
              <CardDescription>
                We&apos;ll fetch a solar-irradiance baseline for your coordinates and set
                everything up.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>
                <span className="text-muted-foreground">Site:</span>{" "}
                {watch("site.name")} ({String(watch("site.latitude"))},{" "}
                {String(watch("site.longitude"))})
              </p>
              <p className="text-muted-foreground">
                {inverterFields.length} inverter{inverterFields.length === 1 ? "" : "s"} —{" "}
                {watch("inverters")
                  .map((inv) => inv.name)
                  .join(", ")}
              </p>
            </CardContent>
          </Card>
        )}

        <div className="mt-6 flex justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={() => setStep((s) => Math.max(s - 1, 0))}
            disabled={step === 0 || submitting}
          >
            Back
          </Button>
          {step < STEPS.length - 1 ? (
            <Button key="next" type="button" onClick={goNext}>
              Next
            </Button>
          ) : (
            <Button key="submit" type="submit" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Setting up...
                </>
              ) : (
                "Finish setup"
              )}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
