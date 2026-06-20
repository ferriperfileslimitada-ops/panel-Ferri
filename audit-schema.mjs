import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://supabase.ferriperfiles.com',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3NjMwODk3MTcsImV4cCI6MTg5MzQ1NjAwMCwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlzcyI6InN1cGFiYXNlIn0.NHDBLZCr12t_QN2ySG2zicMBFXRkh0f46ENKlenChCo'
);

async function auditColumns() {
  const tables = [
    'inventario', 'cotizaciones', 'cotizacion_items', 'despachos',
    'ventas', 'facturas', 'bodegas', 'proveedores', 'categorias',
    'categories', 'leads', 'contacts', 'conversations', 'messages',
    'orders', 'profiles'
  ];
  
  for (const table of tables) {
    console.log(`\n=== ${table.toUpperCase()} ===`);
    // Try select * with limit 1 to get columns from the response metadata
    const { data, error } = await supabase.from(table).select('*').limit(0);
    
    if (error) {
      console.log(`  Error: ${error.message}`);
      // Try a different approach - insert an empty object to see what columns are required
      const { error: insertErr } = await supabase.from(table).insert({}).select();
      if (insertErr) {
        console.log(`  Insert test: ${insertErr.message.substring(0, 200)}`);
      }
    } else {
      console.log(`  OK (empty result, table accessible)`);
      // Try getting a row count
      const { count } = await supabase.from(table).select('*', { count: 'exact', head: true });
      console.log(`  Row count: ${count}`);
    }
  }

  // Also get total productos and clientes counts
  console.log('\n=== COUNTS ===');
  const { count: prodCount } = await supabase.from('productos').select('*', { count: 'exact', head: true });
  console.log(`  productos: ${prodCount} rows`);
  const { count: cliCount } = await supabase.from('clientes').select('*', { count: 'exact', head: true });
  console.log(`  clientes: ${cliCount} rows`);

  // Check if we can get column info through the error messages on non-existent columns
  console.log('\n=== COLUMN DISCOVERY FOR EMPTY TABLES ===');
  for (const table of ['inventario', 'cotizaciones', 'cotizacion_items', 'despachos', 'ventas', 'facturas', 'bodegas', 'proveedores', 'categorias', 'leads']) {
    const { data, error } = await supabase.from(table).select('*').limit(1);
    if (!error && data && data.length > 0) {
      console.log(`\n${table}: ${Object.keys(data[0]).join(', ')}`);
      console.log(`  Sample: ${JSON.stringify(data[0]).substring(0, 500)}`);
    } else if (!error && data && data.length === 0) {
      console.log(`\n${table}: (empty - no rows to inspect columns)`);
    } else {
      console.log(`\n${table}: Error - ${error?.message}`);
    }
  }
}

auditColumns().catch(console.error);
