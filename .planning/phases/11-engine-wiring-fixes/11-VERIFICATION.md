---
phase: 11-engine-wiring-fixes
verified: 2026-02-19T00:00:00Z
status: passed
score: 11/11 must-haves verified
re_verification: false
gaps: []
human_verification:
  - test: "Launch a workflow with PARALLEL steps and confirm all validators in phase 0 receive separate notification emails"
    expected: "Each validator in the parallel phase gets an email with their own approve/refuse links"
    why_human: "Email delivery requires a live mail environment; grep confirms code loops over all IN_PROGRESS steps but cannot exercise the email transport"
  - test: "Load a saved template in the workflow creation wizard circuit builder and inspect all steps"
    expected: "Each step's execution mode (SEQUENTIAL or PARALLEL) is populated correctly, not undefined"
    why_human: "UI rendering of execution mode populated from template.step.execution requires browser interaction"
  - test: "Attempt an UPDATE on the audit_events table from any connected client and confirm it fails"
    expected: "PostgreSQL raises: 'UPDATE operations are not allowed on audit_events table'"
    why_human: "Cannot run live DB query from verifier; trigger existence is confirmed in migration SQL but live DB state was not re-queried"
---

# Phase 11: Engine & Wiring Fixes Verification Report

**Phase Goal:** Close audit gaps: fix parallel step activation, template field mismatch, validator email locale, audit trail DB-level immutability, and domain type consistency
**Verified:** 2026-02-19
**Status:** PASSED
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A workflow with PARALLEL steps activates all steps in the phase simultaneously at launch | VERIFIED | `launch()` computes `phaseHasParallel` at line 116; `isActiveStep = pi === 0 && (phaseHasParallel \|\| si === 0)` at line 123; post-transaction block loops `firstPhase.steps.filter(s => s.status === 'IN_PROGRESS')` at line 162 |
| 2 | Loading a template into the circuit builder correctly populates execution mode for all steps | VERIFIED | `TemplatePicker.tsx` interface uses `execution: 'SEQUENTIAL' \| 'PARALLEL'` (no `executionMode`); `templateStructureToForm()` at line 114 reads `step.execution` and maps to form `executionMode`; no `step.executionMode` reference in template loading path |
| 3 | Validator emails are sent in the validator's locale (not hardcoded French) | VERIFIED | `notifyValidators()` batch queries `prisma.user.findMany` at line 45, builds `localeByEmail` map, uses `localeByEmail.get(email) ?? 'en'` at line 56; same pattern in `notifyCurrentStep()` at line 749/753/761; zero hardcoded `locale: 'fr'` in either file |
| 4 | An attempted UPDATE or DELETE on `audit_events` fails at the PostgreSQL level | VERIFIED | Migration `20260219223242_add_audit_immutability_triggers/migration.sql` contains `BEFORE UPDATE ON audit_events` trigger (prevent_audit_update) and `BEFORE DELETE ON audit_events` trigger (prevent_audit_delete) with `RAISE EXCEPTION`; migration is registered in Prisma pipeline |
| 5 | `ARCHIVED` status is present in domain `WorkflowStatus` type | VERIFIED | `workflow-types.ts` line 1: `export type WorkflowStatus = 'DRAFT' \| 'IN_PROGRESS' \| 'APPROVED' \| 'REFUSED' \| 'CANCELLED' \| 'ARCHIVED'`; `state-machine.ts` has `ARCHIVED: []` in WORKFLOW_TRANSITIONS and `APPROVED/REFUSED/CANCELLED` include `'ARCHIVED'` as valid outgoing transition |

**Score:** 5/5 observable truths verified

