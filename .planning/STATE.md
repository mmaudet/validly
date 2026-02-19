# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-19)

**Core value:** Any validator can approve or refuse a document directly from their email, without ever logging into the platform — making validation as frictionless as possible while maintaining a complete audit trail.
**Current focus:** Phase 10 — Améliorer gestion demandes et UX

## Current Position

Phase: 10 of 10 (Améliorer gestion demandes et UX)
Plan: 5 of 5 (10-01 through 10-05 complete — Task 2 checkpoint pending human verification)
Status: Checkpoint Pending
Last activity: 2026-02-19 — 10-05 AdminUsersPage frontend complete, awaiting end-to-end human verification

Progress: [██████████] 95% (checkpoint pending)

## Performance Metrics

**Velocity:**
- Total phases completed: 8
- Execution approach: Direct implementation without intermediary planning steps

**By Phase:**

| Phase | Description | Commit |
|-------|-------------|--------|
| 1 | Foundation | 706d553 |
| 2 | Data Model + Auth | 245e201 |
| 3 | Document Upload + Preview | c2dd671 |
| 4 | Workflow Engine | 8de7690 |
| 5+7 | Email + Templates (parallel) | d2c9f97 |
| 6+8 | Dashboard + Audit + i18n + Docker (parallel) | TBD |
| 9-01 | Workflow Creation UI — Wizard Scaffold + Doc Upload | 1ff9c33 |
| 9-02 | Workflow Creation UI — Dynamic Circuit Builder | da21662 |
| 9-03 | Workflow Creation UI — Review, Launch, Template Loading | 61137e3 |
| 10-01 | Backend foundation: RBAC migration, BullMQ reminders, initiator emails | c556ac5 |
| 10-02 | Backend API: cancel/re-notify/token-info/user-CRUD | c87daf7 |
| 10-03 | Frontend: ActionConfirmPage enriched with workflow summary | b52e54d |
| 10-04 | Frontend: WorkflowStepper, StepDetail, DocumentPreview + react-pdf, cancel/notify | f64789a |
| 10-05 | Frontend: AdminUsersPage, ConfirmDialog, nav link (checkpoint pending) | ea9f5f4 |

## Accumulated Context

### Decisions

- Stack: Node.js + TypeScript 5.8 + Fastify 5 + Prisma 6 + PostgreSQL 15 + BullMQ 5 + Redis 7 + React 19 + Vite 6 + Tailwind v4 + TanStack Query 5
- Phases 5+7 parallelized (Email + Templates are independent after Phase 4)
- Phases 6+8 parallelized (Dashboard/Audit + i18n/Docker are independent)
- Audit immutability enforced at DB level via PostgreSQL triggers
- Email action tokens use CSPRNG + SHA-256 hash-only storage + single-use + scoped + time-limited
- Quorum evaluation is atomic (decisionCount increment + re-evaluation in transaction)
- Refusal routing goes to previous phase, not initiator
- Wizard step index as useState<number> with FormProvider wrapping entire wizard
- Duplicate file detection by name+size composite key in document upload step
- validatorEmails stored as { email: string }[] (not string[]) — react-hook-form useFieldArray requires objects
- Quorum rule enum uses UNANIMITY/MAJORITY/ANY_OF to match backend engine values
- TemplatePicker uses enabled: isOpen for lazy fetch — no API call until dropdown opened
- executionMode (form field) renamed to execution only in API payload builder — form type unchanged
- Launch mutation uploads files in parallel (Promise.all) then POSTs workflow with collected IDs
- UserRole migrated from USER/ADMIN to ADMIN/INITIATEUR/VALIDATEUR using PostgreSQL enum recreation pattern
- BullMQ reminder jobs use jobId `reminder-{stepId}` for idempotent scheduling
- IORedis imported as named `{ Redis }` export for ESM compatibility
- Initiator completion detection: workflowAdvanced (approval) or stepCompleted + no activatedStep (refusal)
- GET /users accessible to all authenticated users (not admin-only) — needed for validator picker
- Prisma UserRole enum (ADMIN/INITIATEUR/VALIDATEUR) used directly for type safety in user CRUD
- tokenService.validateToken() includes initiator for token info endpoint — avoids extra DB query
- DocumentPreview fetches via fetch() with Authorization header + ArrayBuffer — avoids JWT tokens in URLs
- effectivePhaseId auto-derives from phases: IN_PROGRESS first, then last phase — no extra query
- ConfirmDialog created as standalone reusable component in components/ui/ (used by AdminUsersPage and WorkflowDetailPage)
- AdminUsersPage has inline role guard: user.role !== 'ADMIN' → navigate('/') redirect
- Role badges: ADMIN=purple, INITIATEUR=blue, VALIDATEUR=green
- ActionConfirmPage uses useQuery with enabled:!!token to fetch workflow summary before form — token error displayed inline
- DashboardPage filter state in Filters interface with DEFAULT_FILTERS const reset on tab switch
- Status i18n uses status.* namespace (not workflow.*) for dashboard filter label consistency

### Roadmap Evolution

- Phase 9 added: Workflow Creation UI — Multi-step wizard for creating workflows from the dashboard
- Phase 10 added: Améliorer gestion demandes et UX

### Pending Todos

None.

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-02-19
Stopped at: 10-05-PLAN.md Task 2 checkpoint — awaiting human end-to-end verification of all phase 10 features
Resume file: None
