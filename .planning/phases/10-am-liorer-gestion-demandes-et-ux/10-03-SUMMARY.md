---
phase: 10-am-liorer-gestion-demandes-et-ux
plan: "03"
subsystem: ui
tags: [react, tanstack-query, tailwind, i18n, dashboard, filters]

requires:
  - phase: 10-am-liorer-gestion-demandes-et-ux
    provides: GET /actions/:token/info, GET /workflows, GET /workflows/pending, PATCH /workflows/:id/cancel, POST /workflows/:id/notify

provides:
  - ActionConfirmPage with workflow summary (title, documents, step, phase, initiator) fetched before form
  - ActionErrorPage with dashboard navigation link
  - fetchActionInfo() API helper for public token info endpoint
  - DashboardPage with table view, column sorting, comprehensive filters on both tabs
  - Notification bell icon in header with pending count badge
  - A valider tab with numeric badge showing pending count
  - action.* and status.* i18n keys in EN and FR
  - dashboard.my_requests/to_validate/filter_*/column_* i18n keys

affects:
  - 10-04-PLAN (action flow frontend — may reuse ActionConfirmPage patterns)
  - 10-05-PLAN (admin panel — DashboardPage nav bar already has admin link)

tech-stack:
  added: []
  patterns:
    - useQuery with enabled:!!token for conditional fetching on ActionConfirmPage
    - useMemo for client-side filtering/sorting (status, search, dateFrom, dateTo, initiator)
    - Controlled filter state object (Filters interface) reset on tab switch
    - StatusBadge component using STATUS_BADGE_COLORS record for consistent coloring
    - SortHeader component with active indicator and toggle direction

key-files:
  created: []
  modified:
    - frontend/src/lib/api.ts
    - frontend/src/pages/ActionConfirmPage.tsx
    - frontend/src/pages/ActionErrorPage.tsx
    - frontend/src/pages/DashboardPage.tsx
    - frontend/src/i18n/locales/en/common.json
    - frontend/src/i18n/locales/fr/common.json

key-decisions:
  - "Comment kept required for both approve and refuse (locked decision per plan)"
  - "Inline error display on ActionConfirmPage when token is expired/invalid (no redirect — shows summary inline)"
  - "Dashboard rows use window.location.href for navigation (not Link) since they are tr elements"
  - "pendingCount sourced from pendingQuery.data.total (same source for both bell and tab badge)"
  - "Status i18n uses status.* namespace not workflow.* for consistency with dashboard filters"

patterns-established:
  - "Filters interface with DEFAULT_FILTERS const for clean reset pattern"
  - "FilterBar component accepts showStatus/showInitiator props for tab-specific filter sets"
  - "Loading skeleton in ActionConfirmPage using animate-pulse gray blocks"

requirements-completed:
  - ACTION-CONFIRM-SUMMARY
  - DASHBOARD-TABLE-FILTERS
  - DASHBOARD-BADGES

duration: 5min
completed: 2026-02-19
---

# Phase 10 Plan 03: Frontend UX — Enriched Action Confirmation and Table Dashboard Summary

**TanStack Query workflow summary fetch on ActionConfirmPage, and full DashboardPage overhaul with sortable table, client-side filters (status/search/date/initiator), numeric badges on tab and bell icon**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-02-19T14:59:17Z
- **Completed:** 2026-02-19T15:04:00Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- ActionConfirmPage now fetches workflow context via `GET /api/actions/:token/info` and displays title, documents, step/phase name, and initiator before the comment form — validators see full context before deciding
- ActionErrorPage has a "Go to dashboard" link for expired/invalid/used token error states
- DashboardPage replaces card layout with sortable HTML table, status/date/text/initiator filters via useMemo, and numeric notification badges on the A valider tab and header bell icon
- All new strings are i18n-ized in both EN (English) and FR (French)

## Task Commits

Each task was committed atomically:

1. **Task 1: Enrich ActionConfirmPage with workflow summary and fix error pages** - `b52e54d` (feat)
2. **Task 2: Dashboard table view with filters, sorting, tabs, and notification badges** - `617f2aa` (feat)

**Plan metadata:** (to be added after SUMMARY commit)

## Files Created/Modified

- `frontend/src/lib/api.ts` - Added fetchActionInfo() for public GET /api/actions/:token/info (returns ActionInfo | ActionInfoError)
- `frontend/src/pages/ActionConfirmPage.tsx` - Rewrote: useQuery for token info, loading skeleton, workflow summary display (title/docs/step/phase/initiator), inline token error, required comment form
- `frontend/src/pages/ActionErrorPage.tsx` - Added Go to dashboard Link using action.go_to_dashboard i18n key
- `frontend/src/pages/DashboardPage.tsx` - Full overhaul: table view, FilterBar component, SortHeader component, StatusBadge component, useMemo filtering/sorting, tab badges, bell icon
- `frontend/src/i18n/locales/en/common.json` - Added action.*, status.*, and dashboard filter/column/tab keys
- `frontend/src/i18n/locales/fr/common.json` - Added same keys in French

## Decisions Made

- Comment is required for both approve and refuse (locked decision maintained from original design)
- Token error displayed inline on ActionConfirmPage (not a redirect) — consistent with plan instruction to show inline success
- `window.location.href` used for table row navigation since `<tr>` elements can't be `<Link>` components without breaking semantic HTML
- Pending count sourced from `pendingQuery.data?.total` — both the bell icon and tab badge use the same value for consistency
- Status i18n keys placed in `status.*` namespace (not `workflow.*`) for clarity and to support the dashboard filter labels

## Deviations from Plan

### Auto-fixed Issues

None for this plan's own files. However, concurrent plans (10-04, 10-05) had already added `ConfirmDialog`, `DocumentPreview`, `WorkflowStepper`, and `StepDetail` components by the time Task 1 ran its first build check. The `WorkflowDetailPage.tsx` was importing those components, and they appeared in the directory at build time, so no stub creation was needed. First build attempt did fail due to missing modules, but a retry succeeded after confirming the files existed.

---

**Total deviations:** 0 (plan executed as specified)
**Impact on plan:** No scope creep.

## Issues Encountered

- First build attempt returned TypeScript errors for missing `DocumentPreview` and `ConfirmDialog` imports in `WorkflowDetailPage.tsx`. These were being created by concurrent plan 10-04/10-05 wave execution. A retry of the build (after ~10 seconds) succeeded — the files had been written by the other plan's execution.

## Next Phase Readiness

- Frontend action confirmation and dashboard fully upgraded
- All API endpoints from 10-02 (cancel/notify/token-info/user-CRUD) now have corresponding frontend UI
- 10-04 (action flow) and 10-05 (admin panel) have their i18n keys already present in both locale files

---
*Phase: 10-am-liorer-gestion-demandes-et-ux*
*Completed: 2026-02-19*
