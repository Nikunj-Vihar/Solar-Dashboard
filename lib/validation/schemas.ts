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
  ratedCapacityKw: z.coerce.number().positive("Must be greater than 0").max(1000),
  dcCapacityKwp: z.coerce.number().positive("Must be greater than 0").max(1000),
  installDate: z.string().optional().or(z.literal("")),
});
export type InverterInput = z.infer<typeof inverterSchema>;

export const NUM_INVERTERS = 4;

export const setupSchema = z.object({
  site: siteSchema,
  inverters: z.array(inverterSchema).length(NUM_INVERTERS),
});
// `latitude`/`ratedCapacityKw`/etc use z.coerce.number(), so the raw form
// values (strings, as HTML inputs produce) differ from the parsed/validated
// output (numbers) — react-hook-form needs both shapes.
export type SetupFormValues = z.input<typeof setupSchema>;
export type SetupInput = z.output<typeof setupSchema>;

export const readingEntrySchema = z.object({
  inverterId: z.uuid(),
  // Blank fields coerce to NaN rather than throwing, so we can surface a
  // friendly "required" message instead of a raw zod coercion error.
  dailyKwh: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.coerce.number({ error: "Required" }).min(0, "Can't be negative").max(1_000_000),
  ),
  cumulativeMwh: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.coerce.number({ error: "Required" }).min(0, "Can't be negative"),
  ),
  isReset: z.boolean().default(false),
  confirmMismatch: z.boolean().default(false),
});
export type ReadingEntryInput = z.output<typeof readingEntrySchema>;

export const dailyLogSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
  readings: z.array(readingEntrySchema).length(NUM_INVERTERS),
});
export type DailyLogFormValues = z.input<typeof dailyLogSchema>;
export type DailyLogInput = z.output<typeof dailyLogSchema>;
