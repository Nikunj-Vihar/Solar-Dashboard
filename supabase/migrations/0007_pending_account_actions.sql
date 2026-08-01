-- Email-verified account deletion (spec: "delete all data" / "delete account",
-- both require confirming via a link sent to the account's email before
-- anything actually happens). A pending action is a short-lived, single-use
-- token row; the confirm page (app code) requires an explicit click even
-- after the link is opened, so an email client's link-preview prefetch can't
-- trigger a real deletion on its own.

create table pending_account_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  action text not null check (action in ('wipe_data', 'delete_account')),
  -- Plain random token, not a hash -- same threat model/pattern as
  -- sites.public_share_slug already in this codebase (a capability token
  -- delivered over a channel the user controls), which is an acceptable
  -- tradeoff for this app's scale rather than adding a hashing scheme.
  token text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  -- One pending action per user at a time; requesting a new one (or a new
  -- kind of action) replaces whatever link was emailed before.
  unique (user_id)
);
create index idx_pending_account_actions_token on pending_account_actions(token);

alter table pending_account_actions enable row level security;

create policy "own pending actions" on pending_account_actions for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
