-- SQL Script para añadir la columna 'siigo_id' a las tablas relevantes en Supabase

-- Tabla de productos
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS siigo_id text;

-- Tabla de clientes
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS siigo_id text;

-- Tabla de cotizaciones (presupuestos)
ALTER TABLE public.cotizaciones ADD COLUMN IF NOT EXISTS siigo_id text;
