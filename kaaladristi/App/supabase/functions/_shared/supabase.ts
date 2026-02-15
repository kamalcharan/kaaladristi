/**
 * Shared Supabase client for Edge Functions.
 * Uses service_role key to bypass RLS (reads computed public data).
 *
 * NOTE: Supabase reserves the SUPABASE_ prefix for internal env vars.
 * We use KD_SERVICE_ROLE_KEY instead. Set via:
 *   supabase secrets set KD_SERVICE_ROLE_KEY=eyJ...
 *
 * SUPABASE_URL is auto-injected by Supabase runtime (no need to set it).
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.95.3';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('KD_SERVICE_ROLE_KEY')!;

export const supabase = createClient(supabaseUrl, supabaseServiceKey);
