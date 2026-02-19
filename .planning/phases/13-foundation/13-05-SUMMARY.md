---
phase: 13-foundation
plan: "05"
subsystem: ui, infra
tags: [react, error-boundary, react-error-boundary, i18n, routing, typescript]

# Dependency graph
requires:
  - phase: 13-01
    provides: "react-error-boundary npm package installed"
provides:
  - "NotFoundPage: 404 page with dashboard link, matches ActionErrorPage visual style"
  - "ErrorPage: 500 page with retry + dashboard link, optional error/onReset props, dev-mode error details"
  - "AppErrorBoundary: wraps Routes using react-error-boundary FallbackProps type"
  - "catch-all route path='*' as last route in App.tsx showing NotFoundPage"
  - "mapApiError utility in api.ts mapping known API errors to i18n keys"
  - "EN + FR error translations: not_found_title/message/go_to_dashboard/server_error_title/message/try_again/generic_error/unauthorized"
affects:
  - 13-06 (notifications and other pages share error handling patterns)
  - all future Phase 13 plans (mapApiError available for form error display)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "FallbackProps from react-error-boundary must be used instead of inline type to handle error: unknown (not Error)"
    - "catch-all route path='*' must be the LAST route in the Routes block"
    - "ErrorPage accepts optional error+onReset props; onReset takes priority over window.location.reload()"
    - "mapApiError returns original message if no mapping found — safe to use everywhere"
    - "import.meta.env.DEV gates error stack display (dev mode only)"

key-files:
  created:
    - frontend/src/pages/NotFoundPage.tsx
    - frontend/src/pages/ErrorPage.tsx
    - frontend/src/components/ErrorBoundary.tsx
  modified:
    - frontend/src/App.tsx
    - frontend/src/lib/api.ts
    - frontend/src/i18n/locales/en/common.json
    - frontend/src/i18n/locales/fr/common.json

key-decisions:
  - "Use FallbackProps from react-error-boundary (not inline type): error property is 'unknown' not 'Error' — requires instanceof guard"
  - "mapApiError returns original message as fallback: safe to call everywhere without conditional checks"
  - "ErrorPage onReset prop calls provided handler (from ErrorBoundary resetErrorBoundary) or falls back to window.location.reload()"

patterns-established:
  - "Pattern 1: Error pages follow ActionErrorPage visual style (bg-gray-50, max-w-md, shadow card, centered)"
  - "Pattern 2: AppErrorBoundary navigates to /dashboard on reset (clears React error state)"
  - "Pattern 3: API error map lookup then fallback to original string — no exceptions, always returns displayable text"

requirements-completed:
  - ERR-01
  - ERR-02
  - ERR-03
  - ERR-06

# Metrics
duration: 4min
completed: 2026-02-20
---

# Phase 13 Plan 05: Error Pages Summary

**NotFoundPage (404), ErrorPage (500), AppErrorBoundary (react-error-boundary), catch-all route, and mapApiError utility with EN/FR translations**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-19T23:52:42Z
- **Completed:** 2026-02-20T00:56:00Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- NotFoundPage and ErrorPage created matching ActionErrorPage visual pattern (centered card, gray background, shadow)
- AppErrorBoundary wraps Routes in App.tsx using react-error-boundary; FallbackProps type used correctly to handle `error: unknown`
- Catch-all `path="*"` route added as last route, rendering NotFoundPage for any unmatched URL
- mapApiError utility in api.ts maps 6 known API error messages to i18n keys with safe string fallback
- Full EN and FR translations added to `errors` section of common.json for all new error UI text

## Task Commits

Task artifacts were committed by parallel plans 13-04 and 13-05 as part of coordinated Wave 2 execution:

1. **Task 1: NotFoundPage, ErrorPage, EN/FR error translations** - `90bf3f5` (feat — committed by 13-04 parallel plan)
2. **Task 2: ErrorBoundary, catch-all route, mapApiError** - `625e315` (feat — committed by 13-04 parallel plan)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `frontend/src/pages/NotFoundPage.tsx` - 404 page with "Go to Dashboard" link, 404 badge, blue CTA button
- `frontend/src/pages/ErrorPage.tsx` - 500 page with retry+dashboard buttons, optional error/onReset props, dev-mode stack trace
- `frontend/src/components/ErrorBoundary.tsx` - AppErrorBoundary using ReactErrorBoundary with FallbackProps, renders ErrorPage on catch
- `frontend/src/App.tsx` - Added AppErrorBoundary wrapper, NotFoundPage + AppErrorBoundary imports, catch-all route as last route
- `frontend/src/lib/api.ts` - Added API_ERROR_MAP constant and exported mapApiError function
- `frontend/src/i18n/locales/en/common.json` - Added 8 error keys to existing `errors` section
- `frontend/src/i18n/locales/fr/common.json` - Added 8 error keys (French) to existing `errors` section

## Decisions Made
- Used `FallbackProps` type from react-error-boundary instead of inline type definition: the `error` property is typed as `unknown` (not `Error`), requiring an `instanceof Error` guard before passing to ErrorPage
- mapApiError returns original `message` string as fallback (not an error key or empty string): this ensures the function is always safe to call and always returns something displayable
- ErrorPage `onReset` prop calls the provided handler first (enables ErrorBoundary's resetErrorBoundary to clear React error state), falling back to `window.location.reload()` for standalone use

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed FallbackProps type mismatch in ErrorBoundary**
- **Found during:** Task 2 (Error boundary creation)
- **Issue:** Inline type `{ error: Error; resetErrorBoundary: () => void }` is not assignable to `FallbackProps` because `error` is typed as `unknown` in react-error-boundary
- **Fix:** Import `FallbackProps` from `react-error-boundary`, add `error instanceof Error` guard before passing to ErrorPage
- **Files modified:** `frontend/src/components/ErrorBoundary.tsx`
- **Verification:** TypeScript build passed (`npm run build` succeeded)
- **Committed in:** `625e315` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 type bug)
**Impact on plan:** Fix was required for TypeScript compilation. No scope creep. Behavior is identical.

## Issues Encountered
- Wave 2 parallel execution: Plans 13-03 and 13-04 committed to shared files (App.tsx, api.ts, i18n) concurrently. Plan 13-04 committed our NotFoundPage, ErrorPage, ErrorBoundary, App.tsx changes, api.ts changes, and locale files as part of its own feature commit. All artifacts are present and correct in the codebase. No conflicts or data loss occurred.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Error infrastructure complete: all unmatched routes show 404, unhandled React errors show 500
- mapApiError available for all Phase 13 form components to use for user-friendly error display
- EN and FR error translations ready for all error states
- Frontend build confirmed passing

## Self-Check: PASSED

- FOUND: frontend/src/pages/NotFoundPage.tsx
- FOUND: frontend/src/pages/ErrorPage.tsx
- FOUND: frontend/src/components/ErrorBoundary.tsx
- FOUND: .planning/phases/13-foundation/13-05-SUMMARY.md
- FOUND: commit 90bf3f5 (Task 1 artifacts: NotFoundPage, ErrorPage, i18n)
- FOUND: commit 625e315 (Task 2 artifacts: ErrorBoundary, App.tsx, api.ts)
- Build: PASSED (npm run build succeeded, 178 modules transformed)

---
*Phase: 13-foundation*
*Completed: 2026-02-20*
