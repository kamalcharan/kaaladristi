import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

if (!supabaseUrl || !supabaseKey) {
  console.error(
    '[Kala-Drishti] Supabase credentials missing!\n' +
    '  VITE_SUPABASE_URL:', supabaseUrl ? 'set' : 'MISSING', '\n' +
    '  VITE_SUPABASE_ANON_KEY:', supabaseKey ? 'set' : 'MISSING', '\n' +
    '  Make sure .env file exists in App/frontend/ with these values.'
  );
}

console.log('[Kala-Drishti] Supabase URL:', supabaseUrl || '(not set)');

export const supabase = createClient(
  supabaseUrl || '',
  supabaseKey || ''
);
