---
phase: 10-am-liorer-gestion-demandes-et-ux
plan: "01"
subsystem: backend
tags: [prisma, bullmq, redis, email, rbac, reminders]
dependency-graph:
  requires: []
  provides:
    - UserRole enum with ADMIN/INITIATEUR/VALIDATEUR
    - BullMQ reminder queue and worker infrastructure
    - Initiator email notifications (action + completion)
    - scheduleReminder / cancelReminder service
  affects:
    - workflow-service (scheduleReminder, cancelReminder, sendInitiatorAction/Complete)
    - server.ts (reminder worker auto-start)
tech-stack:
  added:
    - BullMQ 5 Worker (deadline reminder processing)
    - ioredis (Redis connection for BullMQ)
  patterns:
    - Idempotent job scheduling via BullMQ jobId
    - Reminder cancellation on step completion and workflow cancel
    - Initiator notifications wrapped in try/catch (non-blocking)
key-files:
  created:
    - backend/src/infrastructure/queue/index.ts
    - backend/src/jobs/reminder-worker.ts
    - backend/src/services/reminder-service.ts
    - backend/prisma/migrations/20260219155049_add_role_enum/migration.sql
  modified:
    - backend/prisma/schema.prisma
    - backend/src/services/workflow-service.ts
    - backend/src/services/email-service.ts
    - backend/src/server.ts
    - backend/src/i18n/locales/en/common.json
    - backend/src/i18n/locales/fr/common.json
decisions:
  - Prisma generate required since no DATABASE_URL in .env — used DATABASE_URL env var inline for prisma validate and generate
  - IORedis imported as named export { Redis } to fix ESM constructability error
  - cancelReminder stub in workflow-service replaced with real import from reminder-service
  - Initiator completion detection uses workflowAdvanced flag (approval) and stepCompleted + no activatedStep (refusal)
metrics:
  duration: 6m
  completed: "2026-02-19"
  tasks: 3
  files-changed: 10
---

# Phase 10 Plan 01: Backend Foundation — RBAC, BullMQ Reminders, Initiator Emails Summary

**One-liner:** 3-role UserRole RBAC migration (ADMIN/INITIATEUR/VALIDATEUR), BullMQ deadline reminder pipeline with ioredis, and dual initiator email notifications (per-action + workflow completion).

## What Was Built

### Task 1: Prisma Schema Migration — 3-role UserRole Enum
Updated `schema.prisma` to replace `USER | ADMIN` with `ADMIN | INITIATEUR | VALIDATEUR`. Created migration SQL using the PostgreSQL enum recreation pattern (add values, migrate rows, rename old type, create new type, alter column, drop old). Ran `prisma generate` to regenerate the Prisma client.

### Task 2: BullMQ Reminder Queue, Worker, and Scheduler
- **`infrastructure/queue/index.ts`**: Shared Redis connection (ioredis, `maxRetriesPerRequest: null`) + `reminderQueue` export
- **`jobs/reminder-worker.ts`**: BullMQ Worker that processes `deadline-reminder` jobs — loads step, checks it's still IN_PROGRESS, finds pending validators, creates new action tokens, sends reminder emails
- **`services/reminder-service.ts`**: `scheduleReminder(stepId, deadline)` schedules 24h-before reminder; `cancelReminder(stepId)` removes the job idempotently
- **`workflow-service.ts`**: Wired `scheduleReminder` after `notifyValidators` in `launch()` and `recordAction()` (for activated steps); wired `cancelReminder` on step completion and workflow cancellation
- **`server.ts`**: Imports reminder worker for auto-start side-effect

### Task 3: Initiator Email Notifications
- **`email-service.ts`**: Added `sendInitiatorAction` (actor email, step name, action type, comment, workflow URL) and `sendInitiatorComplete` (final status APPROVED/REFUSED with color-coded button)
- **`workflow-service.ts`**: After each `recordAction()` transaction, fetches initiator with locale, sends `sendInitiatorAction` always, then `sendInitiatorComplete` if terminal state detected
- **i18n**: Added `initiator_action_subject` and `initiator_complete_subject` keys in EN and FR

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed broken dynamic import stub in workflow-service.ts**
- **Found during:** Task 2
- **Issue:** Pre-existing uncommitted change had a top-level `await import('./reminder-service.js')` with try/catch stub and a stub `cancelReminder` function that conflicted with proper imports
- **Fix:** Removed the stub entirely; replaced with proper static import of `scheduleReminder, cancelReminder` from reminder-service once that file was created
- **Files modified:** `backend/src/services/workflow-service.ts`
- **Commit:** c58dab2

**2. [Rule 2 - Missing functionality] Ran prisma generate to update Prisma client**
- **Found during:** Task 2 build verification
- **Issue:** After schema change, the generated Prisma client still had the old `UserRole` enum (USER/ADMIN), causing TS type mismatch in users.ts
- **Fix:** Ran `DATABASE_URL=... npx prisma generate` to regenerate the client
- **Files modified:** `node_modules/@prisma/client` (generated)
- **Commit:** c58dab2

**3. [Rule 1 - Bug] Fixed ioredis ESM import syntax**
- **Found during:** Task 2 build
- **Issue:** `import IORedis from 'ioredis'` with `new IORedis(...)` fails in ESM — ioredis exports a named `Redis` class
- **Fix:** Changed to `import { Redis } from 'ioredis'` and used `new Redis(...)`
- **Files modified:** `backend/src/infrastructure/queue/index.ts`
- **Commit:** c58dab2

## Deferred Items

Pre-existing TS errors in `auth.ts` and `documents.ts` (Fastify 5 reply status code type narrowing) were present before this plan and are out of scope. Logged but not fixed.

## Self-Check: PASSED

All created files verified present. All task commits verified in git log.

| Item | Status |
|------|--------|
| infrastructure/queue/index.ts | FOUND |
| jobs/reminder-worker.ts | FOUND |
| services/reminder-service.ts | FOUND |
| migration SQL | FOUND |
| Commit 57cf50c (Task 1) | FOUND |
| Commit c58dab2 (Task 2) | FOUND |
| Commit c556ac5 (Task 3) | FOUND |
