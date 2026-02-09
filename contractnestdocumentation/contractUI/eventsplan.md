# Events Execution Plan — ContractNest

> **Date:** February 2025
> **Status:** Active — Cycle 1 In Progress
> **Author:** Charan Kamal Bommakanti / Claude Code Session

---

## Vision

Events are the **core operational execution layer** for a contract. When a contract becomes Active, its promises (service deliveries, spare parts, billing milestones) materialise as events — each trackable, assignable, and auditable.

---

## Architecture Decisions (Confirmed)

| # | Decision |
|---|----------|
| 1 | **3 event types:** `service`, `spare_part`, `billing` |
| 2 | **TaskID (TSK-xxxxx):** Eager — auto-generated on event creation via sequencing. Internal only, never shown in UI |
| 3 | **Service Ticket (TKT-yyyy-xxxxx):** User-facing — created on actual execution. 1 ticket = 1 contract. Can group multiple service + spare_part events from the same contract in a single visit |
| 4 | **Multiple assignees** possible per event + Account Manager role |
| 5 | **Spare part balance:** Computed from events (promised qty vs completed count). No fulfillment ledger table |
| 6 | **Unlimited spare parts:** On-demand event creation, no upfront generation |
| 7 | **Domain-specific statuses:** One table holds definitions + transitions. Tenant-overridable. System defaults seeded on sign-up |
| 8 | **Bidirectional status transitions:** Statuses can go up and down. Full audit on every change |
| 9 | **Appointments:** Separate table linked to events. Activate existing hidden menu item |
| 10 | **Billing plans:** Sub-tasks/todos per billing event |
| 11 | **Evidence/proofs:** Tied to service ticket execution, types from Catalog Studio |
| 12 | **VaNi:** No build now. Clean handover — all tables include `source` column ('user'/'system'/'vani'), insights table designed later. VaNi rules at `/vani/rules` already routed |

---

## Two-ID System

```
Contract Activates
    |
    v
Events Created (each gets internal TaskID: TSK-00001)
    |  TaskID = internal tracking, never shown in UI
    v
Actual Execution Happens
    |
    v
Service Ticket Created (TKT-2025-00001) -- user-facing
    |  1 ticket = 1 contract, groups multiple tasks in 1 visit
    v
Tasks executed, evidence collected, status updated
```

---

## Cycle Breakdown

### Cycle 1: Event Foundation & Status Engine

**Goal:** Expand event types, add internal TaskID, build unified status configuration system

#### What Gets Built:
- `spare_part` event type added to `t_contract_events`
- `task_id`, `promise_qty`, `is_unlimited` columns on events table
- `m_event_status_config` table — status definitions per event_type, tenant-overridable
- `m_event_status_transitions` table — from/to pairs per event_type
- Seed defaults for all 3 event types (service, spare_part, billing)
- Settings UI at `/settings/configure/event-statuses`
- Updated RPCs — TaskID generation on event creation, transition validation on status update
- UI: TimelineTab handles spare_part + dynamic statuses, cockpit shows 3-type bucketing

#### Files Impacted:

**Edge Migrations (3 new):**
- `migrations/contracts/017_add_spare_part_event_type.sql`
- `migrations/contracts/018_event_status_config.sql`
- `migrations/contracts/019_update_event_rpcs_v2.sql`

**Edge Functions (1 new, 1 update):**
- `functions/event-status-config/index.ts` — NEW
- `functions/contract-events/index.ts` — UPDATE

**API (5 new, 3 updated):**
- `routes/eventStatusConfigRoutes.ts` — NEW
- `controllers/eventStatusConfigController.ts` — NEW
- `services/eventStatusConfigService.ts` — NEW
- `types/eventStatusConfigTypes.ts` — NEW
- `seeds/eventStatuses.seed.ts` — NEW
- `types/contractEventTypes.ts` — UPDATE
- `validators/contractEventValidators.ts` — UPDATE
- `seeds/SeedRegistry.ts` — UPDATE

**UI (4 new, 7 updated):**
- `types/eventStatusConfig.ts` — NEW
- `hooks/queries/useEventStatusConfigQueries.ts` — NEW
- `pages/settings/event-statuses/index.tsx` — NEW
- `services/eventStatusConfigService.ts` — NEW
- `types/contractEvents.ts` — UPDATE
- `hooks/queries/useContractEventQueries.ts` — UPDATE
- `utils/constants/settingsMenus.ts` — UPDATE
- `components/contracts/TimelineTab.tsx` — UPDATE
- `components/contracts/ContractWizard/steps/EventsPreviewStep.tsx` — UPDATE
- `utils/service-contracts/contractEvents.ts` — UPDATE
- `pages/ops/cockpit/index.tsx` — UPDATE

---

### Cycle 2: Service Tickets & Appointments

**Goal:** Service ticket entity, operational appointment system, multi-assignee support

#### What Gets Built:
- `t_service_tickets` table — contract-scoped, groups events into visits
- `t_appointments` table — linked to service tickets and events
- `t_event_assignees` table — multi-assignee with roles (assignee/account_manager/observer)
- Appointment pages: list, create, detail (replacing mock UI)
- Service ticket pages: list, create, detail
- Menu item activation for appointments
- Cockpit integration: upcoming appointments, ticket quick actions

