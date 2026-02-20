---
phase: 13-foundation
plan: "03"
subsystem: auth
tags: [password-reset, crypto, csprng, sha256, toctou, fastify, react, i18n]

# Dependency graph
requires:
  - phase: 13-01
    provides: PasswordResetToken Prisma model, apiFetch fix
  - phase: 13-02
    provides: auth-service.ts with updateProfile/changePassword (executed in parallel)
provides:
  - TOCTOU-safe password reset service with atomic updateMany token consumption
  - POST /auth/forgot-password route (anti-enumeration, always returns 200)
  - POST /auth/reset-password route (ghost session invalidation)
  - sendPasswordReset email template (EN/FR inline)
  - ForgotPasswordPage.tsx: email form with success state
  - ResetPasswordPage.tsx: token-from-URL reset form with expired/success states
  - LoginPage forgot-password link
  - auth.forgot_* and auth.reset_* i18n keys (EN/FR)
affects:
  - 13-04
  - 13-05
  - 14-auth
  - any phase touching auth flows

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "CSPRNG token: randomBytes(32).toString('hex') - raw token sent to user, SHA-256 hash stored"
    - "Atomic token consumption: updateMany WHERE usedAt IS NULL AND expiresAt > now (TOCTOU-safe)"
    - "Anti-enumeration: same 200 response regardless of email existence"
    - "Session invalidation: deleteMany refreshTokens on password reset"
    - "hashPassword/verifyPassword exported from auth-service.ts for reuse"

key-files:
  created:
    - backend/src/services/password-reset-service.ts
    - frontend/src/pages/ForgotPasswordPage.tsx
    - frontend/src/pages/ResetPasswordPage.tsx
  modified:
    - backend/src/services/auth-service.ts
    - backend/src/services/email-service.ts
    - backend/src/api/routes/auth.ts
    - frontend/src/pages/LoginPage.tsx
    - frontend/src/i18n/locales/en/common.json
    - frontend/src/i18n/locales/fr/common.json

key-decisions:
  - "Atomic token consumption via updateMany (not findUnique + update) prevents TOCTOU race conditions"
  - "hashPassword and verifyPassword exported from auth-service.ts (not duplicated) for reuse in password-reset-service.ts"
  - "Same 200 response for /auth/forgot-password regardless of email existence (AUTH-04 anti-enumeration)"
  - "All refresh tokens deleted on password reset to prevent ghost sessions (AUTH-03)"
  - "reply.status(400 as any) cast needed because Fastify schema only declares 200 response type"

patterns-established:
  - "Password reset tokens: store only SHA-256 hash, send raw token in URL"
  - "Token expiry: 1 hour for password reset (vs 48h for action tokens)"
  - "ForgotPasswordPage/ResetPasswordPage follow LoginPage visual pattern (bg-gray-50, max-w-md card)"

requirements-completed: [AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05]

# Metrics
duration: 3min
completed: 2026-02-20
---

# Phase 13 Plan 03: Password Reset Full Stack Summary

**CSPRNG + SHA-256 password reset with atomic updateMany consumption, anti-enumeration 200 responses, ghost-session-proof refresh token deletion, and matching React pages**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-19T23:52:35Z
- **Completed:** 2026-02-20T00:00:00Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Backend password reset service with TOCTOU-safe token consumption (updateMany WHERE usedAt IS NULL)
- Fastify routes POST /auth/forgot-password and POST /auth/reset-password with correct auth/anti-enumeration behavior
- sendPasswordReset email template in email-service.ts (EN/FR inline, following existing patterns)
- ForgotPasswordPage.tsx and ResetPasswordPage.tsx matching LoginPage visual style exactly
- LoginPage now has Forgot password? link below password field
- All i18n keys added to EN and FR locale files (auth.forgot_* and auth.reset_* namespaces)

## Task Commits

Each task was committed atomically:

1. **Task 1: Password reset backend service, routes, and email template** - `793c9e8` (feat)
2. **Task 2: Forgot and reset password frontend pages with i18n** - `e23dd34` (feat)

**Plan metadata:** (committed after SUMMARY.md creation)

