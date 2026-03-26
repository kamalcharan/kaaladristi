/**
 * Backward-compatibility shim — re-exports PostgREST client as 'supabase'.
 * New code should import from './postgrest' directly.
 */
export { db as supabase, from, rpc } from './postgrest';
