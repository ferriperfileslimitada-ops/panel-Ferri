-- Activar extensión pgvector si no existe
CREATE EXTENSION IF NOT EXISTS vector;

-- [NEW] cotizaciones
CREATE TABLE public.cotizaciones (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  numero serial UNIQUE,
  cliente_id uuid REFERENCES public.clientes(id) NOT NULL,
  vendedor_id uuid REFERENCES auth.users(id),
  estado text DEFAULT 'borrador' CHECK (estado IN ('borrador','enviada','aprobada','rechazada','vencida')),
  origen text CHECK (origen IN ('Local','Meta Ads','Google Ads','WhatsApp','Referido','Otro')),
  subtotal numeric(12,2) DEFAULT 0,
  iva numeric(12,2) DEFAULT 0,
  total numeric(12,2) DEFAULT 0,
  notas text,
  valida_hasta date,
  siigo_invoice_id text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- [NEW] cotizacion_items
CREATE TABLE public.cotizacion_items (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  cotizacion_id uuid REFERENCES public.cotizaciones(id) ON DELETE CASCADE NOT NULL,
  producto_id uuid REFERENCES public.productos(sligo_id) NOT NULL,
  cantidad numeric(12,2) NOT NULL,
  precio_unitario numeric(12,2) NOT NULL,
  descuento_pct numeric(5,2) DEFAULT 0,
  subtotal numeric(12,2) NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- [NEW] despachos
CREATE TABLE public.despachos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  cotizacion_id uuid REFERENCES public.cotizaciones(id) NOT NULL,
  estado text DEFAULT 'pendiente' CHECK (estado IN ('pendiente','en_preparacion','despachado','entregado')),
  fecha_despacho timestamptz,
  fecha_entrega timestamptz,
  transportadora text,
  guia text,
  notas text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- [NEW] marketing_spend (para CPL/ROAS/ROI)
CREATE TABLE public.marketing_spend (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  canal text NOT NULL CHECK (canal IN ('Meta Ads','Google Ads','Local','WhatsApp','Referido','Otro')),
  periodo date NOT NULL,
  inversion numeric(12,2) DEFAULT 0,
  leads_generados integer DEFAULT 0,
  notas text,
  created_at timestamptz DEFAULT now()
);

-- [NEW] productos_embeddings (para agente IA)
CREATE TABLE public.productos_embeddings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  producto_id uuid REFERENCES public.productos(sligo_id) UNIQUE NOT NULL,
  embedding vector(768),
  contenido_texto text,
  updated_at timestamptz DEFAULT now()
);

-- Vistas SQL
CREATE OR REPLACE VIEW public.v_stock_bajo_minimo AS
SELECT sligo_id, sku, nombre, stock, precio
FROM public.productos
WHERE stock <= 10 AND stock > 0
ORDER BY stock ASC;

CREATE OR REPLACE VIEW public.v_ventas_por_producto AS
SELECT 
  p.nombre,
  p.sku,
  date_trunc('month', c.created_at) AS mes,
  SUM(ci.cantidad) AS unidades,
  SUM(ci.subtotal) AS total_vendido
FROM public.cotizacion_items ci
JOIN public.cotizaciones c ON c.id = ci.cotizacion_id
JOIN public.productos p ON p.sligo_id = ci.producto_id
WHERE c.estado = 'aprobada'
GROUP BY p.nombre, p.sku, mes;

CREATE OR REPLACE VIEW public.v_ventas_por_origen AS
SELECT 
  c.origen,
  date_trunc('month', c.created_at) AS mes,
  COUNT(*) AS total_cotizaciones,
  COUNT(*) FILTER (WHERE c.estado = 'aprobada') AS aprobadas,
  SUM(c.total) FILTER (WHERE c.estado = 'aprobada') AS revenue
FROM public.cotizaciones c
GROUP BY c.origen, mes;

-- Políticas RLS
ALTER TABLE public.cotizaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cotizacion_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.despachos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_spend ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.productos_embeddings ENABLE ROW LEVEL SECURITY;

-- Política base: usuarios autenticados pueden leer todo
CREATE POLICY "Users can read all" ON public.cotizaciones FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can read all" ON public.cotizacion_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can read all" ON public.despachos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can read all" ON public.marketing_spend FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can read all" ON public.productos_embeddings FOR SELECT TO authenticated USING (true);

-- Cotizaciones
CREATE POLICY "Users can insert cotizaciones" ON public.cotizaciones FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users can update cotizaciones" ON public.cotizaciones FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Users can insert items" ON public.cotizacion_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users can update items" ON public.cotizacion_items FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Users can delete items" ON public.cotizacion_items FOR DELETE TO authenticated USING (true);

-- Despachos
CREATE POLICY "Users can insert despachos" ON public.despachos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users can update despachos" ON public.despachos FOR UPDATE TO authenticated USING (true);

-- Marketing spend (solo admins en fase 2 — por ahora todos los autenticados)
CREATE POLICY "Users can manage marketing" ON public.marketing_spend FOR ALL TO authenticated USING (true) WITH CHECK (true);
