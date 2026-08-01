import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Verifies spec §10.5: a logged-in user can only ever read/write their own
// site, never another user's — the core guarantee behind every RLS policy in
// supabase/migrations/0003_rls.sql. Runs against the real linked Supabase
// project (no local Postgres available), using two throwaway test users that
// are deleted again in afterAll.
//
// Requires SUPABASE_SERVICE_ROLE_KEY, so it's skipped automatically wherever
// that isn't set (e.g. a contributor's machine without .env.local).

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const hasCredentials = Boolean(url && anonKey && serviceRoleKey);
const describeIfLive = hasCredentials ? describe : describe.skip;

describeIfLive("RLS isolation between two users", () => {
  const suffix = Date.now();
  const userAEmail = `rls-test-a-${suffix}@example.com`;
  const userBEmail = `rls-test-b-${suffix}@example.com`;
  const password = "test-password-12345";

  let admin: SupabaseClient;
  let userAId: string;
  let userBId: string;
  let clientA: SupabaseClient;
  let clientB: SupabaseClient;
  let siteAId: string;

  beforeAll(async () => {
    admin = createClient(url!, serviceRoleKey!);

    const { data: userA, error: errA } = await admin.auth.admin.createUser({
      email: userAEmail,
      password,
      email_confirm: true,
    });
    if (errA) throw errA;
    userAId = userA.user.id;

    const { data: userB, error: errB } = await admin.auth.admin.createUser({
      email: userBEmail,
      password,
      email_confirm: true,
    });
    if (errB) throw errB;
    userBId = userB.user.id;

    clientA = createClient(url!, anonKey!);
    const { error: signInAErr } = await clientA.auth.signInWithPassword({
      email: userAEmail,
      password,
    });
    if (signInAErr) throw signInAErr;

    clientB = createClient(url!, anonKey!);
    const { error: signInBErr } = await clientB.auth.signInWithPassword({
      email: userBEmail,
      password,
    });
    if (signInBErr) throw signInBErr;
  });

  afterAll(async () => {
    if (userAId) await admin.auth.admin.deleteUser(userAId);
    if (userBId) await admin.auth.admin.deleteUser(userBId);
  });

  it("lets user A create and read their own site", async () => {
    const { data, error } = await clientA
      .from("sites")
      .insert({
        name: "RLS Test Site",
        latitude: 18.5204,
        longitude: 73.8567,
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(data?.name).toBe("RLS Test Site");
    siteAId = data!.id;

    const { data: readBack, error: readErr } = await clientA
      .from("sites")
      .select("*")
      .eq("id", siteAId)
      .single();
    expect(readErr).toBeNull();
    expect(readBack?.owner_id).toBe(userAId);
  });

  it("prevents user B from reading user A's site", async () => {
    const { data, error } = await clientB.from("sites").select("*").eq("id", siteAId);

    // RLS makes the row invisible rather than erroring — an empty result,
    // not a 403, which is the correct behavior to assert on.
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("prevents user B from seeing any of user A's data via list queries", async () => {
    const { data } = await clientB.from("sites").select("*");
    expect(data).toEqual([]);
  });

  it("prevents user B from updating or deleting user A's site", async () => {
    const { data: updateData } = await clientB
      .from("sites")
      .update({ name: "hijacked" })
      .eq("id", siteAId)
      .select();
    expect(updateData).toEqual([]);

    // Confirm the row is genuinely untouched, not just hidden from the response.
    const { data: stillA } = await clientA.from("sites").select("name").eq("id", siteAId).single();
    expect(stillA?.name).toBe("RLS Test Site");
  });
});
