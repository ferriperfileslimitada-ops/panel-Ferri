-- Safe inbound customer synchronization from Siigo.
-- The local UUID remains owned by Supabase; identification is the business key.

ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS siigo_id text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS "Telefono" text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- The RPC serializes its own writers, and this index also prevents an accidental
-- duplicate from any future write path. Existing duplicate identities must be
-- reconciled before applying this migration rather than silently picking one.
CREATE UNIQUE INDEX IF NOT EXISTS clientes_identification_unique_idx
  ON public.clientes (identification)
  WHERE identification IS NOT NULL AND btrim(identification) <> '';

ALTER TABLE public.siigo_sync_issues
  DROP CONSTRAINT IF EXISTS siigo_sync_issues_issue_type_check;

ALTER TABLE public.siigo_sync_issues
  ADD CONSTRAINT siigo_sync_issues_issue_type_check CHECK (issue_type IN (
    'missing_price', 'negative_stock', 'missing_identification', 'missing_name',
    'siigo_api_error', 'supabase_error'
  ));

CREATE OR REPLACE FUNCTION public.sync_siigo_cliente(
  p_siigo_id text,
  p_identification text,
  p_name text,
  p_email text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_address text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cliente public.clientes;
  v_action text;
  v_mapped_local_id text;
  v_mapped_siigo_id text;
BEGIN
  IF p_siigo_id IS NULL OR btrim(p_siigo_id) = '' THEN
    RAISE EXCEPTION 'siigo_id es obligatorio';
  END IF;
  IF p_identification IS NULL OR btrim(p_identification) = '' THEN
    RAISE EXCEPTION 'identification es obligatoria';
  END IF;
  IF p_name IS NULL OR btrim(p_name) = '' THEN
    RAISE EXCEPTION 'name es obligatorio';
  END IF;

  -- Serialize concurrent imports of the same business identity.
  PERFORM pg_advisory_xact_lock(hashtext(btrim(p_identification)));

  SELECT local_record_id INTO v_mapped_local_id
  FROM public.siigo_entity_map
  WHERE entity_type = 'customer' AND siigo_id = btrim(p_siigo_id);

  SELECT * INTO v_cliente
  FROM public.clientes
  WHERE identification = btrim(p_identification)
  FOR UPDATE;

  IF FOUND THEN
    IF v_mapped_local_id IS NOT NULL AND v_mapped_local_id <> v_cliente.id::text THEN
      RAISE EXCEPTION 'El siigo_id % ya está asociado a otro cliente local', p_siigo_id;
    END IF;

    SELECT siigo_id INTO v_mapped_siigo_id
    FROM public.siigo_entity_map
    WHERE entity_type = 'customer' AND local_record_id = v_cliente.id::text;
    IF v_mapped_siigo_id IS NOT NULL AND v_mapped_siigo_id <> btrim(p_siigo_id) THEN
      RAISE EXCEPTION 'El cliente local % ya está asociado a otro siigo_id', v_cliente.id;
    END IF;

    UPDATE public.clientes
    SET name = btrim(p_name), email = NULLIF(btrim(p_email), ''),
        "Telefono" = NULLIF(btrim(p_phone), ''), city = NULLIF(btrim(p_city), ''),
        address = NULLIF(btrim(p_address), ''), siigo_id = btrim(p_siigo_id), updated_at = now()
    WHERE id = v_cliente.id
    RETURNING * INTO v_cliente;
    v_action := 'updated';
  ELSE
    IF v_mapped_local_id IS NOT NULL THEN
      RAISE EXCEPTION 'El siigo_id % ya está asociado a otro cliente local', p_siigo_id;
    END IF;

    INSERT INTO public.clientes (name, identification, email, "Telefono", city, address, siigo_id)
    VALUES (btrim(p_name), btrim(p_identification), NULLIF(btrim(p_email), ''),
            NULLIF(btrim(p_phone), ''), NULLIF(btrim(p_city), ''),
            NULLIF(btrim(p_address), ''), btrim(p_siigo_id))
    RETURNING * INTO v_cliente;
    v_action := 'created';
  END IF;

  INSERT INTO public.siigo_entity_map (
    entity_type, local_record_id, siigo_id, siigo_code,
    siigo_last_updated_at, sync_status, source_of_truth
  ) VALUES (
    'customer', v_cliente.id::text, btrim(p_siigo_id), btrim(p_identification),
    now(), 'synced', 'siigo'
  ) ON CONFLICT (entity_type, siigo_id) DO UPDATE SET
    local_record_id = EXCLUDED.local_record_id, siigo_code = EXCLUDED.siigo_code,
    siigo_last_updated_at = EXCLUDED.siigo_last_updated_at, last_synced_at = now(),
    sync_status = 'synced', source_of_truth = 'siigo', updated_at = now();

  RETURN jsonb_build_object('id', v_cliente.id, 'sync_action', v_action);
END;
$$;

REVOKE ALL ON FUNCTION public.sync_siigo_cliente(text, text, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_siigo_cliente(text, text, text, text, text, text, text) TO service_role;

COMMENT ON FUNCTION public.sync_siigo_cliente(text, text, text, text, text, text, text)
  IS 'Sincroniza clientes por identificación, preserva el UUID local y evita reasignar mapas Siigo.';
