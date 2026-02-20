# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-20)

**Core value:** Any validator can approve or refuse a document directly from their email, without ever logging into the platform — making validation as frictionless as possible while maintaining a complete audit trail.
**Current focus:** v1.1 UX Polish — Phase 15: Polish Completion

## Current Position

Phase: 15 of 15 (Polish Completion)
Plan: 3 of 3
Status: Complete
Last activity: 2026-02-20 — Plan 15-03 complete: i18n audit and password reset email (tWithLang)

Progress: [██████████] 100% (v1.1)

## Performance Metrics

**v1.0 MVP:**
- 12 phases, 12 plans, 64 commits
- 8,971 LOC TypeScript, 127 files
- 41/41 requirements satisfied
- Timeline: 2026-02-19 to 2026-02-20

**By Phase:**

| Phase | Description | Commit |
|-------|-------------|--------|
| 1 | Foundation | 706d553 |
| 2 | Data Model + Auth | 245e201 |
| 3 | Document Upload + Preview | c2dd671 |
| 4 | Workflow Engine | 8de7690 |
| 5+7 | Email + Templates (parallel) | d2c9f97 |
| 9-01 | Wizard Scaffold + Doc Upload | 1ff9c33 |
| 9-02 | Dynamic Circuit Builder | da21662 |
| 9-03 | Review, Launch, Template Loading | 61137e3 |
| 10-01 | Backend: RBAC, BullMQ, initiator emails | c556ac5 |
| 10-02 | Backend: cancel/notify/token-info/user-CRUD | c87daf7 |
| 10-03 | Frontend: ActionConfirmPage + dashboard | b52e54d |
| 10-04 | Frontend: WorkflowStepper + cancel/notify | f64789a |
| 10-05 | Frontend: AdminUsersPage + ConfirmDialog | ea9f5f4 |
| 11-01 | Parallel activation + locale + ARCHIVED | 7f108f0 |
| 11-02 | Template field fix + audit migration | 89bfce6 |
| 12-01 | TemplateFormPage + routes + i18n | 539ab44 |
| 12-02 | TemplatesTab + DashboardPage CRUD | c04d4f1 |
| 13-01 | Prisma migration + apiFetch fix + npm packages | b4af5d9 |
| 13-02 | DOCX preview via docx-preview + DOMPurify | e35688d |
| Phase 13 P01 | 3 | 2 tasks | 4 files |
| Phase 13 P02 | 2 | 1 task | 1 file |
| Phase 13 P04 | 3 | 2 tasks | 9 files |
| Phase 13 P05 | 4 | 2 tasks | 7 files |
| Phase 13 P03 | 3 | 2 tasks | 8 files |
| Phase 13 P06 | 5 | 2 tasks | 8 files |
| Phase 14 P01 | 2 | 3 tasks | 7 files |
| Phase 14 P02 | 4 | 3 tasks | 8 files |
| Phase 15 P03 | 5 | 2 tasks | 8 files |
| Phase 15 P02 | 3 | 2 tasks | 4 files |
| Phase 15 P01 | 6 | 2 tasks | 5 files |

## Accumulated Context

### Decisions

