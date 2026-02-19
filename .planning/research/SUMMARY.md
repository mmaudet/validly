# Project Research Summary

**Project:** Validly v1.1 UX Polish
**Domain:** Document validation workflow platform — UX polish milestone on established v1.0 codebase
**Researched:** 2026-02-20
**Confidence:** HIGH (architecture from direct codebase inspection; features and pitfalls from official sources)

## Executive Summary

Validly v1.1 is a UX polish milestone layered on a mature v1.0 codebase (Node 22, Fastify 5, Prisma 6, React 19, Tailwind v4, TanStack Query 5). All 7 features in scope are additive — they extend existing pages, services, and DB patterns rather than replacing them. The existing codebase has strong conventions (SHA-256 token hashing in `token-service.ts`, BullMQ for async jobs, TanStack Query for server state, react-hook-form for forms) that must be followed consistently. The primary recommendation is to treat this as a dependency-ordered build: schema migrations unlock backend work, backend APIs unlock frontend pages, and the highest-complexity feature (notification center) must be built last with the most context available.

The recommended technical approach has minimal new dependencies: only `docx-preview` + `dompurify` (DOCX preview with mandatory XSS sanitization) and `react-error-boundary` (error boundaries without class boilerplate) are net-new frontend packages. No new backend libraries are needed. Notification delivery uses REST polling at 30-second intervals via TanStack Query `refetchInterval` — not WebSockets — which matches the domain's async workflow timescales and requires zero new infrastructure. The existing BullMQ/Redis setup handles job queuing; the existing Prisma/PostgreSQL handles all new persistent state.

The main risks are security-related and integration-specific, not architectural. Four pitfalls require non-negotiable prevention: (1) ghost sessions after password change — existing refresh tokens must be deleted on every password change; (2) XSS via DOCX preview — mammoth.js or docx-preview output must always pass through DOMPurify before `dangerouslySetInnerHTML`; (3) TOCTOU race on password reset token consumption — must use atomic `updateMany WHERE usedAt IS NULL`, not read-then-update; (4) the recurring `apiFetch Content-Type` bug — must be fixed once, at the start of v1.1, before any new endpoints are added. These are not hypothetical edge cases; three of the four have established precedent in the v1.0 codebase.

## Key Findings

### Recommended Stack

The v1.0 stack is fully reused. Only 3 new frontend packages are added across all 7 features. The backend adds zero new libraries. See `.planning/research/STACK.md` for full version details, rationale, and alternatives considered.

**New dependencies (frontend only):**
- `docx-preview` 0.3.7: DOCX-to-DOM rendering — better visual fidelity than mammoth for preview use case; loaded via dynamic import to keep out of the main bundle
- `dompurify` 3.3.1: HTML sanitization — mandatory after any DOCX-to-HTML conversion; 19M weekly downloads, OWASP-endorsed
- `react-error-boundary` 6.1.1: Error boundary hooks — eliminates class component boilerplate; React 19 compatible; provides `useErrorBoundary()` for propagating async errors into boundaries

**New DB tables (3 Prisma models, no new enums):**
- `PasswordResetToken` — single-use SHA-256-hashed tokens with expiry, mirrors existing `ActionToken` pattern
- `Notification` — per-user event records; type stored as a string column (not a PostgreSQL enum) to avoid Prisma enum migration pitfalls
- `WorkflowComment` — append-only discussion thread records, immutable by design consistent with audit trail philosophy

**What was considered and rejected:**
- `socket.io` / WebSockets for notifications — bidirectional overkill for read-only push; async workflow timescales make 30s polling sufficient
- `@fastify/sse` plugin for SSE — Fastify 5 peer compatibility is LOW confidence; native `reply.raw` streaming is the safe fallback if SSE is ever added post-v1.1
- `mammoth` as the DOCX library — produces semantic HTML optimized for content extraction, lower visual fidelity than `docx-preview`; either is viable (see Gaps section)
- Rich text markdown libraries — XSS complexity and mobile keyboard friction not justified for v1.1 comment threads

### Expected Features

**Must have — table stakes (users expect these in any authenticated web app):**
- Password reset flow — users locked out without it; existing `token-service.ts` SHA-256 pattern applies directly
- Responsive mobile layout — validators open email approval links on phone; `ActionConfirmPage` is the critical mobile path and cannot be desktop-only
- Error pages + form validation UX — bare browser 404/500 pages and generic form error catch-alls signal an unfinished product
- User profile / settings — name, password, language toggle; `User.locale` already stored in DB, just not editable by the user

