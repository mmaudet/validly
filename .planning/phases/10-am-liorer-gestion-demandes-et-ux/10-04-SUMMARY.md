---
phase: 10-am-liorer-gestion-demandes-et-ux
plan: "04"
subsystem: ui
tags: [react, react-pdf, tanstack-query, tailwind, i18n, workflow, pdfjs]

requires:
  - phase: 10-02
    provides: PATCH /workflows/:id/cancel, POST /workflows/:id/notify endpoints
  - phase: 10-01
    provides: workflow data model with phases/steps/actions/quorumRule/deadline fields

provides:
  - WorkflowStepper component: horizontal stepper with status-colored circles and connector lines
  - StepDetail component: step cards with quorum, execution mode, deadline, validators, action history
  - DocumentPreview component: inline PDF via react-pdf, image blob URL, download link for all types
  - ConfirmDialog component: reusable danger/default modal with overlay click-to-dismiss
  - WorkflowDetailPage: fully enriched with stepper + step detail + documents accordion + initiator actions

affects:
  - 10-05-PLAN (admin users panel — shares ConfirmDialog)
  - Any future plan touching WorkflowDetailPage

tech-stack:
  added:
    - react-pdf 10 (inline PDF rendering via PDF.js worker)
  patterns:
    - pdfjs.GlobalWorkerOptions.workerSrc via new URL(..., import.meta.url) for Vite-compatible worker resolution
    - Accordion document list with expandedDocIds Set state for toggle
    - 2s cooldown on notify button via setTimeout to prevent rapid re-clicks
    - effectivePhaseId pattern: selectedPhaseId ?? auto-derived IN_PROGRESS or last phase
    - Auth-gated actions: isInitiator && isInProgress check before rendering cancel/notify

key-files:
  created:
    - frontend/src/components/workflow/WorkflowStepper.tsx
    - frontend/src/components/workflow/StepDetail.tsx
    - frontend/src/components/workflow/DocumentPreview.tsx
    - frontend/src/components/ui/ConfirmDialog.tsx
  modified:
    - frontend/src/pages/WorkflowDetailPage.tsx
    - frontend/src/i18n/locales/en/common.json
    - frontend/src/i18n/locales/fr/common.json
    - frontend/package.json

key-decisions:
  - "DocumentPreview fetches file with auth header via fetch() then converts to ArrayBuffer — avoids exposing JWT in URL query params"
  - "effectivePhaseId derived from workflow data: auto-selects IN_PROGRESS phase, falls back to last phase — no server round-trip"
  - "Both cancel and notify actions gate-checked client-side (isInitiator && isInProgress) — server enforces same rule"
  - "ConfirmDialog uses fixed overlay with stopPropagation on modal div — click-outside dismisses via overlay onClick"

patterns-established:
  - "ArrayBuffer fetch pattern: fetch with auth header → arrayBuffer() → pass to react-pdf Document or create blob URL for images"
  - "Initiator action restriction pattern: derive isInitiator from user.email === workflow.initiator.email, combine with status check"

requirements-completed:
  - WORKFLOW-STEPPER
  - STEP-DETAIL
  - PDF-PREVIEW
  - INITIATOR-ACTIONS-UI

duration: 3min
completed: "2026-02-19"
---

# Phase 10 Plan 04: Frontend — Enriched Workflow Detail Page Summary

**Horizontal stepper + step detail panel + react-pdf inline preview + cancel/notify initiator actions wired into WorkflowDetailPage**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-19T14:59:21Z
- **Completed:** 2026-02-19T15:02:51Z
- **Tasks:** 2
- **Files modified:** 7 (4 created, 3 modified)

## Accomplishments

- WorkflowStepper: horizontal flex stepper with per-status colors (green/red/blue/gray circles), connector lines color-coded by prev phase status, ring-2 on active, click-to-select via onSelectPhase
- StepDetail: per-step cards showing quorum rule (Unanimity/Majority/Any X of Y), execution mode (Sequential/Parallel), deadline (formatted date or "No deadline"), validator list with acted indicators (checkmark/X/pending dot), full action history (actor + type + comment + date)
- DocumentPreview: fetches file with Bearer auth header, renders PDF inline using react-pdf with all pages, renders images as blob URLs, falls back to download link for other types
- WorkflowDetailPage: auto-selects first IN_PROGRESS phase (or last phase), documents accordion with per-document preview toggle, initiator-only cancel (ConfirmDialog danger variant) and notify (2s cooldown) actions

## Task Commits

1. **Task 1: WorkflowStepper, StepDetail, and detail page wiring** - `ea9f5f4` (feat)
2. **Task 2: DocumentPreview, react-pdf, cancel/notify initiator actions** - `f64789a` (feat)

## Files Created/Modified

- `frontend/src/components/workflow/WorkflowStepper.tsx` - NEW: horizontal stepper with PhaseData props, status colors, active ring, connector lines
- `frontend/src/components/workflow/StepDetail.tsx` - NEW: step detail panel, quorum/execution labels, validator icons, action history cards
- `frontend/src/components/workflow/DocumentPreview.tsx` - NEW: react-pdf Document+Page, image blob URL, download link, auth-gated fetch
- `frontend/src/components/ui/ConfirmDialog.tsx` - NEW: reusable modal (danger/default), overlay dismiss, pure Tailwind
- `frontend/src/pages/WorkflowDetailPage.tsx` - Replaced phases/steps visualization with Stepper+StepDetail, added documents accordion, cancel/notify mutations, auth checks
- `frontend/src/i18n/locales/en/common.json` - Added workflow.stepper_title through notify_success, dialog.cancel/confirm (17 new keys)
- `frontend/src/i18n/locales/fr/common.json` - Added same 17 keys in French
- `frontend/package.json` - Added react-pdf@10

## Decisions Made

- DocumentPreview fetches via fetch() with Authorization header and converts to ArrayBuffer — avoids putting JWT tokens in URLs
- effectivePhaseId auto-derives from phases: picks IN_PROGRESS or falls back to last phase — no extra query needed
- Cancel and notify actions gated client-side on isInitiator && isInProgress — server also enforces these rules
- ConfirmDialog uses stopPropagation on the modal div so clicking the overlay (not the modal) dismisses it

## Deviations from Plan

None — plan executed exactly as written. ConfirmDialog.tsx was already present (created by plan 10-03) and matched the required props exactly.

## Issues Encountered

None. Build passed with zero TypeScript errors on first attempt. react-pdf PDF.js worker resolved correctly via new URL(..., import.meta.url) pattern.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- WorkflowDetailPage fully enriched — initiators get complete tracking, documents preview, and management actions
- ConfirmDialog reusable for admin panel (plan 10-05)
- All 4 requirements (WORKFLOW-STEPPER, STEP-DETAIL, PDF-PREVIEW, INITIATOR-ACTIONS-UI) complete
- No blockers

---
*Phase: 10-am-liorer-gestion-demandes-et-ux*
*Completed: 2026-02-19*
