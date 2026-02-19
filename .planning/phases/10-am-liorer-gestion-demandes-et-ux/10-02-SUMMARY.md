---
phase: 10-am-liorer-gestion-demandes-et-ux
plan: "02"
subsystem: api
tags: [fastify, prisma, bullmq, jwt, user-management, workflow]

requires:
  - phase: 4-workflow-engine
    provides: workflowService, WorkflowError, Prisma workflow models
  - phase: 2-data-model-auth
    provides: User model, UserRole enum (ADMIN/INITIATEUR/VALIDATEUR), JWT auth pattern

provides:
  - PATCH /workflows/:id/cancel — cancels in-progress workflows, expires tokens, removes reminders
  - POST /workflows/:id/notify — re-sends email notifications to pending validators
  - GET /actions/:token/info — returns workflow summary from action token without consuming it
  - GET /users — list all users (authenticated, for validator picker)
  - POST /users — create user (admin only)
  - PATCH /users/:id — update user name/role/locale (admin only)
  - DELETE /users/:id — delete user (admin only, last-admin guard)

affects:
  - 10-03-PLAN (frontend workflow management UI consumes cancel/notify endpoints)
  - 10-04-PLAN (frontend action flow uses token info endpoint)
  - 10-05-PLAN (admin panel uses user CRUD endpoints)

tech-stack:
  added: []
  patterns:
    - cancelReminder() imported from reminder-service.ts for BullMQ job cleanup
    - UserRole Prisma enum imported directly for type safety in service/routes
    - requireAdmin preHandler pattern for role-based route protection
    - Last-admin guard pattern: count admins before delete

key-files:
  created:
    - backend/src/services/user-service.ts
    - backend/src/api/routes/users.ts
  modified:
    - backend/src/services/workflow-service.ts
    - backend/src/services/token-service.ts
    - backend/src/api/routes/workflows.ts
    - backend/src/api/routes/actions.ts
    - backend/src/app.ts

key-decisions:
  - "cancelReminder imported directly from reminder-service.ts (already existed as untracked file from prior session)"
  - "GET /users accessible to all authenticated users — not admin-only — for validator picker in workflow creation"
  - "tokenService.validateToken() enhanced with initiator include to support token info endpoint without extra DB query"
  - "Prisma UserRole enum used for type safety instead of string union — ADMIN/INITIATEUR/VALIDATEUR"

patterns-established:
  - "UserError class mirrors WorkflowError/AuthError: statusCode + message pattern"
  - "requireAdmin preHandler: authenticate + role check in one function"
  - "reply.status(code as any) for Fastify 5 strict literal type system"

requirements-completed:
  - WORKFLOW-CANCEL
  - WORKFLOW-RENOTIFY
  - ACTION-TOKEN-INFO
  - USER-CRUD

duration: 5min
completed: 2026-02-19
---

# Phase 10 Plan 02: Backend API — Cancel, Re-notify, Token Info, User CRUD Summary

**Four new REST API endpoints: workflow cancel/re-notify, action token info, and full admin user CRUD with role-based access control**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-19T14:50:02Z
- **Completed:** 2026-02-19T14:55:12Z
- **Tasks:** 2
- **Files modified:** 7 (2 created, 5 modified)

## Accomplishments

- Workflow cancel endpoint (PATCH /workflows/:id/cancel): expires all active tokens via updateMany, creates WORKFLOW_CANCELLED audit event, cancels BullMQ reminder jobs
- Workflow re-notify endpoint (POST /workflows/:id/notify): finds pending validators (those who haven't acted), sends fresh email notifications only to them
- Action token info endpoint (GET /actions/:token/info): returns workflow title, step/phase name, initiator name, document list from token — non-consuming, no JWT needed
- Full admin user CRUD: list (all authenticated), create/update/delete (admin only with requireAdmin preHandler), last-admin deletion guard

## Task Commits

Each task was committed atomically:

1. **Task 1: Workflow cancel, re-notify, and action token info** - `f2f9d84` (feat)
2. **Task 2: Admin user CRUD routes and service** - `c87daf7` (feat)

**Plan metadata:** (to be added after SUMMARY commit)

## Files Created/Modified

- `backend/src/services/workflow-service.ts` - Added cancel() and notifyCurrentStep() methods; imported cancelReminder from reminder-service
- `backend/src/services/token-service.ts` - Added initiator include to validateToken() for token info endpoint
- `backend/src/api/routes/workflows.ts` - Added PATCH /cancel and POST /notify routes
- `backend/src/api/routes/actions.ts` - Added GET /actions/:token/info route (no auth)
- `backend/src/services/user-service.ts` - NEW: listAll, getById, create, update, delete with last-admin guard
- `backend/src/api/routes/users.ts` - NEW: 4 CRUD routes with authenticate/requireAdmin preHandlers
- `backend/src/app.ts` - Registered userRoutes with /api prefix

## Decisions Made

- GET /users is accessible to all authenticated users (not admin-only) — needed for validator picker in workflow creation wizard
- Used Prisma's UserRole enum directly (not string literals) for type safety
- tokenService.validateToken() enhanced with initiator include so the token info endpoint needs only one DB call
- cancelReminder imported from existing reminder-service.ts (found as untracked file from prior incomplete session)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed pre-existing Fastify 5 strict literal type errors in auth.ts and documents.ts**
- **Found during:** Task 1 (first build attempt)
- **Issue:** `reply.status(err.statusCode)` failed TypeScript type check — Fastify 5 requires literal status codes matching schema response definitions, not `number` type
- **Fix:** Added `as any` cast to `err.statusCode` in all catch blocks in auth.ts and documents.ts
- **Files modified:** backend/src/api/routes/auth.ts, backend/src/api/routes/documents.ts
- **Verification:** npm run build passes with zero errors
- **Committed in:** f2f9d84 (Task 1 commit)

**2. [Rule 3 - Blocking] Fixed pre-existing queue/index.ts IORedis import error**
- **Found during:** Task 2 (second build attempt)
- **Issue:** `import IORedis from 'ioredis'` with `new IORedis()` not constructable in TypeScript strict mode
- **Fix:** Linter auto-corrected to `import { Redis } from 'ioredis'` with `new Redis()` and typed error handler
- **Files modified:** backend/src/infrastructure/queue/index.ts
- **Verification:** npm run build passes with zero errors
- **Committed in:** c87daf7 (Task 2 commit, implicitly via linter)

---

**Total deviations:** 2 auto-fixed (1 pre-existing bug, 1 pre-existing blocking issue)
**Impact on plan:** Both auto-fixes addressed pre-existing TypeScript errors that blocked the build. No scope creep. All plan requirements delivered exactly as specified.

## Issues Encountered

- reminder-service.ts already existed as an untracked file from a prior incomplete plan-01 session — used directly instead of implementing the no-op stub approach described in the plan notes

## Next Phase Readiness

- All 7 new API endpoints are available for frontend plans 03 (workflow management), 04 (action flow), and 05 (admin panel)
- User CRUD endpoints use ADMIN/INITIATEUR/VALIDATEUR roles — consistent with plan 01's schema migration
- No blockers

---
*Phase: 10-am-liorer-gestion-demandes-et-ux*
*Completed: 2026-02-19*
