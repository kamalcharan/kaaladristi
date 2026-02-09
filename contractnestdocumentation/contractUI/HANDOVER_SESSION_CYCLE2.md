# Session Handover — Cycle 2 Service Execution

> **Date:** February 9, 2025
> **From Session:** Cycle 2 Service Execution build (Batches 1-7)
> **Branch:** `claude/init-submodules-setup-SmbfL`
> **Status:** CODE COMPLETE — NOT USER-TESTED

---

## What Was Done This Session

### Cycle 2: Service Execution — 7 Batches Delivered

Built the complete service execution module (tickets + evidence + audit) across all 4 layers:

| Batch | Commit | Layer | What |
|-------|--------|-------|------|
| 1 | `240417c` | UI | Enable appointments menu + scaffold page |
| 2 | `16d9bd9` | UI | Operations tab replacing Timeline on contract detail |
| 3 | `688d3f4` | UI | ServiceTicketDetail panel, EvidenceTab, AuditTab |
| 4 | `8ee11db` | DB | 7 migrations (022-028): tables + RPCs |
| 5 | `66adb51` `4278e10` | Edge | service-execution edge function (9 routes, consolidated) |
| 6 | `be8e9fc` | API | Controller, service, routes, validators, index.ts registration |
| 7 | `7c9ee39` `ef8c070` | UI | React Query hooks (12) + wiring components to API |

Also fixed: Compact ops banner, ContactHeaderCard, FinancialHealth sidebar.

---

## What Was NOT Done

1. **eventsplan.md** — NOW UPDATED (was requested but done at end of session)
2. **User testing** — User could NOT copy files to local machine this session
3. **Appointments CRUD** — Deferred to Cycle 3 (only scaffold page exists)
4. **Multi-assignee** — Deferred to Cycle 3
5. **Billing sub-tasks** — Deferred to Cycle 3

---

## Known Issues to Fix in Next Session

### HIGH PRIORITY (likely to break during testing)

| # | Issue | File(s) | What to Fix |
|---|-------|---------|-------------|
| 1 | **OperationsTab is ~1200 lines** | `contractnest-ui/src/components/contracts/OperationsTab.tsx` | May need splitting. User will report if it renders correctly |
| 2 | **Loading states missing** | OperationsTab, EvidenceTab, AuditTab | Add `isLoading` spinner from React Query hooks |
| 3 | **Untested API-to-Edge chain** | All layers | The full flow (UI → API → Edge → RPC) has never been tested end-to-end |

### MEDIUM PRIORITY (functional but not polished)

| # | Issue | File(s) | What to Fix |
|---|-------|---------|-------------|
| 4 | Idempotency key not enforced | `contractnest-edge/supabase/functions/service-execution/index.ts` | Key is extracted but RPC doesn't use it for dedup |
| 5 | rejection_reason not in update payload | Edge function + validators | Add to evidence update action='reject' |
| 6 | file_thumbnail_url not in create payload | Hooks + validators | Add if thumbnails should be supported |
| 7 | OTP code stored plaintext | Migration 024 | Document or add hashing policy |

### LOW PRIORITY (polish)

| # | Issue | File(s) |
|---|-------|---------|
| 8 | form_template_id has no FK | Migration 024 |
| 9 | Compact ops banner needs verification | UI |

---

## File Inventory — What Exists in Each Submodule

### contractnest-edge (Supabase)

**Migrations (contracts/):**
```
018_event_status_config.sql          — Cycle 1
019_backfill_event_status_existing_tenants.sql — Cycle 1
020_add_task_id_backfill.sql         — Cycle 1
021_auto_generate_task_id.sql        — Cycle 1
022_service_tickets_table.sql        — Cycle 2 Batch 4
023_service_ticket_events_junction.sql — Cycle 2 Batch 4
024_service_evidence_table.sql       — Cycle 2 Batch 4
025_audit_log_table.sql              — Cycle 2 Batch 4
026_service_ticket_rpcs.sql          — Cycle 2 Batch 5
027_service_evidence_rpcs.sql        — Cycle 2 Batch 5
028_audit_log_rpc.sql                — Cycle 2 Batch 5
```

**Edge Functions:**
```
functions/event-status-config/index.ts  — Cycle 1
functions/service-execution/index.ts    — Cycle 2 Batch 5 (529 lines, 9 routes)
```

### contractnest-api (Express)

**Cycle 2 files (all NEW):**
```
src/controllers/serviceExecutionController.ts  (330 lines)
src/services/serviceExecutionService.ts        (230 lines)
src/routes/serviceExecutionRoutes.ts           (100 lines)
src/validators/serviceExecutionValidators.ts   (293 lines)
```

**Updated:**
```
src/index.ts — route registered at /api/service-execution (line ~770)
```

### contractnest-ui (React)

**Cycle 2 files (all NEW):**
```
src/hooks/queries/useServiceExecution.ts           (441 lines, 12 hooks)
src/components/contracts/OperationsTab.tsx          (~1200 lines)
src/components/contracts/ServiceTicketDetail.tsx
src/components/contracts/EvidenceTab.tsx
src/components/contracts/AuditTab.tsx
```

**Updated:**
```
src/services/serviceURLs.ts — SERVICE_EXECUTION section (lines ~1005-1065)
```

---

## Database Schema (Cycle 2 tables)

### t_service_tickets
```sql
id UUID PK, tenant_id, contract_id FK
ticket_number TEXT (TKT-YYYY-XXXXX), status TEXT
scheduled_date, started_at, completed_at
assigned_to UUID, assigned_to_name TEXT (denorm)
notes TEXT, completion_notes TEXT
version INT (optimistic concurrency)
is_active BOOLEAN, created_by, created_at, updated_at
```

