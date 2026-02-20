---
phase: 14-social-features
plan: 01
subsystem: api
tags: [prisma, fastify, notifications, comments, workflow]

# Dependency graph
requires:
  - phase: 13-foundation
    provides: PasswordResetToken, Notification, WorkflowComment Prisma models; apiFetch fix; Zod forms
  - phase: 4-workflow-engine
    provides: workflowService.recordAction, WorkflowInstance with phases/steps, StepInstance.validatorEmails
provides:
  - commentService with addComment (participant check, terminal guard) and listComments
  - notificationService with createNotification (prefs-aware), listForUser, getUnreadCount, markRead, markAllRead, getPreferences, updatePreferences
  - REST API: GET/POST /api/workflows/:id/comments
  - REST API: GET /api/notifications, PATCH /api/notifications/read-all, PATCH /api/notifications/:id/read
  - REST API: GET/PUT /api/users/me/notification-prefs
  - Workflow engine hooks: STEP_APPROVED/STEP_REFUSED after recordAction, WORKFLOW_COMPLETED/WORKFLOW_REFUSED on terminal state
affects:
  - 14-02-frontend-social (will consume these REST endpoints)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Notification creation always outside prisma.$transaction(), after commit, in try/catch"
    - "readAt DateTime? pattern for read/unread (null=unread, non-null=read) — adapts to Phase 13 schema"
    - "Participant check: initiatorId === userId OR user.email in any step's validatorEmails"
    - "Route registration order: read-all before :id/read to avoid Fastify param collision"

key-files:
  created:
    - backend/src/services/comment-service.ts
    - backend/src/services/notification-service.ts
    - backend/src/api/routes/comments.ts
    - backend/src/api/routes/notifications.ts
  modified:
    - backend/prisma/schema.prisma
    - backend/src/app.ts
    - backend/src/services/workflow-service.ts

key-decisions:
  - "Adapted service code to Phase 13's actual Notification schema (readAt/metadata) rather than plan's read/context columns — avoids breaking migrations"
  - "notificationPrefs stored as Json on User; null means all types enabled by default"
  - "COMMENT_ADDED notifications trigger for all OTHER participants (initiator + registered validators), excluding comment author"
  - "Notification.createNotification stores full context in metadata column and extracts workflowId/stepId as dedicated columns where available"
  - "NOTIFICATION_TYPES constant exported from notification-service for type-safe cross-service usage"

patterns-established:
  - "Pattern: In-app notification hooks follow email notification hooks in recordAction — both after transaction, both in try/catch"
  - "Pattern: Participant identity check loads user record for email, then tests against workflowInstance.initiatorId and all step.validatorEmails"

requirements-completed: [COMM-01, COMM-02, COMM-03, COMM-04, COMM-05, NOTIF-01, NOTIF-02, NOTIF-03, NOTIF-04, NOTIF-05, NOTIF-06, NOTIF-07]

# Metrics
duration: 2min
completed: 2026-02-20
---

# Phase 14 Plan 01: Comments and Notifications Backend Summary

**Fastify REST API for workflow comments and in-app notifications with Prisma service layer and workflow engine hooks for STEP_APPROVED/STEP_REFUSED/WORKFLOW_COMPLETED/WORKFLOW_REFUSED events**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-20T12:09:15Z
- **Completed:** 2026-02-20T12:11:30Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments
- Comment CRUD API with participant access control (initiator or registered validator) and terminal-state guard
- Notification system with per-type user preference management and unread count tracking
- Workflow engine wired to create in-app notifications on every step action and terminal state transition
- All notification creation follows the critical constraint: outside $transaction(), after commit, try/catch

## Task Commits

Each task was committed atomically:

1. **Task 1: Add notificationPrefs to User model** - `a8c924b` (feat)
2. **Task 2: Create comment-service and notification-service** - `5d1dcc1` (feat)
3. **Task 3: Create REST routes, register in app.ts, wire workflow hooks** - `5d4a660` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `backend/prisma/schema.prisma` - Added `notificationPrefs Json?` to User model; WorkflowComment and Notification already existed from Phase 13
- `backend/src/services/comment-service.ts` - addComment (participant check, terminal guard, COMMENT_ADDED notifications) + listComments
- `backend/src/services/notification-service.ts` - NOTIFICATION_TYPES const, createNotification (prefs-aware), listForUser, getUnreadCount, markRead, markAllRead, getPreferences, updatePreferences
- `backend/src/api/routes/comments.ts` - GET/POST /workflows/:id/comments
- `backend/src/api/routes/notifications.ts` - GET /notifications, PATCH /notifications/read-all, PATCH /notifications/:id/read, GET/PUT /users/me/notification-prefs
- `backend/src/app.ts` - Register commentRoutes and notificationRoutes with prefix /api
- `backend/src/services/workflow-service.ts` - Import notificationService, add STEP_APPROVED/STEP_REFUSED hooks after recordAction, add WORKFLOW_COMPLETED/WORKFLOW_REFUSED on terminal state

## Decisions Made
- **Adapted to actual Phase 13 schema:** The plan specified `read Boolean` and `context Json` on Notification, but Phase 13's actual schema uses `readAt DateTime?` and `metadata Json?`. Adapted service code to use `readAt` (null=unread) and `metadata` column rather than creating a conflicting migration.
- **notificationPrefs JSON pattern:** Null prefs means all types enabled. Explicit `false` value disables a type. Unknown keys are ignored in updatePreferences.
- **COMMENT_ADDED recipients:** All workflow participants except the comment author — initiator + all registered users whose email appears in any step's validatorEmails.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Adapted Notification service to match actual Phase 13 schema**
- **Found during:** Task 2 (notification-service.ts creation)
- **Issue:** Plan specified `read Boolean` and `context Json` on Notification model, but Phase 13 created `readAt DateTime?` and `metadata Json?` with separate `workflowId`/`stepId` columns
- **Fix:** Service uses `readAt: null` as unread filter, sets `readAt: new Date()` for marking read, stores context in `metadata` column and extracts known fields (`workflowId`, `stepId`) to dedicated columns
- **Files modified:** `backend/src/services/notification-service.ts`
- **Verification:** `npx tsc --noEmit` exits 0; Prisma client types align with actual schema
- **Committed in:** `5d1dcc1` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug/schema mismatch)
**Impact on plan:** Essential to avoid broken Prisma queries. All planned functionality delivered with correct field names.

## Issues Encountered
None — schema mismatch was identified upfront and handled in Task 2 via the deviation rule.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All REST endpoints for comments and notifications are live and TypeScript-clean
- Workflow engine creates in-app notifications on every step action and terminal state
- Frontend (Plan 14-02) can immediately consume: GET/POST /api/workflows/:id/comments, GET /api/notifications, PATCH /api/notifications/read-all, PATCH /api/notifications/:id/read, GET/PUT /api/users/me/notification-prefs
- Notification polling interval (30s TanStack Query refetchInterval) to be implemented in frontend plan

---
*Phase: 14-social-features*
*Completed: 2026-02-20*
