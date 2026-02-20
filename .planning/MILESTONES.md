# Milestones

## v1.0 MVP (Shipped: 2026-02-20)

**Phases completed:** 12 phases, 12 plans, 64 commits
**Lines of code:** 8,971 TypeScript (127 files, 27,001 insertions)
**Timeline:** 2026-02-19 to 2026-02-20
**Requirements:** 41/41 satisfied

**Key accomplishments:**
- Full-stack document validation platform with Fastify 5 API + React 19 SPA and complete FR/EN localization
- Workflow engine with state machine: sequential/parallel phases, quorum rules (unanimity/majority/any-of), refusal routing, deadline scheduling
- Email action channel: validators approve/refuse directly from email via secure one-time token links, no login required
- Dashboard with dual views: initiator submissions table with filters/search/archive + validator pending actions + workflow stepper visualization
- Template management: create, edit, delete reusable workflow templates with structured circuit builder form
- Multi-step creation wizard: document upload with drag-drop, dynamic circuit builder, template loading, review and launch
- Admin user management with 3-role RBAC (Admin/Initiateur/Validateur)
- Immutable audit trail with PostgreSQL triggers enforcing INSERT-only on audit events + CSV export

---

## v1.1 UX Polish (Shipped: 2026-02-20)

**Phases completed:** 4 phases, 12 plans, 50 commits
**Lines of code:** 11,432 TypeScript (+10,489 / -1,335 over v1.0)
**Timeline:** 2026-02-20
**Requirements:** 39/39 satisfied
**Audit:** passed (39/39 requirements, 7/7 E2E flows)

**Key accomplishments:**
- Password reset with TOCTOU-safe atomic token consumption, anti-enumeration response, and session invalidation
- User profile page: edit display name, change password (ghost session prevention), switch language (EN/FR persisted to DB)
- In-app notification center with bell icon badge (30s polling), notification panel, mark read, and per-type preference toggles
- Workflow comment thread: chronological plain-text comments below stepper, append-only audit-consistent, disabled on terminal states
- DOCX in-browser preview via docx-preview + DOMPurify sanitization (XSS-safe, dynamic import)
- Mobile-responsive layout: hamburger navigation on all 5 authenticated pages, 375px+ support, 44px touch targets
- Error handling: 404/500 pages, React error boundary, Zod form validation with i18n, mapApiError wiring for translated API errors
- Complete FR/EN i18n on all new v1.1 surfaces and password reset email template (tWithLang pattern)

---