- Stack: Node.js 22 + TypeScript 5.7 + Fastify 5 + Prisma 6 + PostgreSQL 15 + BullMQ 5 + Redis 7 + React 19 + Vite 6 + Tailwind v4 + TanStack Query 5
- See PROJECT.md Key Decisions table for full list
- [13-01] Notification.type is String (not Prisma enum) to avoid enum migration pitfalls in future phases
- [14-01] Adapted notification-service to Phase 13 Notification schema (readAt DateTime? / metadata Json?) rather than plan's read Boolean / context Json — avoids broken migrations
- [14-01] notificationPrefs Json? on User: null means all types enabled, explicit false disables a type
- [14-01] PATCH /notifications/read-all registered BEFORE /notifications/:id/read to prevent Fastify treating "read-all" as :id param
- [13-01] apiFetch uses body != null (loose equality) to catch both null and undefined in a single check
- [13-01] Resolved Prisma migration checksum drift via prisma db execute UPDATE on _prisma_migrations (avoids data loss from migrate reset)
- [13-02] isDocx constant computed at component level (not inside useEffect) so renderPreview() can use it without prop drilling
- [13-02] ADD_TAGS: ['style'] passed to DOMPurify to preserve docx-preview inline style blocks that provide DOCX formatting
- [13-02] docxHtml reset to null at useEffect start to prevent stale HTML flash when switching documents
- [Phase 13]: [13-04] Language switch: PATCH /auth/profile + i18n.changeLanguage() + fetchProfile() for DB, UI, and hook state sync
- [Phase 13]: [13-04] Password change deletes ALL refresh tokens (ghost session prevention)
- [13-05] FallbackProps from react-error-boundary must be used (not inline type): error is 'unknown', requires instanceof Error guard
- [13-05] mapApiError returns original message as fallback — safe to call everywhere without conditional checks
- [Phase 13]: [13-03] Atomic token consumption via updateMany (not findUnique + update) prevents TOCTOU race conditions on password reset
- [Phase 13]: [13-03] hashPassword/verifyPassword exported from auth-service.ts for reuse in password-reset-service.ts (not duplicated)
- [Phase 13]: [13-03] Same 200 response for /auth/forgot-password regardless of email existence (AUTH-04 anti-enumeration)
- [13-06] Zod v4 + @hookform/resolvers v5: import from 'zod/v3' compat path to satisfy Zod3Type interface (_def.typeName required)
- [13-06] Zod error messages are i18n keys (not translated strings); components call t(errors.field.message!) at render time
- [Phase 14]: readAt === null used throughout frontend for unread checks — matches 14-01 backend schema (readAt DateTime? not read Boolean)
- [Phase 14]: useUnreadCount shares queryKey ['notifications'] with useNotifications — single TanStack cache entry for 30s polling, no duplicate requests
- [Phase 15]: WorkflowStepper keeps horizontal layout (not vertical) — horizontal scrollable stepper is more intuitive for a progress indicator
- [Phase 15]: TemplateFormPage CircuitBuilderStep is tablet-minimum (768px+) by design — complex nested form not suitable for phone-width screens
- [15-03] sendPasswordReset() uses tWithLang() for both subject and body — establishes v1.1 standard (existing templates use inline ternary for body; new templates should use tWithLang)
- [15-03] validation namespace added for reusable form error strings, independent of auth.* page-specific keys
- [Phase 15]: MobileNav is stateless re: auth — receives user/callbacks as props, keeps DashboardPage as single source of truth for auth state
- [Phase 15]: Mobile responsive pattern: sm:hidden for hamburger, hidden sm:flex for desktop items, hidden sm:table-cell for non-essential table columns

### v1.1 Key Constraints (from research)

- Notification.type stored as string column, NOT Prisma enum (avoids migration pitfalls)
- apiFetch Content-Type bug must be fixed first (AUTH-06) — recurring Fastify empty-body issue
- DOCX preview requires DOMPurify sanitization before rendering (XSS prevention)
- Password reset token consumption must be atomic (TOCTOU-safe, AUTH-05)
- Password change must delete all refresh tokens (ghost session prevention)
- Notification delivery via REST polling 30s (TanStack Query refetchInterval), no WebSocket
- New frontend packages: docx-preview, dompurify, react-error-boundary

### Roadmap Evolution

- Phases 1-9 planned in initial roadmap
- Phase 10 added: UX improvements (RBAC, stepper, dashboard redesign)
- Phases 11-12 added: Gap closure from v1.0 audit
- Phases 13-15: v1.1 UX Polish milestone

### Pending Todos

None.

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-02-20
Stopped at: Completed 15-03-PLAN.md — i18n audit and password reset email (tWithLang)
Resume file: None