## Files Created/Modified
- `backend/src/services/password-reset-service.ts` - CSPRNG token gen, SHA-256 hash, atomic updateMany, session invalidation
- `backend/src/services/auth-service.ts` - Exported hashPassword and verifyPassword functions
- `backend/src/services/email-service.ts` - Added sendPasswordReset method with PasswordResetEmailInput interface
- `backend/src/api/routes/auth.ts` - Added POST /auth/forgot-password and POST /auth/reset-password routes
- `frontend/src/pages/ForgotPasswordPage.tsx` - Email form, success state, back-to-login link
- `frontend/src/pages/ResetPasswordPage.tsx` - Token from URL, two password fields, success/expired/error states
- `frontend/src/pages/LoginPage.tsx` - Added forgot-password link in password field header
- `frontend/src/i18n/locales/en/common.json` - auth.forgot_* and auth.reset_* keys (already in 13-04)
- `frontend/src/i18n/locales/fr/common.json` - French equivalents (already in 13-04)

## Decisions Made
- Atomic token consumption via `updateMany` (not `findUnique` + `update`) prevents TOCTOU race conditions — a concurrent request gets count=0 and fails safely
- `hashPassword` and `verifyPassword` exported from auth-service.ts rather than duplicated in password-reset-service.ts
- Same 200 response for `/auth/forgot-password` regardless of email existence (AUTH-04 anti-enumeration)
- All refresh tokens deleted on password reset to prevent ghost sessions (AUTH-03)
- `reply.status(400 as any)` cast required because Fastify's TypeScript schema inference only allows declared response codes; pattern matches existing usage in auth routes

## Deviations from Plan

**1. [Rule 1 - Bug] TypeScript type error with reply.status(400)**
- **Found during:** Task 1 (after TypeScript compilation check)
- **Issue:** `reply.status(400).send(...)` rejected by TypeScript because the route schema only declares `200` response, making `400` not assignable
- **Fix:** Added `as any` cast: `reply.status(400 as any).send(...)` — matching the existing pattern in other route handlers (e.g., `reply.status(err.statusCode as any)`)
- **Files modified:** backend/src/api/routes/auth.ts
- **Verification:** `npx tsc --noEmit` passes cleanly
- **Committed in:** 793c9e8 (Task 1 commit)

**2. [Context] Plans 13-02 and 13-04 were already executed**
- auth-service.ts already had updateProfile/changePassword methods
- auth.ts already had PATCH /auth/profile and POST /auth/change-password routes
- App.tsx and i18n locale files were already updated with forgot-password/reset-password routes and keys by plan 13-04
- Impact: The i18n key additions and App.tsx route additions were already committed; plan 13-03's changes added on top cleanly

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** The TypeScript cast is a minor correctness fix matching existing codebase patterns. No scope creep.

## Issues Encountered
- Plans 13-02 and 13-04 were executed out of plan order (before 13-03), meaning App.tsx already had the routes and i18n files already had the keys. The plan's Task 2 files (ForgotPasswordPage.tsx, ResetPasswordPage.tsx, LoginPage.tsx update) were still created fresh without conflict.

## User Setup Required
None - no external service configuration required. SMTP for email delivery was already configured in Phase 1.

## Next Phase Readiness
- Full password reset flow is complete (request → email → set new password → sessions invalidated)
- AUTH-01 through AUTH-05 requirements satisfied
- Foundation for 13-05 notifications and 13-06 DOCX preview is in place

## Self-Check: PASSED

All files confirmed present:
- backend/src/services/password-reset-service.ts - FOUND
- backend/src/services/auth-service.ts - FOUND
- backend/src/services/email-service.ts - FOUND
- backend/src/api/routes/auth.ts - FOUND
- frontend/src/pages/ForgotPasswordPage.tsx - FOUND
- frontend/src/pages/ResetPasswordPage.tsx - FOUND
- .planning/phases/13-foundation/13-03-SUMMARY.md - FOUND

Commits confirmed:
- 793c9e8: feat(13-03): password reset backend service, routes, and email template - FOUND
- e23dd34: feat(13-03): forgot and reset password frontend pages with i18n - FOUND

---
*Phase: 13-foundation*
*Completed: 2026-02-20*
