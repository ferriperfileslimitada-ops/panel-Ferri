-- Normalize historical product identities.
--
-- Legacy rows reused the Siigo UUID as productos.supa_id. This migration assigns
-- new internal UUIDs, moves dependent product references with ON UPDATE CASCADE,
-- and keeps the external Siigo UUID only in siigo_entity_map.siigo_id.
--
-- Run once, during a short maintenance window, after taking a fresh backup.

BEGIN;

-- Prevent concurrent product writes while primary keys and their references move.
LOCK TABLE
  public.productos,
  public.cotizacion_items,
  public.productos_embeddings,
  public.siigo_entity_map
IN ACCESS EXCLUSIVE MODE;

-- Future identity corrections remain safe if a local product UUID ever changes.
ALTER TABLE public.cotizacion_items
  DROP CONSTRAINT IF EXISTS cotizacion_items_producto_id_fkey;

ALTER TABLE public.cotizacion_items
  ADD CONSTRAINT cotizacion_items_producto_id_fkey
  FOREIGN KEY (producto_id)
  REFERENCES public.productos(supa_id)
  ON UPDATE CASCADE;

ALTER TABLE public.productos_embeddings
  DROP CONSTRAINT IF EXISTS productos_embeddings_producto_id_fkey;

ALTER TABLE public.productos_embeddings
  ADD CONSTRAINT productos_embeddings_producto_id_fkey
  FOREIGN KEY (producto_id)
  REFERENCES public.productos(supa_id)
  ON UPDATE CASCADE;

-- Keep old/new IDs in one transaction so the entity map and product references
-- are always changed together.
CREATE TEMP TABLE _siigo_product_id_remap (
  old_supa_id uuid PRIMARY KEY,
  new_supa_id uuid NOT NULL UNIQUE
) ON COMMIT DROP;

INSERT INTO _siigo_product_id_remap (old_supa_id, new_supa_id)
SELECT
  p.supa_id,
  gen_random_uuid()
FROM public.productos AS p
JOIN public.siigo_entity_map AS m
  ON m.entity_type = 'product'
 AND m.local_record_id = p.supa_id::text
WHERE p.supa_id::text = m.siigo_id;

-- siigo_entity_map has text IDs, so update it explicitly. Child foreign keys
-- are updated automatically by the cascading constraints below.
UPDATE public.siigo_entity_map AS m
SET
  local_record_id = r.new_supa_id::text,
  updated_at = now()
FROM _siigo_product_id_remap AS r
WHERE m.entity_type = 'product'
  AND m.local_record_id = r.old_supa_id::text;

UPDATE public.productos AS p
SET supa_id = r.new_supa_id
FROM _siigo_product_id_remap AS r
WHERE p.supa_id = r.old_supa_id;

-- Fail closed: never commit if an external Siigo UUID is still used as a local ID.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.productos AS p
    JOIN public.siigo_entity_map AS m
      ON m.entity_type = 'product'
     AND m.local_record_id = p.supa_id::text
    WHERE p.supa_id::text = m.siigo_id
  ) THEN
    RAISE EXCEPTION 'Legacy Siigo UUIDs remain in productos.supa_id';
  END IF;
END;
$$;

COMMIT;

-- Post-run verification:
-- SELECT count(*) FILTER (WHERE local_record_id = siigo_id) AS ids_iguales
-- FROM public.siigo_entity_map WHERE entity_type = 'product';