#### Files Impacted:

**Edge Migrations (3 new):**
- `migrations/contracts/020_service_tickets.sql`
- `migrations/contracts/021_appointments.sql`
- `migrations/contracts/022_multi_assignee.sql`

**Edge Functions (2 new):**
- `functions/service-tickets/index.ts`
- `functions/appointments/index.ts`

**API (10 new, 1 updated):**
- Routes, controllers, services, types, validators for both service-tickets and appointments
- `index.ts` — UPDATE (register routes)

**UI (10 new, 5 updated):**
- Types, hooks, pages (list/create/detail) for service-tickets and appointments
- `UpcomingAppointments.tsx` — UPDATE (real data)
- `industryMenus.ts` — UPDATE (uncomment appointments)
- `TimelineTab.tsx` — UPDATE (create ticket action)
- `contracts/detail/index.tsx` — UPDATE (multi-assignee)
- `ops/cockpit/index.tsx` — UPDATE (appointments section)

---

### Cycle 3: Event Sub-Tasks, Evidence & Audit

**Goal:** Billing plan todos, evidence collection, full bidirectional audit

#### What Gets Built:
- `t_event_tasks` table — sub-tasks/todos per event (billing plans, service checklists)
- `t_event_evidence` table — evidence records linked to service ticket execution
- Enhanced audit: auto-audit triggers, transition validation, bidirectional tracking
- UI: task checklists on events, evidence panel on tickets, audit trail component
- VaNi handover: `source` column on all tables, documented interface contract

#### Files Impacted:

**Edge Migrations (3 new):**
- `migrations/contracts/023_event_tasks.sql`
- `migrations/contracts/024_event_evidence.sql`
- `migrations/contracts/025_enhanced_audit.sql`

**Edge Functions (2 new, 2 updated):**
- `functions/event-tasks/index.ts` — NEW
- `functions/event-evidence/index.ts` — NEW
- `functions/contract-events/index.ts` — UPDATE (audit route)
- `functions/service-tickets/index.ts` — UPDATE (link tasks/evidence)

**API (10 new, 1 updated):**
- Routes, controllers, services, types, validators for event-tasks and event-evidence
- `index.ts` — UPDATE

**UI (7 new, 3 updated):**
- Types, hooks for tasks and evidence
- `EventTasksList.tsx`, `EventEvidencePanel.tsx`, `EventAuditTrail.tsx` — NEW components
- `TimelineTab.tsx` — UPDATE (task progress, evidence indicator)
- `service-tickets/detail/index.tsx` — UPDATE (tasks + evidence tabs)
- `contracts/detail/index.tsx` — UPDATE (wire Evidence tab)

---

## VaNi Handover Contract

VaNi is NOT built in these cycles. However, all infrastructure is handover-ready:

### What VaNi Can Consume (Read):
- `m_event_status_config` — understand valid statuses per event type
- `m_event_status_transitions` — know valid moves
- `t_contract_events` — read all events, their statuses, assignments
- `t_service_tickets` — understand execution state
- `t_event_tasks` — see checklist progress
- `t_event_evidence` — validate proof completeness
- `t_contract_event_audit` — full history

### What VaNi Can Write:
- `source = 'vani'` on any status change, task creation, or insight
- Own tables (future): `t_vani_insights`, `t_vani_plans`
- JTD records: fire notifications via existing JTD framework (all event types ready)
- Rules: `/vani/rules` route already exists, wire to `t_event_jtd_rules` (future)

### Columns Reserved for VaNi:
- `source TEXT DEFAULT 'user'` — on all audit/config tables ('user'|'system'|'vani')
- `requires_evidence BOOLEAN` — on transitions (VaNi can enforce proof collection)
- `is_auto_triggered BOOLEAN` — on event_tasks (VaNi-created tasks)

---

## Default Status Flows (Seed Data)

### Service Events
```
scheduled --> assigned --> in_progress --> completed
                |              |               |
                v              v               v
            cancelled      on_hold          reopened
                           /     \              |
                          v       v             v
                    assigned  cancelled    in_progress
```
Statuses: scheduled, assigned, in_progress, completed, on_hold, cancelled, overdue, reopened

### Spare Part Events
```
scheduled --> procurement_pending --> ordered --> shipped --> delivered --> installed
                                                                            |
                                                                     return_requested
```
Statuses: scheduled, procurement_pending, ordered, shipped, delivered, installed, cancelled, return_requested, overdue

### Billing Events
```
scheduled --> invoice_generated --> sent --> payment_pending --> paid
                                                  |
                                            partial_payment --> paid
```
Statuses: scheduled, invoice_generated, sent, payment_pending, partial_payment, paid, overdue, waived, cancelled

---

## Grand Totals

| | Cycle 1 | Cycle 2 | Cycle 3 | Total |
|---|---------|---------|---------|-------|
| New files | 14 | 22 | 20 | 56 |
| Updated files | 12 | 7 | 6 | 25 |
| Edge migrations | 3 | 3 | 3 | 9 |

---

*Last Updated: February 2025*
