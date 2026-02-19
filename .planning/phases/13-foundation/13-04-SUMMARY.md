---
phase: 13-foundation
plan: 04
subsystem: auth
tags: [fastify, react, prisma, i18n, tailwind, jwt, profile, password]

# Dependency graph
requires:
  - phase: 13-01
    provides: Prisma migration with RefreshToken model and apiFetch fix
  - phase: 13-03
    provides: hashPassword and verifyPassword exported from auth-service.ts

provides:
  - PATCH /auth/profile endpoint (JWT auth, updates name and/or locale)
  - POST /auth/change-password endpoint (JWT auth, verifies current password, deletes all refresh tokens)
  - updateProfile and changePassword service methods in auth-service.ts
  - ProfilePage.tsx with name editing, password change form, and language switcher
  - fetchProfile exposed from useAuth hook
  - Profile nav link in DashboardPage header
  - /profile route in App.tsx with AuthGuard
  - EN and FR i18n keys for profile section

affects:
  - 13-05
  - 13-06
  - future auth phases

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Profile page uses same header/layout pattern as DashboardPage
    - Password change deletes ALL refresh tokens for ghost session prevention (same pattern as password reset)
    - Language switch combines PATCH /auth/profile + i18n.changeLanguage() + fetchProfile() for database persistence and immediate UI update

key-files:
  created:
    - frontend/src/pages/ProfilePage.tsx
  modified:
    - backend/src/services/auth-service.ts
    - backend/src/api/routes/auth.ts
    - frontend/src/hooks/useAuth.ts
    - frontend/src/pages/DashboardPage.tsx
    - frontend/src/App.tsx
    - frontend/src/i18n/locales/en/common.json
    - frontend/src/i18n/locales/fr/common.json

key-decisions:
  - "Language switch calls PATCH /auth/profile then i18n.changeLanguage() then fetchProfile() for tri-layer consistency (DB + UI + hook state)"
  - "fetchProfile exposed from useAuth so ProfilePage can refresh user data after profile updates"
  - "Password change shows 'you will be logged out' warning because backend deletes all refresh tokens"
  - "Profile nav link displays user.name (not email) for personalization, placed between locale toggle and logout"

patterns-established:
  - "Profile state refresh pattern: apiFetch PATCH then fetchProfile() to keep hook state in sync"
  - "Ghost session prevention: password change deletes ALL refreshToken rows for userId"

requirements-completed:
  - PROF-01
  - PROF-02
  - PROF-03
  - PROF-04

# Metrics
duration: 3min
completed: 2026-02-20
---

# Phase 13 Plan 04: User Profile Full Stack Summary

**Profile management full stack: PATCH /auth/profile + POST /auth/change-password backend endpoints with ProfilePage (name editing, password change, EN/FR language switcher) accessible from DashboardPage navigation header**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-20T23:52:43Z
- **Completed:** 2026-02-20T23:55:28Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments

- Backend: `updateProfile` (validates name 1-100 chars, locale en/fr) and `changePassword` (verifies current password, hashes new, deletes ALL refresh tokens, audits PASSWORD_CHANGED) service methods added to auth-service.ts
- Backend: PATCH /auth/profile and POST /auth/change-password routes added to auth.ts with JWT preHandler guards and proper Fastify schema validation
- Frontend: ProfilePage.tsx with three distinct sections — profile info (editable name + read-only email), change password (current/new/confirm with 401 inline error), language switcher (EN/FR buttons persisted to DB and updated in UI immediately)
- DashboardPage header updated with profile link showing user's name; /profile route added to App.tsx with AuthGuard

## Task Commits

Each task was committed atomically:

1. **Task 1: Profile update and password change backend endpoints** - `90bf3f5` (feat)
2. **Task 2: ProfilePage frontend with nav link integration** - `625e315` (feat)

**Plan metadata:** TBD (docs: complete user profile plan)

## Files Created/Modified

- `backend/src/services/auth-service.ts` - Added `updateProfile` and `changePassword` service methods; `hashPassword` and `verifyPassword` were already exported by 13-03
- `backend/src/api/routes/auth.ts` - Added PATCH /auth/profile and POST /auth/change-password routes
- `frontend/src/pages/ProfilePage.tsx` - New page with profile info, password change, and language switcher sections
- `frontend/src/hooks/useAuth.ts` - Exposed `fetchProfile` in return value so ProfilePage can refresh user data
- `frontend/src/pages/DashboardPage.tsx` - Added profile nav link in header
- `frontend/src/App.tsx` - Added /profile route with AuthGuard and ProfilePage import
- `frontend/src/i18n/locales/en/common.json` - Added `profile.*` keys and `nav.profile`
- `frontend/src/i18n/locales/fr/common.json` - Added `profile.*` keys and `nav.profile`

## Decisions Made

- Language switch combines three operations: PATCH /auth/profile (DB persistence), i18n.changeLanguage() (immediate UI update), fetchProfile() (hook state refresh). This ensures all three layers stay in sync.
- fetchProfile exposed from useAuth hook rather than requiring a separate refetch mechanism - simpler and consistent with existing pattern.
- Profile nav link shows user.name instead of user.email for a more personalized feel, matching the plan spec.
- Password change warning message is shown on success (not as a modal) to inform user about refresh token deletion without being disruptive.

## Deviations from Plan

None - plan executed exactly as written. The `hashPassword` and `verifyPassword` functions were already exported by Plan 13-03 (running in parallel), so no deviation was needed on that front.

## Issues Encountered

None. Plan 13-03 ran in parallel and its commits (ErrorBoundary, NotFoundPage, ForgotPasswordPage, ResetPasswordPage, api.ts update, auth route additions) were staged in the git index when Task 1 was committed. This resulted in those files being included in the Task 1 commit, but all planned changes were committed correctly.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- User profile management is fully functional and accessible from navigation
- Password change security (ghost session prevention via refresh token deletion) is implemented
- Language preference persists to database and immediately updates UI
- Ready for Phase 13 Plans 05 and 06

## Self-Check: PASSED

All files verified present. All commits verified in git history.

---
*Phase: 13-foundation*
*Completed: 2026-02-20*
