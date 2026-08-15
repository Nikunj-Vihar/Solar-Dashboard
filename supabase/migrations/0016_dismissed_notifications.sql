-- Per-site notification dismissal state, so "Clear" in the header
-- notification bell behaves like a phone's notification shade: it hides the
-- exact items shown at the time, but a genuinely new occurrence (a fresh
-- alerts row, or the missed-days list growing by another date) gets its own
-- id and shows up again on its own -- see lib/data/notifications.ts for how
-- those ids are built and why that's the right dismiss semantics here.
create table dismissed_notifications (
  site_id uuid not null references sites(id) on delete cascade,
  notification_id text not null,
  dismissed_at timestamptz not null default now(),
  primary key (site_id, notification_id)
);

alter table dismissed_notifications enable row level security;

create policy "own dismissed notifications" on dismissed_notifications for all
  using (is_site_owner(site_id)) with check (is_site_owner(site_id));
