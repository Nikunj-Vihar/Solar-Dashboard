import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/**
 * Data Access Layer entry point: every authenticated read/write should route
 * through here (or call this first) rather than trusting Proxy's optimistic
 * redirect alone — Proxy's matcher can silently stop covering a route after a
 * refactor, so real enforcement lives at the data layer (backed by RLS).
 */
export const getAuthedUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

export type SiteWithInverters = {
  id: string;
  owner_id: string;
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  timezone: string;
  commissioning_date: string | null;
  tariff_rate_inr_per_kwh: number | null;
  grid_emission_factor_kg_per_kwh: number;
  is_public: boolean;
  public_share_slug: string | null;
  inverters: {
    id: string;
    name: string;
    manufacturer: string | null;
    model: string | null;
    rated_capacity_kw: number;
    dc_capacity_kwp: number;
    install_date: string | null;
    is_active: boolean;
  }[];
};

export const getCurrentSite = cache(async (): Promise<SiteWithInverters | null> => {
  const user = await getAuthedUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("sites")
    .select("*, inverters(*)")
    .eq("owner_id", user.id)
    .maybeSingle();

  return data as SiteWithInverters | null;
});
