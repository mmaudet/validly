---
phase: 09-workflow-creation-ui
plan: 02
subsystem: ui
tags: [react, react-hook-form, useFieldArray, wizard, circuit-builder]

# Dependency graph
requires:
  - phase: 09-01
    provides: WorkflowCreatePage with wizard scaffold, FormProvider wrapping, WorkflowForm type
provides:
  - CircuitBuilderStep component with outer useFieldArray for structure.phases
  - PhaseRow component with inner useFieldArray for steps within a phase
  - StepRow component with all step fields and conditional quorumCount input
  - Circuit step wired into wizard (step 1) replacing placeholder
affects: [09-03-review-launch]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Nested useFieldArray: outer for phases in CircuitBuilderStep, inner for steps in PhaseRow"
    - "Separate components per useFieldArray level (Rules of Hooks)"
    - "validatorEmails as { email: string }[] object array for useFieldArray compatibility"
    - "watch() for conditional quorumCount input visibility (ANY_OF rule only)"

key-files:
  created:
    - frontend/src/components/workflow/CircuitBuilderStep.tsx
    - frontend/src/components/workflow/PhaseRow.tsx
    - frontend/src/components/workflow/StepRow.tsx
  modified:
    - frontend/src/pages/WorkflowCreatePage.tsx

key-decisions:
  - "validatorEmails stored as { email: string }[] not string[] — react-hook-form useFieldArray requires objects, not primitives"
  - "StepForm quorumRule uses UNANIMITY/MAJORITY/ANY_OF (matching backend enum) instead of original ALL/ONE/MAJORITY from Plan 01 placeholder types"
  - "basePath typed as const template literal string to satisfy react-hook-form strict path inference"

patterns-established:
  - "Three-component pattern for nested field arrays: outer list (CircuitBuilderStep) -> row (PhaseRow) -> leaf (StepRow)"

requirements-completed: []

# Metrics
duration: 3min
completed: 2026-02-19
---

# Phase 9 Plan 02: Workflow Creation UI — Dynamic Circuit Builder Summary

**Nested dynamic form for validation circuits: phases with steps, each configurable with quorum rules, validator emails, execution mode, and optional deadlines — wired into the wizard as step 1**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-02-19T05:41:47Z
- **Completed:** 2026-02-19T05:44:44Z
- **Tasks:** 2
- **Files modified:** 4 (3 created)

## Accomplishments

- Created CircuitBuilderStep.tsx: outer `useFieldArray({ name: 'structure.phases' })`, renders PhaseRow list, "Add Phase" button, disables remove when 1 phase
- Created PhaseRow.tsx: inner `useFieldArray({ name: \`structure.phases.${index}.steps\` })`, phase name input, maps to StepRow list, "Add Step" / "Remove Phase" buttons
- Created StepRow.tsx: step name (required), executionMode select (SEQUENTIAL/PARALLEL), quorumRule select (UNANIMITY/MAJORITY/ANY_OF), quorumCount input conditional on watch() for ANY_OF, validator email array with add/remove (useFieldArray on validatorEmails), deadlineHours optional input
- Updated WorkflowCreatePage.tsx: exported types (WorkflowForm, PhaseForm, StepForm, ValidatorEmailEntry), updated form structure to `structure.phases`, replaced circuit placeholder div with `<CircuitBuilderStep />`

## Task Commits

Each task was committed atomically:

1. **Task 1: CircuitBuilderStep and PhaseRow Components** - `04353b7` (feat)
2. **Task 2: StepRow Component and Wizard Integration** - `da21662` (feat)

**Plan metadata:** `(pending — docs commit below)`

## Files Created/Modified

- `frontend/src/components/workflow/CircuitBuilderStep.tsx` — Outer useFieldArray for phases, Add Phase button, delegates to PhaseRow
- `frontend/src/components/workflow/PhaseRow.tsx` — Inner useFieldArray for steps, phase name input, Add Step / Remove Phase buttons
- `frontend/src/components/workflow/StepRow.tsx` — All step fields: name, executionMode, quorumRule, conditional quorumCount (ANY_OF), validator emails array (objects), deadlineHours
- `frontend/src/pages/WorkflowCreatePage.tsx` — Exported types, structure.phases form shape, CircuitBuilderStep replacing placeholder

## Decisions Made

- `validatorEmails` is `{ email: string }[]` (not `string[]`) because react-hook-form `useFieldArray` requires objects; primitives cannot be tracked by id
- Quorum rule values changed from the Plan 01 placeholder `ALL/ONE/MAJORITY` to `UNANIMITY/MAJORITY/ANY_OF` to match the backend engine's actual enum values
- Each useFieldArray level is a separate React component to comply with Rules of Hooks (hooks cannot be called inside loops)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] validatorEmails changed from string[] to { email: string }[]**
- **Found during:** Task 2
- **Issue:** `useFieldArray` requires array items to be objects (not primitives) — TypeScript error TS2322 and TS2345 when trying to use `string[]` with useFieldArray and `appendEmail('')`
- **Fix:** Added `ValidatorEmailEntry` interface `{ email: string }`, updated all default values and append calls to use objects, registered `validatorEmails.${i}.email` path
- **Files modified:** WorkflowCreatePage.tsx, CircuitBuilderStep.tsx, PhaseRow.tsx, StepRow.tsx
- **Commit:** included in `da21662`

## Issues Encountered

None beyond the auto-fixed type issue above.

## User Setup Required

None.

## Next Phase Readiness

- CircuitBuilderStep fully wired into wizard step 1
- WorkflowForm type now includes `structure.phases[].steps[]` with all step fields
- Plan 03 (Review/Launch) can read form values via `getValues()` and submit to backend
- `validatorEmails` collected as `{ email: string }[]` — Plan 03 will map to `email` strings when building API payload

## Self-Check: PASSED

All files present, all commits found.

---
*Phase: 09-workflow-creation-ui*
*Completed: 2026-02-19*
