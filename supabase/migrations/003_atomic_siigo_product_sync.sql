-- Atomic product sync entry point for n8n.
-- Creates a product when its SKU is new, or updates its mutable commercial
-- fields when the SKU already exists. The local primary key is never changed
-- during an update.

CREATE OR REPLACE FUNCTION public.sync_siigo_producto(
  p_siigo_id uuid,
  p_sku text,
  p_nombre text,
  p_precio numeric,
  p_stock numeric,
  p_iva smallint DEFAULT 19
)
RETURNS public.productos
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_producto public.productos;
BEGIN
  IF p_siigo_id IS NULL THEN
    RAISE EXCEPTION 'siigo_id es obligatorio';
  END IF;

  IF p_sku IS NULL OR btrim(p_sku) = '' THEN
    RAISE EXCEPTION 'sku es obligatorio';
  END IF;

  IF p_nombre IS NULL OR btrim(p_nombre) = '' THEN
    RAISE EXCEPTION 'nombre es obligatorio';
  END IF;

  IF p_precio IS NULL OR p_stock IS NULL THEN
    RAISE EXCEPTION 'precio y stock son obligatorios';
  END IF;

  UPDATE public.productos
  SET
    nombre = p_nombre,
    precio = p_precio,
    stock = p_stock,
    iva = COALESCE(p_iva, 19),
    updated_at = now()
  WHERE sku = p_sku
  RETURNING * INTO v_producto;

  IF NOT FOUND THEN
    INSERT INTO public.productos (sligo_id, sku, nombre, precio, stock, iva)
    VALUES (p_siigo_id, p_sku, p_nombre, p_precio, p_stock, COALESCE(p_iva, 19))
    RETURNING * INTO v_producto;
  END IF;

  INSERT INTO public.siigo_entity_map (
    entity_type,
    local_record_id,
    siigo_id,
    siigo_code,
    siigo_last_updated_at,
    sync_status,
    source_of_truth
  )
  VALUES (
    'product',
    v_producto.sligo_id::text,
    p_siigo_id::text,
    p_sku,
    now(),
    'synced',
    'siigo'
  )
  ON CONFLICT (entity_type, siigo_id)
  DO UPDATE SET
    local_record_id = EXCLUDED.local_record_id,
    siigo_code = EXCLUDED.siigo_code,
    siigo_last_updated_at = EXCLUDED.siigo_last_updated_at,
    last_synced_at = now(),
    sync_status = 'synced',
    source_of_truth = 'siigo',
    updated_at = now();

  RETURN v_producto;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_siigo_producto(uuid, text, text, numeric, numeric, smallint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_siigo_producto(uuid, text, text, numeric, numeric, smallint) TO service_role;

COMMENT ON FUNCTION public.sync_siigo_producto(uuid, text, text, numeric, numeric, smallint)
  IS 'Sincroniza productos desde Siigo de forma atómica por SKU y conserva el identificador local existente.';
