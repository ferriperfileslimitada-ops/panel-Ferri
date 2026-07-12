-- Siigo integration foundation
-- This migration is intentionally independent from existing business tables.
-- It can be applied safely before customers/products synchronization begins.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.siigo_sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_type text NOT NULL CHECK (sync_type IN ('products', 'customers', 'sales', 'full_reconciliation')),
  trigger_source text NOT NULL CHECK (trigger_source IN ('manual', 'schedule', 'webhook', 'recovery')),
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'success', 'partial', 'failed')),
  cursor_started_at timestamptz,
  cursor_finished_at timestamptz,
  records_read integer NOT NULL DEFAULT 0,
  records_created integer NOT NULL DEFAULT 0,
  records_updated integer NOT NULL DEFAULT 0,
  records_skipped integer NOT NULL DEFAULT 0,
  records_failed integer NOT NULL DEFAULT 0,
  error_summary text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.siigo_entity_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (entity_type IN ('product', 'customer', 'quotation', 'invoice', 'purchase')),
  local_record_id text NOT NULL,
  siigo_id text NOT NULL,
  siigo_code text,
  siigo_last_updated_at timestamptz,
  last_synced_at timestamptz NOT NULL DEFAULT now(),
  sync_status text NOT NULL DEFAULT 'synced' CHECK (sync_status IN ('synced', 'pending', 'conflict', 'error')),
  source_of_truth text NOT NULL DEFAULT 'siigo' CHECK (source_of_truth IN ('siigo', 'panel')),
  sync_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT siigo_entity_map_siigo_unique UNIQUE (entity_type, siigo_id),
  CONSTRAINT siigo_entity_map_local_unique UNIQUE (entity_type, local_record_id)
);

CREATE TABLE IF NOT EXISTS public.siigo_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key text NOT NULL UNIQUE,
  topic text NOT NULL,
  siigo_entity_id text,
  payload jsonb NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  status text NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'processing', 'processed', 'failed')),
  attempts integer NOT NULL DEFAULT 0,
  error_summary text
);

CREATE TABLE IF NOT EXISTS public.integration_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  command_type text NOT NULL,
  resource_type text NOT NULL CHECK (resource_type IN ('product', 'customer', 'quotation', 'invoice', 'purchase')),
  local_record_id text NOT NULL,
  payload jsonb NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'dead_letter')),
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  siigo_response jsonb,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.integration_dead_letters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  outbox_id uuid NOT NULL REFERENCES public.integration_outbox(id) ON DELETE CASCADE,
  failure_reason text NOT NULL,
  failed_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id),
  resolution_note text
);

CREATE INDEX IF NOT EXISTS siigo_sync_runs_status_started_at_idx
  ON public.siigo_sync_runs (status, started_at DESC);
CREATE INDEX IF NOT EXISTS siigo_entity_map_siigo_code_idx
  ON public.siigo_entity_map (entity_type, siigo_code);
CREATE INDEX IF NOT EXISTS siigo_webhook_events_status_received_at_idx
  ON public.siigo_webhook_events (status, received_at);
CREATE INDEX IF NOT EXISTS integration_outbox_pending_idx
  ON public.integration_outbox (status, next_attempt_at)
  WHERE status IN ('pending', 'failed');
CREATE INDEX IF NOT EXISTS integration_dead_letters_open_idx
  ON public.integration_dead_letters (failed_at DESC)
  WHERE resolved_at IS NULL;

ALTER TABLE public.siigo_sync_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.siigo_entity_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.siigo_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_dead_letters ENABLE ROW LEVEL SECURITY;

-- No browser policies are created deliberately. Until the operational screens
-- exist, only server-side services using a service-role key may access these
-- tables. Add narrowly-scoped RLS policies with the corresponding UI work.

COMMENT ON TABLE public.siigo_sync_runs IS 'One record per Siigo synchronization execution.';
COMMENT ON TABLE public.siigo_entity_map IS 'Stable mapping between local records and Siigo IDs.';
COMMENT ON TABLE public.siigo_webhook_events IS 'Deduplicated inbound webhook events from Siigo.';
COMMENT ON TABLE public.integration_outbox IS 'Commands awaiting safe delivery from the panel to Siigo.';
COMMENT ON TABLE public.integration_dead_letters IS 'Commands that exhausted retries and require human review.';
