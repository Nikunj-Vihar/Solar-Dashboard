import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client -- bypasses RLS entirely. Only for operations that
 * genuinely require it (currently: `auth.admin.deleteUser`, which the anon
 * key can never do). Never import this from a Client Component; `server-only`
 * makes that a build-time error, not just a convention.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
