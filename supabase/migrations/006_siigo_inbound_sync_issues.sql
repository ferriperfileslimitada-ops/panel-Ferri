-- Persistent audit trail for inbound Siigo products that cannot be synchronized.
-- One open issue is kept per product and reason; repeated nightly runs increment
-- occurrences instead of creating duplicate alerts.

CREATE TABLE IF NOT EXISTS public.siigo_sync_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (entity_type IN ('product', 'customer')),
  siigo_id text NOT NULL,
  siigo_code text,
  issue_type text NOT NULL CHECK (issue_type IN (
    'missing_price',
    'negative_stock',
    'siigo_api_error',
    'supabase_error'
  )),
  message text NOT NULL,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  occurrences integer NOT NULL DEFAULT 1 CHECK (occurrences > 0),
  resolved_at timestamptz,
  resolution_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT siigo_sync_issues_open_unique
    UNIQUE (entity_type, siigo_id, issue_type)
);

CREATE INDEX IF NOT EXISTS siigo_sync_issues_open_idx
  ON public.siigo_sync_issues (entity_type, last_seen_at DESC)
  WHERE resolved_at IS NULL;

ALTER TABLE public.siigo_sync_issues ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.record_siigo_sync_issue(
  p_entity_type text,
  p_siigo_id text,
  p_siigo_code text,
  p_issue_type text,
  p_message text
)
RETURNS public.siigo_sync_issues
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_issue public.siigo_sync_issues;
BEGIN
  IF p_siigo_id IS NULL OR btrim(p_siigo_id) = '' THEN
    RAISE EXCEPTION 'siigo_id es obligatorio';
  END IF;

  INSERT INTO public.siigo_sync_issues (
    entity_type,
    siigo_id,
    siigo_code,
    issue_type,
    message
  )
  VALUES (
    p_entity_type,
    p_siigo_id,
    NULLIF(btrim(p_siigo_code), ''),
    p_issue_type,
    p_message
  )
  ON CONFLICT (entity_type, siigo_id, issue_type)
  DO UPDATE SET
    siigo_code = EXCLUDED.siigo_code,
    message = EXCLUDED.message,
    last_seen_at = now(),
    occurrences = public.siigo_sync_issues.occurrences + 1,
    resolved_at = NULL,
    resolution_note = NULL,
    updated_at = now()
  RETURNING * INTO v_issue;

  RETURN v_issue;
END;
$$;

REVOKE ALL ON FUNCTION public.record_siigo_sync_issue(text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_siigo_sync_issue(text, text, text, text, text) TO service_role;

COMMENT ON TABLE public.siigo_sync_issues
  IS 'Incidencias de sincronización entrante desde Siigo que requieren revisión.';
