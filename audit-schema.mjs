import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    'Missing VITE_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY. Run with: node --env-file=.env audit-schema.mjs',
  );
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function auditColumns() {
  const tables = [
    'inventario', 'cotizaciones', 'cotizacion_items', 'despachos',
    'ventas', 'facturas', 'bodegas', 'proveedores', 'categorias',
    'categories', 'leads', 'contacts', 'conversations', 'messages',
    'orders', 'profiles',
  ];

  for (const table of tables) {
    console.log(`\n=== ${table.toUpperCase()} ===`);
    const { error } = await supabase.from(table).select('*').limit(0);

    if (error) {
      console.log(`  Error: ${error.message}`);
      continue;
    }

    const { count } = await supabase.from(table).select('*', { count: 'exact', head: true });
    console.log(`  OK · ${count ?? 0} rows`);
  }
}

auditColumns().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
