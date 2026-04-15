# RLS Standardization Plan — KaalaDristi

## Proposed Standard Pattern

### Table Categories

| Category | RLS | SELECT | WRITE | Example Tables |
|---|---|---|---|---|
| **User data** | ON | Self only (`auth.uid() = id`) | Self only | `km_profiles` |
| **Master data** | ON | All authenticated | Admin only (`is_admin()`) | `km_equity_symbols`, `km_index_symbols` |
| **Time-series data** | ON | All authenticated | Admin only (`is_admin()`) | `km_equity_eod`, `km_index_eod` |
| **Computed aggregates** | OFF | GRANT SELECT to authenticated, anon | Write via SECURITY DEFINER functions only | `km_industry_eod`, `km_market_breadth`, `km_breadth_roc` |
| **Pipeline metadata** | OFF | GRANT SELECT to authenticated | Write via Pipeline API (direct PG) | `km_pipeline_runs`, `km_jobs`, `km_trading_calendar` |
| **Reference/config** | OFF | GRANT SELECT to authenticated, anon | GRANT ALL to authenticated (or admin-only) | `dc_lookup`, `dc_market_status` |
| **System-only** | OFF | No frontend access | Backend only | `kd_users` |

### Rationale

1. **Computed aggregates should NOT have RLS.** These tables are written by SQL functions
   (`compute_all_industry_composites`, etc.) running as superuser. No user-specific data.
   RLS on these tables has caused the km_industry_eod bug with zero benefit.

2. **Pipeline metadata should NOT have RLS.** `km_pipeline_runs` and `km_jobs` are operator
   data written by the Python backend. Frontend reads them for status display. RLS would
   only create permission issues.

3. **Master + time-series data SHOULD have RLS.** These are the core data tables accessed
   by the frontend. RLS ensures only authenticated users can read, and only admins can modify.

4. **All admin checks use `public.is_admin()`.** Never use `auth.uid()` subqueries against
   `km_profiles` (recursion risk) or `request.jwt.claims` extraction (Supabase-specific).

### Standard Policy Template

For master/time-series tables:
```sql
-- Read: all authenticated users
CREATE POLICY "{table}_read" ON {table}
    FOR SELECT TO authenticated USING (true);

-- Write: admin only
CREATE POLICY "{table}_admin_write" ON {table}
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());
```

For computed aggregates (NO RLS):
```sql
ALTER TABLE {table} DISABLE ROW LEVEL SECURITY;
GRANT SELECT ON {table} TO authenticated, anon;
-- Writes happen via SECURITY DEFINER compute functions
```

### Write Pattern

All computed data should be written via SECURITY DEFINER functions, not direct table access:
- `compute_all_industry_composites(DATE)` — already SECURITY DEFINER
- `compute_all_pending_indicators(TEXT, TEXT)` — already works
- Frontend NEVER writes to computed tables directly

### Role Hierarchy

```
postgres (superuser)
  └── kd_app (pipeline/backend role — bypasses RLS if superuser, needs GRANTs if not)
  └── authenticated (frontend JWT role — RLS applies)
  └── anon (unauthenticated — minimal access, currently unused)
```

**Recommendation**: Confirm `kd_app` is a superuser or add it to RLS policies explicitly.
If it's used only for PgClient connections (backend), making it a superuser is simplest.

---

## Implementation Checklist (Phase 3)

After Charan approves this plan:

1. [ ] Fix dc_inference write policy → admin-only
2. [ ] Fix km_index_constituents write policy → `is_admin()`
3. [ ] Re-enable RLS on km_industry_eod with correct policies (or keep OFF per aggregate pattern)
4. [ ] Remove reset_token from kd_auth_forgot_password response
5. [ ] Standardize GRANT statements (remove unnecessary GRANT ALL)
6. [ ] Verify all admin policies use `public.is_admin()`
7. [ ] Test matrix: 7 checks per table (see task spec)
8. [ ] Document decision on kd_app role
