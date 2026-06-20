import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://yfqjqqtngpdwqszlmdxj.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '...'; // I will get it from .env

import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
  const { count, error } = await supabase.from('productos').select('*', { count: 'exact', head: true });
  console.log('Total Productos:', count);
  if (error) console.error('Error:', error);
}

check();