**Should have — differentiators (reinforce Validly's core value proposition):**
- In-app notification center — bell icon + 30s REST polling; reduces missed workflow updates without email dependency
- Workflow comments / discussion thread — chronological thread on `WorkflowDetailPage`; explicitly separate from `WorkflowAction.comment` (which is validator decision justification, not freeform discussion)
- DOCX in-browser preview — DOCX is the dominant enterprise file format; "no preview — please download" breaks the mobile validator experience

**Defer to v2+:**
- Rich text comments (markdown) — XSS sanitization complexity, mobile keyboard friction; plain text with preserved newlines is sufficient
- @mentions in threads — typeahead + notification routing complexity not justified for v1.1
- WebSocket/SSE real-time notifications — async workflow timescales make polling adequate; 30s latency has no UX impact on multi-hour approval workflows
- Email digest / batched notifications — scheduled job complexity not warranted yet; per-event in-app notifications with per-type opt-out is better UX anyway
- 2FA — separate security hardening milestone
- Avatar photo uploads — image resize pipeline is disproportionate infrastructure cost for an internal tool; initials-based avatars are the standard enterprise SaaS pattern
- Browser push notifications — service worker + VAPID key overhead not warranted for an internal tool

### Architecture Approach

All 7 features integrate into the existing layered architecture (Fastify routes → services → Prisma → PostgreSQL, with BullMQ for async jobs and React/TanStack Query on the frontend). The codebase is 8,971 LOC and was read directly — all integration points, touch files, and new component boundaries are known with HIGH confidence. No structural changes to the architecture are needed; this is purely additive work. See `.planning/research/ARCHITECTURE.md` for the complete component boundary map, new API route table, and dependency-ordered build graph.

**New backend components:**
1. Password Reset — `PasswordResetToken` model, 2 auth routes (`POST /auth/forgot-password`, `POST /auth/reset-password`), email template in `email-service.ts`
2. User Profile — 2 self-service routes (`PATCH /auth/profile`, `POST /auth/change-password`) — deliberately separate from the existing admin-only `PATCH /users/:id`
3. Notification Center — `Notification` model, `notification-service.ts`, 3 notification routes, creation hooks added to `workflow-service.ts` after state transitions (non-blocking side effects, outside transactions)
4. Comments — `WorkflowComment` model, `comment-service.ts`, 2 workflow routes (`GET /workflows/:id/comments`, `POST /workflows/:id/comments`)

**New frontend components:**
1. Password Reset — `ForgotPasswordPage.tsx`, `ResetPasswordPage.tsx`
2. User Profile — `ProfilePage.tsx` at `/profile`
3. Error Handling — `ErrorBoundary.tsx`, `NotFoundPage.tsx`, `ErrorPage.tsx`
4. DOCX Preview — extend existing `DocumentPreview.tsx` with a new MIME type branch; dynamic import to keep conversion library out of the main bundle
5. Notification Center — `NotificationCenter.tsx` as a slide-out panel (not a page), `useNotifications` hook with 30s polling
6. Comments — `CommentThread.tsx` added to `WorkflowDetailPage`
7. Responsive Layout — retrofit existing pages; optionally extract a shared `PageHeader.tsx` to apply nav changes once

**Key patterns to follow:**
- Notification creation as a non-blocking side effect: never inside `prisma.$transaction()`, always wrapped in `try/catch` after transaction commits — a notification failure must not roll back a workflow state change
- Self-service profile routes use `req.user.sub` from JWT (not a URL path param) — structurally prevents one user from updating another's profile
- Comments are immutable (append-only) — no `PATCH` or `DELETE` on comments, consistent with the existing audit trail philosophy
- `docx-preview` loaded via dynamic `import('docx-preview')` — keeps the library out of the initial bundle since DOCX preview is only triggered when a DOCX is opened

### Critical Pitfalls

1. **`apiFetch` Content-Type on empty-body POST requests** — Fastify 5 rejects requests with `Content-Type: application/json` and an empty body (`FST_ERR_CTP_EMPTY_JSON_BODY`). This bug has been fixed 3 times already in v1.0. It will recur on every new no-body POST (mark-all-notifications-read, dismiss notification, etc.) unless fixed at the root. Fix `apiFetch` once, at the very start of v1.1, to only set the header when `options.body` is non-null and non-empty.

2. **XSS via DOCX preview HTML output** — mammoth.js and docx-preview both explicitly document that they perform no sanitization. A malicious DOCX with embedded script tags can steal JWT tokens from localStorage. Mitigation: always pipe output through `DOMPurify.sanitize()` before `dangerouslySetInnerHTML`. Non-negotiable from the first commit of the preview feature.

3. **Ghost sessions after password change** — existing JWTs and refresh tokens remain valid after a password change unless explicitly invalidated. Call `prisma.refreshToken.deleteMany({ where: { userId } })` in both the password reset handler and the profile password-change handler. The existing `authService.logout()` already does this — reuse it.

4. **Password reset TOCTOU race** — a read-then-update sequence on token consumption allows two simultaneous requests with the same token to both succeed. Use atomic `prisma.passwordResetToken.updateMany({ where: { tokenHash, usedAt: null, expiresAt: { gt: new Date() } }, data: { usedAt: new Date() } })`. If `result.count === 0`, the token is already used or expired.

5. **Prisma enum migration failure** — `ALTER TYPE ADD VALUE` cannot run inside a PostgreSQL transaction block, which is how Prisma wraps all migrations by default. Store `Notification.type` as a string column (not a PostgreSQL enum) to avoid this entirely. Never extend existing enums (`WorkflowStatus`, `PhaseStatus`, `StepStatus`, etc.) in v1.1 migrations.

## Implications for Roadmap

Based on the dependency graph from ARCHITECTURE.md, the feature dependency tree from FEATURES.md, and the pitfall timing requirements from PITFALLS.md, three phases are recommended for the v1.1 milestone.

### Phase 1: Foundation — Schema, APIs, and Self-Contained Frontend Features
**Rationale:** All 3 Prisma models must be migrated before any backend services reference them — batch all schema changes into one migration event. The `apiFetch` fix must be the very first commit of the milestone. Self-contained frontend features (error pages, DOCX preview, form validation with Zod) have no new backend dependencies and deliver immediate user-visible value. Password reset and user profile are the most straightforward backend features (they reuse existing token and auth service patterns exactly) and should ship early.
**Delivers:** All 3 new Prisma models migrated; `apiFetch` Content-Type bug fixed permanently; password reset flow (full end-to-end: request email, consume token, change password, invalidate sessions); user profile / settings page (name, locale, password change); DOCX in-browser preview with DOMPurify sanitization; error pages + form validation with Zod on all existing and new forms; responsive mobile layout for critical paths (`ActionConfirmPage`, `LoginPage`).
**Addresses:** Password reset flow, User profile / settings, DOCX preview, Error pages + form validation, Responsive layout (critical paths)
**Avoids:**
  - `apiFetch` Content-Type bug — fixed before any new endpoint is tested from the frontend
  - Password reset TOCTOU — atomic token consume implemented from day one
  - Ghost sessions — refresh token deletion on password change in the same PR as the feature
  - DOCX XSS — DOMPurify pass required before any DOCX preview is committed
  - Prisma enum migration failure — string column for `Notification.type` decided at schema design time, not after migration
**Research flag:** Standard patterns. All integration points are known from direct codebase inspection. No deeper research needed.

### Phase 2: Social Features — Comments and Notification Center
**Rationale:** Both features depend on the schema and API foundation from Phase 1 (the `Notification` and `WorkflowComment` models must exist). Comments are simpler (two REST endpoints, one new component in `WorkflowDetailPage`) and should be built before the notification center to validate the `WorkflowDetailPage` extension pattern. The notification center is the highest-complexity feature across all 7 — it hooks into `workflow-service.ts` (high blast radius), has badge state, 30s polling, and preferences integration — and benefits from being built last with full context.
**Delivers:** Workflow discussion threads on all workflow detail pages (append-only, plain text, disabled on terminal-state workflows); in-app bell icon notification center with unread count badge, 30s polling, mark-as-read, navigate-to-workflow links; `COMMENT_ADDED` notification type for workflow participants; per-user notification type preferences integrated into the profile settings page from Phase 1.
**Addresses:** Workflow comments / discussion thread, In-app notification center
**Avoids:**
  - Notification loop — design the full notification event graph (comment triggers notification, notification never triggers further notification; system events use `UnrecoverableError` in BullMQ) before writing any notification code
  - N+1 on unread count — dedicated `COUNT(*) WHERE readAt IS NULL` endpoint for the badge; paginated full-list endpoint only loaded when panel is opened; `@@index([userId, readAt])` added at schema creation time
  - Comments on closed workflows — input disabled when `workflow.status` is a terminal state
**Research flag:** Notification center warrants brief pre-planning to explicitly map the notification event graph (what triggers what, what must not cascade). The BullMQ `UnrecoverableError` pattern for notification jobs and the badge vs list endpoint split are implementation decisions with production performance implications.

### Phase 3: Polish Completion — Full Responsive Layout and i18n
**Rationale:** Responsive layout changes are intentionally last. Retrofitting responsive CSS to existing components risks breaking features (notification panel, comment drawer, DOCX preview) that were built in prior phases assuming a fixed layout. Doing this phase after all feature components are stable means the final layout state can be tested holistically and desktop visual regressions can be caught before shipping.
**Delivers:** All pages responsive at 375px (mobile), 768px (tablet), 1280px (desktop) breakpoints; mobile navigation (hamburger menu or bottom nav bar) built as a standalone component before being integrated into existing pages; desktop layout visually regression-tested at 1280px before and after all layout changes; all new EN and FR i18n keys complete for every new surface added in Phases 1 and 2.
**Addresses:** Responsive mobile layout (remaining pages beyond critical paths), i18n completion for all v1.1 surfaces
**Avoids:**
  - Responsive layout regression — audit all hardcoded pixel widths (`w-96`, `w-128`, etc.) across layout files before adding any responsive classes; build mobile nav in isolation first; take 1280px snapshots before touching layout components
**Research flag:** Before starting Phase 3, do a full audit of hardcoded pixel widths and fixed-layout components in `DashboardPage.tsx` and `WorkflowDetailPage.tsx`. The scope of changes may be larger than estimated until the audit is complete. No library research needed — Tailwind v4 responsive utilities are sufficient.

### Phase Ordering Rationale

- **Security non-negotiables in Phase 1:** The `apiFetch` fix, TOCTOU atomic token, ghost session deletion, and DOMPurify on DOCX output are security requirements that cannot be deferred — they must ship with or before the features they protect.
- **Schema-first:** All 3 new Prisma models land in one migration batch in Phase 1. This avoids partial-state issues from incremental migrations and ensures Phase 2 has a stable schema to build against.
- **Notification center last across all phases:** It is the highest-complexity feature, hooks into `workflow-service.ts` which touches everything, and its notification event graph depends on knowing what comments do (Phase 2) and what the profile preferences page looks like (Phase 1). Building it last eliminates speculative design.
- **Responsive layout last of all:** Any restructuring of `DashboardPage.tsx` or `WorkflowDetailPage.tsx` layout creates merge conflicts with features being built in the same files. All feature components should be stable before layout is retrofitted around them.

### Research Flags

Phases with well-documented patterns — skip `/gsd:research-phase`:
- **Phase 1 — Password Reset:** Identical token pattern to existing `ActionToken` + `token-service.ts`. Replicate the existing pattern. No research needed.
- **Phase 1 — DOCX Preview:** Single file change (`DocumentPreview.tsx`) + known library (`docx-preview` 0.3.7). Integration pattern is described in STACK.md.
- **Phase 1 — Error Pages + Form Validation:** React Router 7 `errorElement` is documented; Zod + `@hookform/resolvers` is the community standard. No research needed.
- **Phase 1 — User Profile:** Two new auth routes reusing `verifyPassword` + `hashPassword` from existing `auth-service.ts`. No research needed.
- **Phase 2 — Comments:** Two REST endpoints + one new component. Straightforward.
- **Phase 3 — Responsive Layout:** Tailwind v4 responsive utilities are documented; no new libraries. Pre-phase width audit is the only prerequisite.

Phases that may benefit from pre-planning investigation:
- **Phase 2 — Notification Center:** Map the notification event graph before writing code. Define what triggers a notification, what must not cascade, and how BullMQ jobs for notifications handle failure (`UnrecoverableError`). Confirm the badge endpoint (`COUNT`) vs list endpoint (`paginated`) split before implementing either.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM-HIGH | Existing v1.0 stack is HIGH confidence — in production. New additions (`docx-preview`, `dompurify`, `react-error-boundary`) are MEDIUM — versions verified via npm search but not installed and integrated yet. `@fastify/sse` Fastify 5 compatibility is LOW — not applicable since polling is chosen for v1.1. |
| Features | HIGH | All 7 features scoped against actual codebase files. Feature research validated against `token-service.ts`, `email-service.ts`, `DocumentPreview.tsx`, Prisma schema. The defer list is clearly reasoned from domain requirements, not arbitrary. |
| Architecture | HIGH | All integration points derived from direct inspection of 8,971 LOC. Component boundaries, new routes, modified files, and build order are specific and known. No speculative architecture. |
| Pitfalls | HIGH | Critical pitfalls verified against official sources: Fastify GitHub #5148 (Content-Type bug), Prisma GitHub #5290/#8424 (enum migration), mammoth.js README (no sanitization warning), OWASP/PortSwigger (TOCTOU, XSS). Three of the four critical pitfalls have established precedent in the v1.0 codebase itself. |

**Overall confidence:** HIGH — sufficient to plan all phases without pre-planning research, with the exception of the notification event graph mapping for Phase 2.

### Gaps to Address

- **`docx-preview` vs `mammoth` final decision:** STACK.md recommends `docx-preview` for visual fidelity (tables, merged cells, columns, fonts). FEATURES.md and ARCHITECTURE.md reference `mammoth` for semantic HTML. Both are viable. Resolve at implementation time by testing `docx-preview` 0.3.7 against representative DOCX samples from actual users. If visual fidelity is insufficient, `mammoth` with Tailwind `prose` styling is the fallback. Both require the same DOMPurify sanitization step.
- **Token expiry for password reset:** STACK.md recommends 1 hour; FEATURES.md cites 30 minutes (OWASP); PITFALLS.md UX section recommends 2 hours minimum to account for email delivery delays. Recommended resolution: 1 hour (balances OWASP guidance and UX practicality). Include "link expires in 1 hour" explicitly in the reset email body.
- **Notification type string constants vs TypeScript enum:** Using a string column on the `Notification` model avoids Prisma PostgreSQL enum migration pitfalls. To maintain type safety, define a TypeScript `const` object or Zod enum in a shared types file at the start of Phase 2. This provides compile-time safety without requiring a DB-level enum.
- **`apiFetch` for binary document download in DOCX preview:** PITFALLS.md notes that `apiFetch` sets `Content-Type: application/json` on all requests — this breaks binary downloads. The DOCX file fetch inside `DocumentPreview.tsx` must use raw `fetch()`, not `apiFetch`. Confirm and document this boundary explicitly when implementing the DOCX preview branch.

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection — `/Users/mmaudet/work/validly/` — all architecture integration points, 8,971 LOC
- mammoth.js GitHub (mwilliamson/mammoth.js) — "performs no sanitisation" documented in official README
- Fastify GitHub Issue #5148 — `FST_ERR_CTP_EMPTY_JSON_BODY` confirmed behavior
- Prisma GitHub Issues #5290, #8424 — `ALTER TYPE ADD VALUE` cannot run inside transaction block
- OWASP Forgot Password Cheat Sheet — token security requirements (30 min expiry, single-use, user enumeration prevention)
- PortSwigger Web Security Academy — TOCTOU race conditions in reset flows
- OWASP Cross-Site Scripting Prevention Cheat Sheet — HTML sanitization requirements
- React Router 7 official docs — `errorElement` error boundary integration
- BullMQ official docs — `UnrecoverableError` pattern for bounded retries
- react.dev/blog/2024/12/05/react-19 — React 19 error hook changes (onCaughtError, onUncaughtError)
- DOMPurify GitHub (cure53/DOMPurify) — OWASP-endorsed HTML sanitizer

### Secondary (MEDIUM confidence)
- npm search results — `docx-preview` 0.3.7 (Sep 2025), `dompurify` 3.3.1 (Dec 2025), `react-error-boundary` 6.1.1 (Feb 2026), `@fastify/sse` 0.4.0 (Nov 2025)
- Smashing Magazine — design guidelines for notification UX (2025)
- SuprSend — JIRA-like in-app inbox patterns for workflow applications
- Ghost Session vulnerability — JWT invalidation on password change pattern
- JWT Lifecycle Management — refresh token revocation strategies
- React Error Boundaries async limitation — matches official React docs behavior

### Tertiary (LOW confidence)
- `@fastify/sse` 0.4.0 Fastify 5 peer compatibility — not confirmed from official source; not applicable for v1.1 since polling is chosen

---
*Research completed: 2026-02-20*
*Ready for roadmap: yes*
