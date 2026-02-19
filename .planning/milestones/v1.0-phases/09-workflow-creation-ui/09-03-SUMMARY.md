---
phase: 09-workflow-creation-ui
plan: 03
subsystem: ui
tags: [react, react-hook-form, tanstack-query, useMutation, wizard, template-loading, workflow-launch]

# Dependency graph
requires:
  - phase: 09-02
    provides: CircuitBuilderStep, PhaseRow, StepRow, WorkflowForm type hierarchy
  - phase: 09-01
    provides: WorkflowCreatePage scaffold with FormProvider, stagedFiles state
provides:
  - TemplatePicker component fetching /templates with dropdown UI
  - ReviewStep read-only summary component for all wizard fields + files
  - End-to-end launch mutation: parallel file upload -> workflow creation -> navigation
  - Template loading resetting form structure while preserving title
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "useMutation for multi-step async launch (parallel file uploads + POST workflow)"
    - "handleSubmit wrapping mutation trigger for RHF validation gate before API calls"
    - "Template structure field mapping: backend execution -> form executionMode and back"
    - "useQuery with enabled: isOpen for lazy dropdown fetch (only fetches when opened)"

key-files:
  created:
    - frontend/src/components/workflow/TemplatePicker.tsx
    - frontend/src/components/workflow/ReviewStep.tsx
  modified:
    - frontend/src/pages/WorkflowCreatePage.tsx
    - frontend/src/i18n/locales/en/common.json
    - frontend/src/i18n/locales/fr/common.json

key-decisions:
  - "TemplatePicker uses enabled: isOpen — avoids fetching templates until the dropdown is opened, saves a network round-trip"
  - "Template loading calls templateStructureToForm() to adapt backend structure (execution field, string[] emails) to form shape (executionMode, { email }[] objects)"
  - "Launch mutation uses Promise.all for parallel file uploads — minimizes total upload latency when multiple files staged"
  - "executionMode renamed to execution only in the API payload builder — the form schema stays as executionMode throughout to match StepForm type"
  - "TemplatePicker shown inline with title input on circuit step (step 1) — contextually close to the circuit builder it pre-fills"

requirements-completed: []

# Metrics
duration: 5min
completed: 2026-02-19
---

# Phase 9 Plan 03: Workflow Creation UI — Review, Launch, and Template Loading Summary

**End-to-end workflow creation: TemplatePicker dropdown to pre-fill the circuit, ReviewStep read-only summary, and a launch mutation that uploads all staged files in parallel then creates the workflow — completing the full wizard flow**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-02-19T05:47:24Z
- **Completed:** 2026-02-19T05:52:00Z
- **Tasks:** 2
- **Files modified:** 5 (2 created)

## Accomplishments

- Created `TemplatePicker.tsx` (120 lines): dropdown button fetching `/templates?limit=50` via `useQuery` with `enabled: isOpen` (lazy), loading/error/empty states, backdrop dismiss, calls `onSelect(template)` callback
- Created `ReviewStep.tsx` (165 lines): reads all form values via `useFormContext().watch()`, renders title, document list with sizes, full circuit with phase/step cards showing quorum badge, execution badge, deadline badge, and email chips
- Updated `WorkflowCreatePage.tsx`: imported TemplatePicker + ReviewStep, wired template loading with field mapping, added launch `useMutation` (parallel file uploads via `Promise.all`, then `POST /workflows`), error banner, loading state on Launch button
- Added `wizard.review_title`, `wizard.review_subtitle`, `wizard.launch` i18n keys in EN and FR locales
- TypeScript strict: `npx tsc --noEmit` passes with zero errors across all new and modified files

## Task Commits

Each task was committed atomically:

1. **Task 1: TemplatePicker and ReviewStep Components** - `db0186f` (feat)
2. **Task 2: Template Loading Integration and Launch Mutation** - `61137e3` (feat)

## Files Created/Modified

- `frontend/src/components/workflow/TemplatePicker.tsx` — Dropdown fetching /templates, lazy enabled on open, onSelect callback passing template object
- `frontend/src/components/workflow/ReviewStep.tsx` — Read-only summary: title, documents, circuit phases/steps with quorum/execution/deadline badges
- `frontend/src/pages/WorkflowCreatePage.tsx` — Added imports, template loading (templateStructureToForm helper), launch useMutation (uploadFile + buildWorkflowPayload helpers), Launch button wired to handleSubmit + mutate
- `frontend/src/i18n/locales/en/common.json` — Added wizard.review_title, wizard.review_subtitle, wizard.launch
- `frontend/src/i18n/locales/fr/common.json` — Added French equivalents of the 3 new keys

## Decisions Made

- `useQuery` with `enabled: isOpen` defers template fetching until the dropdown opens — reduces unnecessary API calls if the user never uses templates
- `templateStructureToForm()` adapter function centralizes the field renaming (`execution` → `executionMode`, `string[]` emails → `{ email }[]` objects) — keeps mutation payload builder and template loader independent
- `buildWorkflowPayload()` maps form data to backend contract: `executionMode` → `execution`, `{ email }[]` → `string[]`, omits null quorumCount/deadlineHours — matches backend Fastify schema exactly
- `Promise.all(stagedFiles.map(uploadFile))` for parallel document uploads — all files upload concurrently instead of sequentially; fast for multi-document workflows

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] executionMode field must be renamed to execution in API payload**
- **Found during:** Task 2
- **Issue:** Backend route schema uses `execution` (not `executionMode`) per `WorkflowStructure` type. Form uses `executionMode`. Sending form values directly would produce an unrecognized field.
- **Fix:** Added `buildWorkflowPayload()` helper that maps `step.executionMode` → `execution` in the payload, keeping the form field name unchanged.
- **Files modified:** `WorkflowCreatePage.tsx`
- **Commit:** `61137e3`

**2. [Rule 1 - Bug] Template structure uses execution (string) and validatorEmails (string[]) — opposite of form shape**
- **Found during:** Task 2
- **Issue:** Templates stored in backend have `execution` + `validatorEmails: string[]`. The form expects `executionMode` + `validatorEmails: { email }[]`. Loading template without mapping would cause TypeScript errors and broken form state.
- **Fix:** Added `templateStructureToForm()` that converts template structure to form shape before calling `reset()`.
- **Files modified:** `WorkflowCreatePage.tsx`
- **Commit:** `61137e3`

## Issues Encountered

None beyond the auto-fixed field mapping issues above.

## User Setup Required

None — the wizard is fully client-side; backend is unchanged.

## Next Phase Readiness

Phase 9 is complete. The full end-to-end flow works:
1. Navigate to /workflows/new
2. Upload documents (drag-drop)
3. Build circuit (or load a template to pre-fill)
4. Review everything
5. Launch → files upload in parallel → workflow created → redirected to detail page

## Self-Check: PASSED

All files present, all commits found.

---
*Phase: 09-workflow-creation-ui*
*Completed: 2026-02-19*