### Additional Must-Have Truths (from PLAN frontmatter)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 6 | When a parallel phase completes and the next phase is also parallel, all its steps activate simultaneously | VERIFIED | `tryAdvance()` line 509: `nextPhaseHasParallel = nextPhaseSteps.some(s => s.execution === 'PARALLEL')`; lines 511-521 loop `for (const s of nextPhaseSteps)` activating all steps; `activatedSteps[]` populated with all steps |
| 7 | In a PARALLEL phase, approving one step does NOT activate a PENDING step — all were already activated | VERIFIED | `tryAdvance()` IN_PROGRESS branch at line 547: `const phaseHasParallel = steps.some(s => s.execution === 'PARALLEL'); if (!phaseHasParallel) { ... find next PENDING ... }` — guard prevents spurious activation in parallel phases |
| 8 | Unregistered validators receive emails in English (fallback locale) | VERIFIED | All three notification paths use `localeByEmail.get(email) ?? 'en'` — users not in the DB return `undefined` from Map, falling back to `'en'` |
| 9 | Reminder emails use the validator's locale for both content and deadline date formatting | VERIFIED | `reminder-worker.ts` lines 65-68: `const locale = localeByEmail.get(email) ?? 'en'`; `deadlineDate = step.deadline.toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-GB')`; `locale` passed to `emailService.sendReminder()` |
| 10 | The audit immutability triggers are applied automatically via prisma migrate deploy (no manual psql step) | VERIFIED | `backend/package.json` line 16: `"db:setup": "prisma migrate dev"` — no `psql` step; migration directory `20260219223242_add_audit_immutability_triggers` exists in migrations pipeline |
| 11 | recordAction() loops over result.activatedSteps for notification when advancing to parallel next phase | VERIFIED | Lines 318-324: `stepsToNotify = result.activatedSteps.length > 0 ? result.activatedSteps : result.activatedStep ? [result.activatedStep] : []`; loop at line 337 `for (const step of stepsToNotify)` handles both parallel and sequential cases |

**Combined score:** 11/11 must-haves verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/src/services/workflow-service.ts` | Parallel activation + locale-aware notifications | VERIFIED | Contains `phaseHasParallel` (2x), `nextPhaseHasParallel` (1x), `activatedSteps[]`, `localeByEmail` (2x — notifyValidators + notifyCurrentStep), `stepsToNotify` loop in recordAction() |
| `backend/src/jobs/reminder-worker.ts` | Locale-aware reminder emails | VERIFIED | Contains `localeByEmail`, per-email `locale = localeByEmail.get(email) ?? 'en'`, locale-aware `toLocaleDateString()` |
| `backend/src/domain/workflow-types.ts` | WorkflowStatus includes ARCHIVED | VERIFIED | Line 1 exports `'ARCHIVED'` in the union |
| `backend/src/domain/state-machine.ts` | WORKFLOW_TRANSITIONS includes ARCHIVED | VERIFIED | `ARCHIVED: []` key present; APPROVED/REFUSED/CANCELLED all include `'ARCHIVED'` as valid transition |
| `frontend/src/components/workflow/TemplatePicker.tsx` | Template step type uses `execution` field | VERIFIED | Line 17: `execution: 'SEQUENTIAL' \| 'PARALLEL'`; no `executionMode` in file |
| `frontend/src/pages/WorkflowCreatePage.tsx` | templateStructureToForm reads step.execution | VERIFIED | Line 114: `executionMode: step.execution` in templateStructureToForm(); line 89: `execution: step.executionMode` in buildWorkflowPayload() is intentional (form field → API field) |
| `backend/prisma/migrations/20260219223242_add_audit_immutability_triggers/migration.sql` | Audit trigger SQL in Prisma migration | VERIFIED | Contains `BEFORE UPDATE ON audit_events` and `BEFORE DELETE ON audit_events` triggers with `RAISE EXCEPTION` |
| `backend/package.json` | db:setup without manual psql step | VERIFIED | `"db:setup": "prisma migrate dev"` — no psql reference |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `workflow-service.ts` | `prisma.user` | `findMany({email:{in:...}})` before email loop in `notifyValidators()` | VERIFIED | Line 45-49: batch query + Map construction before token loop |
| `workflow-service.ts` | `workflow-service.ts` | launch() loops all IN_PROGRESS steps in phase 0 for notifications | VERIFIED | Lines 161-163: `firstPhase.steps.filter(s => s.status === 'IN_PROGRESS')` drives email loop |
| `reminder-worker.ts` | `prisma.user` | `findMany({email:{in:...}})` before reminder loop | VERIFIED | Lines 54-58: batch query + Map construction |
| `workflow-service.ts` | `workflow-service.ts` | recordAction() uses `result.activatedSteps` for parallel next-phase notification | VERIFIED | Lines 321-322: `result.activatedSteps` consumed in `stepsToNotify` normalization |
| `TemplatePicker.tsx` | `WorkflowCreatePage.tsx` | Template type with `execution` consumed by `templateStructureToForm()` | VERIFIED | Line 114: `step.execution` reads from imported `Template` type with correct field name |
| `backend/prisma/migrations/` | `audit_events` table | BEFORE UPDATE and BEFORE DELETE triggers | VERIFIED | Migration SQL lines 12-15 (UPDATE trigger) and 25-29 (DELETE trigger) targeting `audit_events` |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| WF-02 | 11-01-PLAN.md | Workflow engine supports sequential phases containing sequential or parallel steps | SATISFIED | Parallel activation logic in launch() and tryAdvance() confirmed in both plans and codebase; `phaseHasParallel` + `nextPhaseHasParallel` guards verified |
| WF-08 | 11-02-PLAN.md | Workflow instances are deep-copied from templates at launch (template changes don't affect running workflows) | SATISFIED | Backend: `structureSnapshot = JSON.parse(JSON.stringify(input.structure))` at line 79 (pre-existing); Frontend gap closed: `templateStructureToForm()` now correctly reads `step.execution` so template data reaches the form without loss |
| EMAIL-06 | 11-01-PLAN.md | Email templates are localized (EN + FR) | SATISFIED | All 3 notification paths resolve per-user locale; fallback to 'en' for unregistered users; i18n/locales/en and fr directories exist |
| INFRA-05 | 11-01-PLAN.md | Email templates are fully localized in English and French | SATISFIED | Same evidence as EMAIL-06; locale resolution fixes the runtime gap where hardcoded 'fr' prevented EN delivery |
| AUDIT-02 | 11-02-PLAN.md | Audit trail table enforces INSERT-only at database level (no UPDATE or DELETE) | SATISFIED | Prisma migration with BEFORE UPDATE / BEFORE DELETE triggers containing RAISE EXCEPTION confirmed in migration file |

**Orphaned requirements check:** REQUIREMENTS.md traceability table maps WF-02, WF-08, EMAIL-06, AUDIT-02, INFRA-05 to Phase 11 — all 5 claimed in the plans. No orphaned Phase 11 requirements.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `frontend/src/pages/WorkflowCreatePage.tsx` | 249 | `placeholder={t('wizard.title_placeholder')}` | Info | HTML input placeholder attribute — not a code stub, correctly uses i18n key |

No blocker or warning anti-patterns found. The single Info item is a UI input placeholder string, which is correct behavior (localized via `t()`).

### Human Verification Required

#### 1. Parallel email delivery at launch

**Test:** Create a workflow with a phase containing two or more steps marked as `execution: PARALLEL`. Launch the workflow.
**Expected:** Every validator across all parallel steps receives a notification email with their own unique approve/refuse links, all arriving nearly simultaneously.
**Why human:** Email transport requires a live environment. Code verification confirms the loop over `activeSteps` is correct but cannot exercise the email transport layer.

#### 2. Template loading populates execution mode in UI

**Test:** Open the workflow creation wizard, click "Load Template", select a template that has a step with `execution: PARALLEL`. Inspect the circuit builder.
**Expected:** The loaded step shows "Parallel" execution mode selected — not blank or defaulting to Sequential.
**Why human:** UI rendering requires browser interaction. The code fix (`step.execution` read correctly) is verified but the visual result in the circuit builder cannot be checked programmatically.

#### 3. Audit trail UPDATE rejection at live DB

**Test:** Connect to the PostgreSQL database and run: `UPDATE audit_events SET action = 'TAMPERED' WHERE id = (SELECT id FROM audit_events LIMIT 1);`
**Expected:** PostgreSQL raises: `ERROR: UPDATE operations are not allowed on audit_events table`
**Why human:** Verifier cannot execute live DB queries. Migration SQL is confirmed correct; prior summary states pg_catalog queries showed trigger functions exist — but live enforcement test requires DB access.

### Gaps Summary

No gaps found. All 11 must-haves verified, all 5 requirements satisfied, all key links wired, no blocker anti-patterns.

---

_Verified: 2026-02-19_
_Verifier: Claude (gsd-verifier)_
