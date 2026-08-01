"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAuthedUser } from "@/lib/data/site";

export type TogglePublicShareResult =
  | { ok: true; isPublic: boolean; slug: string | null }
  | { ok: false; error: string };

export async function togglePublicShare(enable: boolean): Promise<TogglePublicShareResult> {
  const user = await getAuthedUser();
  if (!user) {
    return { ok: false, error: "You must be signed in." };
  }

  const supabase = await createClient();
  const { data: site, error: siteErr } = await supabase
    .from("sites")
    .select("id, public_share_slug")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (siteErr || !site) {
    return { ok: false, error: "Site not found." };
  }

  // Generate a slug the first time sharing is enabled; keep it stable across
  // later toggles so a previously-shared link doesn't silently break.
  const slug = site.public_share_slug ?? randomUUID();

  const { error: updateErr } = await supabase
    .from("sites")
    .update({ is_public: enable, public_share_slug: slug })
    .eq("id", site.id);

  if (updateErr) {
    return { ok: false, error: updateErr.message };
  }

  revalidatePath("/settings");
  return { ok: true, isPublic: enable, slug };
}