### t_service_ticket_events (junction)
```sql
id UUID PK, tenant_id, ticket_id FK, event_id FK
event_type TEXT, block_name TEXT (denorm)
created_at
```

### t_service_evidence
```sql
id UUID PK, tenant_id, ticket_id FK, contract_id FK
evidence_type TEXT ('upload-form'|'otp'|'service-form')
status TEXT, title TEXT, description TEXT
-- File fields: file_url, file_name, file_type, file_size, file_thumbnail_url
-- OTP fields: otp_code, otp_verified_at, otp_verified_by
-- Form fields: form_template_id, form_data JSONB, form_submitted_at
rejection_reason TEXT
is_active BOOLEAN, created_by, created_at, updated_at
```

### t_audit_log
```sql
id UUID PK, tenant_id, entity_type TEXT, entity_id UUID
category TEXT, action TEXT
old_value JSONB, new_value JSONB
performed_by UUID, performed_by_name TEXT
ip_address TEXT, user_agent TEXT
created_at
```

### RPCs Created
```
create_service_ticket(tenant, contract, scheduled_date, assigned_to, notes, event_ids[], idempotency_key)
update_service_ticket(tenant, ticket_id, version, status, assigned_to, notes, completion_notes)
get_service_tickets_list(tenant, contract, status, assigned_to, date_from, date_to, page, per_page)
get_service_ticket_detail(tenant, ticket_id)
create_service_evidence(tenant, ticket, contract, evidence_type, title, desc, file_*, form_*)
update_service_evidence(tenant, evidence_id, action, file_*, otp_code, form_data, rejection_reason)
get_service_evidence_list(tenant, contract, ticket, evidence_type, status, page, per_page)
get_audit_log(tenant, contract, entity_type, entity_id, category, performed_by, date_from, date_to, page, per_page)
```

---

## API Endpoints

```
GET    /api/service-execution                    — List tickets (with filters)
POST   /api/service-execution                    — Create ticket
GET    /api/service-execution/audit              — Get audit log
GET    /api/service-execution/evidence           — List evidence (with filters)
GET    /api/service-execution/:ticketId          — Get ticket detail
PATCH  /api/service-execution/:ticketId          — Update ticket
GET    /api/service-execution/:ticketId/evidence — List ticket evidence
POST   /api/service-execution/:ticketId/evidence — Create evidence
PATCH  /api/service-execution/:ticketId/evidence/:evidenceId — Update evidence
```

Rate limits: 200 reads/15min, 50 writes/15min

---

## React Query Hooks

```typescript
// Queries
useServiceTickets(filters)              — paginated list
useServiceTicketsForContract(contractId) — contract-scoped, 100 items
useServiceTicketDetail(ticketId)        — single ticket + evidence
useServiceEvidence(filters)             — paginated evidence list
useContractEvidence(contractId)         — contract-wide, 200 items
useTicketEvidence(ticketId)             — ticket-scoped, 50 items
useAuditLog(filters)                    — paginated audit
useContractAuditLog(contractId)         — contract-scoped audit

// Mutations
useCreateServiceTicket()                — toast on success/error
useUpdateServiceTicket()                — version tracking
useCreateServiceEvidence()              — toast on success/error
useUpdateServiceEvidence()              — verify/reject/update actions
```

---

## What the Next Session Should Do

### Priority 1: Help User Test Locally
The user needs the MANUAL_COPY_FILES output to test on their local machine. The files exist in the submodules but the MANUAL_COPY_FILES folders for Cycle 2 may not have the latest versions. The next session should:

1. Regenerate MANUAL_COPY_FILES with all Cycle 2 files organized by submodule
2. Provide PowerShell copy commands
3. Help debug any issues the user finds

### Priority 2: Fix Issues Found During Testing
Expect issues in:
- OperationsTab rendering (large component, may have import/type issues)
- API-to-Edge connectivity (HMAC signing, URL configuration)
- RPC execution (SQL may have syntax issues, column mismatches)

### Priority 3: Cycle 3 Planning
Once Cycle 2 is stable:
- Appointments CRUD (replacing scaffold)
- Multi-assignee support
- Billing sub-tasks

---

## MANUAL_COPY_FILES Status

The MANUAL_COPY_FILES directory has individual batch folders:
```
cycle2-batch1-enable-appointments/
cycle2-batch2-operations-tab/
cycle2-batch3-service-ticket-evidence-audit/
cycle2-batch4-db-migrations/
cycle2-batch5-edge-functions/
cycle2-batch6-api-layer/
batch7-ui-wiring/
```

**These may be outdated** — files were iterated on after initial batch creation. The **submodule code is the source of truth**, not MANUAL_COPY_FILES.

---

## Key Architecture Decisions Made This Session

1. **Unified edge function**: One `service-execution` function handles all 9 routes (tickets, evidence, audit) instead of separate functions per entity
2. **Operations tab replaces Timeline**: The old Timeline tab is now "Operations" with service tickets as first-class items
3. **Evidence types**: 3 types (upload-form, otp, service-form) stored in single table with nullable type-specific columns
4. **Audit is entity-based**: Generic `t_audit_log` table works for any entity type, not just events
5. **TKT numbering**: `TKT-YYYY-XXXXX` format, tenant-scoped auto-increment in RPC

---

## Submodule Commit Hashes (current)

```
contractnest-api:  c340de2 (main + 5 commits)
contractnest-edge: 53cd8bb (main + 10 commits)
contractnest-ui:   0277512 (main + 13 commits)
ClaudeDocumentation: 29060a3 (master + 2 commits)
```

All changes are committed to the `claude/init-submodules-setup-SmbfL` branch of the parent repo.

---

*Handover created: February 9, 2025*
