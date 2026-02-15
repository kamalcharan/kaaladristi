/**
 * Shared Supabase client for Edge Functions.
 * Uses service_role key to bypass RLS (reads computed public data).
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.95.3';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

export const supabase = createClient(supabaseUrl, supabaseServiceKey);
