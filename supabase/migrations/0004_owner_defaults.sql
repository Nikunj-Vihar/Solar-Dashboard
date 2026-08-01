-- Defense in depth: owner_id / entered_by should never depend on app code
-- remembering to set them. auth.uid() resolves from the request's JWT via
-- PostgREST, so these defaults are correct for any client-side insert made
-- through Supabase (anon+session key) — service-role/Edge Function writes
-- still set them explicitly since there's no user JWT in that context.

alter table sites alter column owner_id set default auth.uid();
alter table daily_readings alter column entered_by set default auth.uid();
