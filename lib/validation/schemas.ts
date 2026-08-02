import { z } from "zod";

export const signInSchema = z.object({
  email: z.email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});
export type SignInInput = z.infer<typeof signInSchema>;

export const signUpSchema = z
  .object({
    fullName: z.string().min(1, "Name is required"),
    email: z.email("Enter a valid email address"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });
export type SignUpInput = z.infer<typeof signUpSchema>;

export const siteSchema = z.object({
  name: z.string().min(1, "Site name is required").max(200),
  address: z.string().max(500).optional().or(z.literal("")),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  commissioningDate: z.string().optional().or(z.literal("")),
  tariffRateInrPerKwh: z.coerce.number().min(0).max(100).optional(),
  isPublic: z.boolean().default(false),
});
export type SiteInput = z.infer<typeof siteSchema>;

export const inverterSchema = z.object({
  name: z.string().min(1, "Inverter name is required").max(100),
  manufacturer: z.string().max(100).optional().or(z.literal("")),
  model: z.string().max(100).optional().or(z.literal("")),
  dcCapacityKwp: z.coerce.number().positive("Must be greater than 0").max(1000),
  installDate: z.string().optional().or(z.literal("")),
});
export type InverterInput = z.infer<typeof inverterSchema>;

// Default starting point in the setup wizard -- users can add or remove
// inverters from there (and later from Settings), so this isn't a limit.
export const DEFAULT_NUM_INVERTERS = 4;

export const setupSchema = z.object({
  site: siteSchema,
  inverters: z.array(inverterSchema).min(1, "Add at least one inverter"),
});
// `latitude`/`ratedCapacityKw`/etc use z.coerce.number(), so the raw form
// values (strings, as HTML inputs produce) differ from the parsed/validated
// output (numbers) — react-hook-form needs both shapes.
export type SetupFormValues = z.input<typeof setupSchema>;
export type SetupInput = z.output<typeof setupSchema>;

export const readingEntrySchema = z
  .object({
    inverterId: z.uuid(),
    // True when the user explicitly marks a day as having no reading to log
    // (inverter was off, nobody visited site, etc.) instead of leaving the
    // fields blank forever or typing a fabricated 0 -- kept distinct so
    // totals/trends can tell "no data" apart from "measured zero".
    noReading: z.boolean().default(false),
    // Blank fields coerce to undefined rather than throwing, so we can
    // surface a friendly "required" message instead of a raw zod coercion
    // error -- and so they're valid to omit entirely when noReading is set.
    dailyKwh: z.preprocess(
      (v) => (v === "" ? undefined : v),
      z.coerce.number().min(0, "Can't be negative").max(1_000_000).optional(),
    ),
    cumulativeMwh: z.preprocess(
      (v) => (v === "" ? undefined : v),
      z.coerce.number().min(0, "Can't be negative").optional(),
    ),
    isReset: z.boolean().default(false),
    confirmMismatch: z.boolean().default(false),
  })
  .refine((data) => data.noReading || data.dailyKwh !== undefined, {
    message: "Required",
    path: ["dailyKwh"],
  })
  .refine((data) => data.noReading || data.cumulativeMwh !== undefined, {
    message: "Required",
    path: ["cumulativeMwh"],
  });
export type ReadingEntryInput = z.output<typeof readingEntrySchema>;

export const dailyLogSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
  readings: z.array(readingEntrySchema).min(1),
});
export type DailyLogFormValues = z.input<typeof dailyLogSchema>;
export type DailyLogInput = z.output<typeof dailyLogSchema>;

export const reportFrequencySchema = z.enum(["daily", "weekly", "monthly", "off"]);
export type ReportFrequency = z.infer<typeof reportFrequencySchema>;
