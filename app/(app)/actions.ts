"use server";

import { createClient } from "@/lib/supabase/server";
import { getAuthedUser, getCurrentSite } from "@/lib/data/site";

export type ClearNotificationsResult = { ok: true } | { ok: false; error: string };

export async function clearNotifications(ids: string[]): Promise<ClearNotificationsResult> {
  const user = await getAuthedUser();
  if (!user) {
    return { ok: false, error: "You must be signed in." };
  }
  if (ids.length === 0) {
    return { ok: true };
  }

  const site = await getCurrentSite();
  if (!site) {
    return { ok: false, error: "No site found." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("dismissed_notifications")
    .upsert(
      ids.map((id) => ({ site_id: site.id, notification_id: id })),
      { onConflict: "site_id,notification_id" },
    );
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
