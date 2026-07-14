-- Quote approval gate for Siigo delivery.
-- A quotation must be explicitly approved before a worker can submit it to Siigo.

ALTER TABLE public.cotizaciones
  ADD COLUMN IF NOT EXISTS siigo_quotation_id text,
  ADD COLUMN IF NOT EXISTS siigo_quotation_number text,
  ADD COLUMN IF NOT EXISTS siigo_sync_status text NOT NULL DEFAULT 'not_requested'
    CHECK (siigo_sync_status IN ('not_requested', 'pending_approval', 'queued', 'processing', 'synced', 'failed')),
  ADD COLUMN IF NOT EXISTS siigo_last_error text,
  ADD COLUMN IF NOT EXISTS siigo_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS siigo_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS siigo_approved_by uuid REFERENCES auth.users(id);

ALTER TABLE public.cotizaciones
  DROP CONSTRAINT IF EXISTS cotizaciones_estado_check;

ALTER TABLE public.cotizaciones
  ADD CONSTRAINT cotizaciones_estado_check
  CHECK (estado IN ('borrador', 'pendiente_aprobacion', 'enviada', 'aprobada', 'rechazada', 'vencida'));

ALTER TABLE public.integration_outbox
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS correlation_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS integration_outbox_quotation_create_active_idx
  ON public.integration_outbox (local_record_id, command_type)
  WHERE resource_type = 'quotation'
    AND command_type = 'create'
    AND status IN ('pending', 'processing', 'completed');

CREATE OR REPLACE FUNCTION public.queue_approved_quotation_for_siigo(p_quotation_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_outbox_id uuid;
  v_payload jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required to approve a quotation.';
  END IF;

  SELECT jsonb_build_object(
    'quotation_id', c.id,
    'date', current_date,
    'valid_until', c.valida_hasta,
    'customer_id', c.cliente_id,
    'customer_identification', cl.identification,
    'notes', c.notas,
    'items', COALESCE(jsonb_agg(
      jsonb_build_object(
        'local_product_id', ci.producto_id,
        'code', p.sku,
        'quantity', ci.cantidad,
        'price', ci.precio_unitario,
        'discount_pct', ci.descuento_pct
      ) ORDER BY ci.created_at
    ) FILTER (WHERE ci.id IS NOT NULL), '[]'::jsonb)
  )
  INTO v_payload
  FROM public.cotizaciones c
  JOIN public.clientes cl ON cl.id = c.cliente_id
  LEFT JOIN public.cotizacion_items ci ON ci.cotizacion_id = c.id
  LEFT JOIN public.productos p ON p.sligo_id = ci.producto_id
  WHERE c.id = p_quotation_id
  GROUP BY c.id, c.valida_hasta, c.cliente_id, c.notas, cl.identification;

  IF v_payload IS NULL OR jsonb_array_length(v_payload->'items') = 0 THEN
    RAISE EXCEPTION 'Quotation % must exist and include at least one item.', p_quotation_id;
  END IF;

  INSERT INTO public.integration_outbox (
    command_type, resource_type, local_record_id, payload, idempotency_key,
    status, approved_at, approved_by, correlation_id, created_by
  ) VALUES (
    'create', 'quotation', p_quotation_id::text, v_payload,
    'quotation:create:' || p_quotation_id::text,
    'pending', now(), v_user_id, gen_random_uuid(), v_user_id
  )
  ON CONFLICT (idempotency_key) DO UPDATE
  SET approved_at = EXCLUDED.approved_at,
      approved_by = EXCLUDED.approved_by,
      status = CASE
        WHEN public.integration_outbox.status IN ('failed', 'dead_letter') THEN 'pending'
        ELSE public.integration_outbox.status
      END,
      next_attempt_at = CASE
        WHEN public.integration_outbox.status IN ('failed', 'dead_letter') THEN now()
        ELSE public.integration_outbox.next_attempt_at
      END,
      last_error = CASE
        WHEN public.integration_outbox.status IN ('failed', 'dead_letter') THEN NULL
        ELSE public.integration_outbox.last_error
      END
  RETURNING id INTO v_outbox_id;

  UPDATE public.cotizaciones
  SET estado = 'aprobada',
      siigo_sync_status = 'queued',
      siigo_last_error = NULL,
      siigo_approved_at = now(),
      siigo_approved_by = v_user_id,
      updated_at = now()
  WHERE id = p_quotation_id;

  RETURN v_outbox_id;
END;
$$;

REVOKE ALL ON FUNCTION public.queue_approved_quotation_for_siigo(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.queue_approved_quotation_for_siigo(uuid) TO authenticated;

COMMENT ON FUNCTION public.queue_approved_quotation_for_siigo(uuid)
  IS 'Creates or retries the unique approved Siigo quotation command for a local quotation.';
