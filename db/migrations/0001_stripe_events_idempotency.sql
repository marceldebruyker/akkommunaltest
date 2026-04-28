-- Stripe webhook idempotency.
-- Stripe retries deliveries on any non-2xx response (including transient
-- network errors). Without idempotency, retries create duplicate purchase
-- rows. We record every processed event_id; the unique constraint makes
-- the second insert fail and the webhook handler short-circuits.

create table if not exists public.stripe_events (
  event_id     text primary key,
  type         text not null,
  processed_at timestamptz not null default now()
);

-- The webhook handler uses the service role; no end-user RLS needed,
-- but we enable RLS with no policies so anon/authenticated cannot read it.
alter table public.stripe_events enable row level security;

-- Optional janitor: keep ~30 days of history (uncomment if pg_cron available).
-- select cron.schedule('purge_old_stripe_events', '0 3 * * *', $$
--   delete from public.stripe_events where processed_at < now() - interval '30 days';
-- $$);
