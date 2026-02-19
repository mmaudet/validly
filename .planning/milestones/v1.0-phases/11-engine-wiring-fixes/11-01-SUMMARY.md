---
phase: 11-engine-wiring-fixes
plan: 01
subsystem: backend/workflow-engine
tags: [parallel-execution, locale, email, workflow-service, state-machine, domain-types]
dependency_graph:
  requires: []
  provides:
    - "Correct parallel step activation at launch and phase advance"
    - "Locale-aware validator emails in all 3 notification paths"
    - "ARCHIVED status in WorkflowStatus domain type"
  affects:
    - backend/src/services/workflow-service.ts
    - backend/src/jobs/reminder-worker.ts
    - backend/src/domain/workflow-types.ts
    - backend/src/domain/state-machine.ts
tech_stack:
  added: []
  patterns:
    - "Batch prisma.user.findMany with email:{in:[...]} before email loop for locale resolution"
    - "activatedSteps[] array in tryAdvance() return for parallel next-phase notification"
    - "phaseHasParallel guard in tryAdvance() IN_PROGRESS branch prevents spurious PENDING activation"
key_files:
  modified:
    - backend/src/services/workflow-service.ts
    - backend/src/jobs/reminder-worker.ts
    - backend/src/domain/workflow-types.ts
    - backend/src/domain/state-machine.ts
decisions:
  - "Parallel phase detection: if ANY step in phase has execution=PARALLEL, ALL steps in that phase activate simultaneously"
  - "Unregistered validators (not in users table) fall back to locale 'en'"
  - "tryAdvance() returns both activatedStep (singular, sequential) and activatedSteps[] (plural, parallel) — recordAction() normalizes both into stepsToNotify[]"
  - "ARCHIVED added to state-machine WORKFLOW_TRANSITIONS as terminal -> ARCHIVED from APPROVED/REFUSED/CANCELLED"
metrics:
  duration_minutes: 3
  completed_date: "2026-02-19"
  tasks_completed: 2
  files_modified: 4
---

# Phase 11 Plan 01: Engine & Wiring Fixes — Parallel Activation + Locale Resolution Summary

**One-liner:** Parallel workflow steps now activate simultaneously at launch and phase advance, all validator emails resolve per-user locale via batch Prisma query with 'en' fallback, and ARCHIVED is added to the WorkflowStatus domain type.

## Tasks Completed

| Task | Name | Commit | Files Modified |
|------|------|--------|----------------|
| 1 | Fix parallel step activation in launch() and tryAdvance(), add ARCHIVED to WorkflowStatus | 7f108f0 | workflow-service.ts, workflow-types.ts, state-machine.ts |
| 2 | Fix validator email locale resolution in notifyValidators, notifyCurrentStep, and reminder-worker | 6f46233 | workflow-service.ts, reminder-worker.ts |

## What Was Built

### Task 1: Parallel Step Activation + ARCHIVED Type

**workflow-types.ts:** Added `'ARCHIVED'` to `WorkflowStatus` union to align the domain type with the Prisma enum (which already had ARCHIVED from a prior migration).

**state-machine.ts:** Added `ARCHIVED: []` entry and updated APPROVED/REFUSED/CANCELLED to allow the `-> ARCHIVED` transition, satisfying TypeScript's `Record<WorkflowStatus, WorkflowStatus[]>` constraint.

**workflow-service.ts — launch():** Before the inner step loop, compute `phaseHasParallel = phaseDef.steps.some(s => s.execution === 'PARALLEL')`. Use `isActiveStep = pi === 0 && (phaseHasParallel || si === 0)` to activate all parallel phase-0 steps simultaneously. Post-transaction email block now loops over ALL IN_PROGRESS steps in phase 0 (not just `firstStep`), ensuring every parallel validator receives their email and reminder schedule.

**workflow-service.ts — tryAdvance():** Added `activatedSteps[]` to the return type. In the APPROVED branch (next phase activation): load all next-phase steps, check `nextPhaseHasParallel`, activate ALL steps if parallel and populate `activatedSteps[]`, or activate only first step for sequential. In the IN_PROGRESS branch: guard `const nextStep = ...` with `if (!phaseHasParallel)` to prevent spurious PENDING activation in parallel phases.

**workflow-service.ts — recordAction():** Propagate `activatedSteps` from `tryAdvance()` result. Build `stepsToNotify` that prioritizes `activatedSteps[]` for parallel next phases, falling back to `[activatedStep]` for sequential. Single loop handles notification and reminder scheduling for all cases.

### Task 2: Locale-Aware Notifications

**workflow-service.ts — notifyValidators():** Batch `prisma.user.findMany({ where: { email: { in: validatorEmails } } })` before token creation. `localeByEmail.get(email) ?? 'en'` used in `sendPendingAction()` call. Unregistered validators (not in users table) correctly default to English.

**workflow-service.ts — notifyCurrentStep():** Same pattern applied inside the `try {}` block before the token loop. `sendManualReminder()` uses `localeByEmail.get(email) ?? 'en'`.

**reminder-worker.ts:** After resolving `pendingEmails`, batch locale lookup with `localeByEmail`. Per-email `const locale = localeByEmail.get(email) ?? 'en'` in the loop. Deadline date formatting uses `locale === 'fr' ? 'fr-FR' : 'en-GB'` for correct date presentation in the validator's language.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added ARCHIVED to WORKFLOW_TRANSITIONS in state-machine.ts**
- **Found during:** Task 1, TypeScript compile check
- **Issue:** Adding `'ARCHIVED'` to `WorkflowStatus` caused `state-machine.ts` to fail compilation — `WORKFLOW_TRANSITIONS: Record<WorkflowStatus, WorkflowStatus[]>` required an `ARCHIVED` key but the table only had 5 of the 6 statuses.
- **Fix:** Added `ARCHIVED: []` entry and updated `APPROVED`, `REFUSED`, and `CANCELLED` to include `'ARCHIVED'` as a valid outgoing transition (matching the `archive()` method's business logic).
- **Files modified:** `backend/src/domain/state-machine.ts`
- **Commit:** 7f108f0

## Verification Results

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | PASS — zero errors |
| `phaseHasParallel` in launch(), tryAdvance() IN_PROGRESS guard, tryAdvance() next-phase block | PASS — 3 locations |
| `activatedSteps` in return type, parallel next-phase branch, recordAction() notification loop | PASS — all present |
| `result.activatedSteps` in recordAction() notification loop | PASS |
| `localeByEmail` in 3 notification paths | PASS — notifyValidators, notifyCurrentStep, reminder-worker |
| No hardcoded `locale: 'fr'` in workflow-service.ts or reminder-worker.ts | PASS — zero matches |
| `ARCHIVED` in WorkflowStatus domain type | PASS |

## Self-Check: PASSED

All files verified present, all commits verified in git log:
- 7f108f0: Task 1 commit — `feat(11-01): fix parallel step activation in launch/tryAdvance, add ARCHIVED to WorkflowStatus`
- 6f46233: Task 2 commit — `feat(11-01): fix validator email locale resolution in all 3 notification paths`
