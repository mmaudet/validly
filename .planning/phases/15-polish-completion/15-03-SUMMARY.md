---
phase: 15-polish-completion
plan: 03
subsystem: ui
tags: [i18n, react-i18next, nodemailer, typescript]

# Dependency graph
requires:
  - phase: 13-v1-1-auth-polish
    provides: Password reset pages (ForgotPasswordPage, ResetPasswordPage), ProfilePage, error pages
  - phase: 14-social-features
    provides: NotificationCenter, CommentThread, notification preferences on ProfilePage

provides:
  - Complete EN/FR frontend translations for all v1.1 surfaces (password reset, profile, errors, notifications, comments, form validation)
  - Backend EN/FR email translations for password reset (6 new keys per locale)
  - Locale-aware sendPasswordReset() using tWithLang for both subject and body

affects: [any future phase adding new UI surfaces or email templates]

# Tech tracking
tech-stack:
  added: []
  patterns: [tWithLang for all email subject and body text (replaces inline ternary), validation namespace for reusable form error messages]

key-files:
  created: []
  modified:
    - frontend/src/i18n/locales/en/common.json
    - frontend/src/i18n/locales/fr/common.json
    - backend/src/i18n/locales/en/common.json
    - backend/src/i18n/locales/fr/common.json
    - backend/src/services/email-service.ts
    - frontend/src/components/workflow/StepDetail.tsx
    - frontend/src/pages/AdminUsersPage.tsx
    - frontend/src/pages/DashboardPage.tsx

key-decisions:
  - "Password reset email uses tWithLang() for both subject and body — establishes v1.1 standard for locale-aware emails (existing templates use inline ternary for body; future templates should use tWithLang)"
  - "nav.notifications added to match nav.profile pattern — enables aria-label i18n on NotificationCenter bell button"
  - "validation namespace added for reusable form error strings, independent of auth.* keys which remain page-specific"

patterns-established:
  - "tWithLang pattern: all email methods should use const t = (key, opts) => tWithLang(locale, key, opts) and call t() for all user-visible strings"
  - "Admin column headers use admin.column_actions key (not template.column_actions which is template-specific)"

requirements-completed: [I18N-01, I18N-02]

# Metrics
duration: 5min
completed: 2026-02-20
---

# Phase 15 Plan 03: i18n Audit and Password Reset Email Summary

**Complete EN/FR i18n for all v1.1 surfaces: validation namespace, admin/quorum column keys, nav.notifications, and locale-aware password reset email via tWithLang**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-20T00:21:35Z
- **Completed:** 2026-02-20T00:25:46Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Added `validation` namespace (5 keys EN/FR) for reusable form error messages across all components
- Added `admin.column_actions`, `workflow.quorum_label`, `nav.notifications` keys EN/FR and replaced hardcoded strings in AdminUsersPage.tsx, DashboardPage.tsx UsersTab, and StepDetail.tsx
- Rewrote `sendPasswordReset()` in email-service.ts to use `tWithLang()` for both subject and body — 6 new password_reset_* keys added to backend EN/FR locale files
- Zero key mismatches between EN and FR in both frontend and backend locale files

## Task Commits

Each task was committed atomically:

1. **Task 1: Audit and complete frontend i18n for all v1.1 surfaces** - `df17ff9` (feat)
2. **Task 2: Add password reset email template with FR/EN support** - `48ee47e` (feat)

**Plan metadata:** (pending docs commit)

## Files Created/Modified
- `frontend/src/i18n/locales/en/common.json` - Added nav.notifications, workflow.quorum_label, admin.column_actions, validation namespace (5 keys)
- `frontend/src/i18n/locales/fr/common.json` - Same additions in French
- `backend/src/i18n/locales/en/common.json` - Added 6 password_reset_* email keys
- `backend/src/i18n/locales/fr/common.json` - Same additions in French
- `backend/src/services/email-service.ts` - Rewrote sendPasswordReset() to use tWithLang() for subject and all body text
- `frontend/src/components/workflow/StepDetail.tsx` - Replace hardcoded 'Quorum' with t('workflow.quorum_label')
- `frontend/src/pages/AdminUsersPage.tsx` - Replace hardcoded 'Actions' with t('admin.column_actions')
- `frontend/src/pages/DashboardPage.tsx` - Replace hardcoded 'Actions' in UsersTab with t('admin.column_actions')

## Decisions Made
- Used `tWithLang()` for both subject and body in `sendPasswordReset()` — this is the v1.1 standard. Existing `sendPendingAction` and other methods use inline ternary for body text but tWithLang for subjects; future email methods should use tWithLang for all text.
- `nav.notifications` added (even though the NotificationCenter uses `notifications.title` for its heading) to provide an accessible aria-label on the bell button that may differ from the panel title.
- `validation` namespace is additive and does not replace the existing `auth.*` validation keys (those are page-specific error messages from Zod resolvers).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Replaced nonsensical ternary in StepDetail.tsx quorum label**
- **Found during:** Task 1 (frontend i18n audit)
- **Issue:** Line 85: `{t('workflow.quorum_unanimity').startsWith('U') ? 'Quorum' : 'Quorum'}` — both branches return 'Quorum', a dead conditional
- **Fix:** Replaced with `t('workflow.quorum_label')` using new i18n key, cleaned up intent
- **Files modified:** frontend/src/components/workflow/StepDetail.tsx
- **Verification:** Frontend tsc --noEmit passes
- **Committed in:** df17ff9 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug)
**Impact on plan:** Fix necessary for correctness. No scope creep.

## Issues Encountered
- Plans 15-01 and 15-02 had already added `nav.menu` to both EN/FR frontend locale files when this plan ran — detected on read and handled correctly (only added new keys, did not modify existing).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All v1.1 UI surfaces now have complete EN/FR translations with zero key mismatches
- Password reset emails now use proper i18n via tWithLang — consistent with v1.1 email standard
- `validation` namespace available for any future form validation components
- Phase 15 (Polish Completion) is the final phase — no blockers

## Self-Check: PASSED
- `frontend/src/i18n/locales/en/common.json` - EXISTS
- `frontend/src/i18n/locales/fr/common.json` - EXISTS
- `backend/src/i18n/locales/en/common.json` - EXISTS
- `backend/src/i18n/locales/fr/common.json` - EXISTS
- `backend/src/services/email-service.ts` - EXISTS, contains sendPasswordReset with tWithLang
- Commits df17ff9 and 48ee47e - EXIST

---
*Phase: 15-polish-completion*
*Completed: 2026-02-20*
