-- Phone numbers are identifiers, not quantities: preserve leading zeros,
-- extensions and the string representation supplied by Siigo.
ALTER TABLE public.clientes
  ALTER COLUMN "Telefono" TYPE text
  USING "Telefono"::text;
