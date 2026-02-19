# Feature Research

**Domain:** Document validation workflow platform — v1.1 UX Polish milestone
**Researched:** 2026-02-20
**Confidence:** HIGH

> **Note:** This file was updated for the v1.1 milestone. The prior v1.0 research (competitor analysis, core engine features) remains valid. This version focuses exclusively on the 7 UX polish features scoped for v1.1, analyzed against the existing v1.0 codebase.

---

## Context: Existing v1.0 Foundation

Before categorizing new features, the existing system provides:
- Fastify backend with Prisma + PostgreSQL
- React 19 + TailwindCSS 4 + Tanstack Query + react-hook-form frontend
- Workflow engine (sequential/parallel phases, quorum rules)
- Email action channel (approve/refuse via tokenized links, `token-service.ts`)
- Dashboard (dual views), stepper visualization, template management
- Multi-step creation wizard, admin user management, audit trail
- FR/EN i18n (i18next, both backend and frontend)
- PDF + image in-browser preview (`DocumentPreview.tsx` via react-pdf)
- `WorkflowAction` model has `comment: String?` for validator decision comments
- `ActionToken` pattern (CSPRNG + SHA-256 hash stored) — reusable for password reset
- `@fastify/rate-limit` already installed
- `react-hook-form` already a frontend dependency

The 7 features below are all additive UX polish on top of this foundation.

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist in any authenticated web application. Missing these makes the product feel incomplete regardless of how strong the core workflow engine is.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Password reset flow** | Every authenticated web app has one. Users locked out without admin intervention is a critical gap — especially for self-hosted deployments without a dedicated ops team. | LOW | CSPRNG token + SHA-256 hash pattern already implemented in `token-service.ts`. Reuse: new `PasswordResetToken` model, 2 API routes, 2 frontend pages. Token expiry 30 min (OWASP). Single-use enforcement mandatory (mark `usedAt`). Rate-limit `POST /auth/forgot-password`. |
| **Responsive mobile layout** | ~60% of web traffic is mobile in 2025. Validators receive email links and open them on their phone — the approve/refuse confirmation flow is a primary mobile use case. | MEDIUM | Most critical path: `ActionConfirmPage` (email-linked, tapped on phone). Secondary: `DashboardPage` list view, `LoginPage`. Lower priority: `WorkflowCreatePage` (complex wizard, tablet minimum acceptable). Tailwind 4 breakpoints already available, no new dependencies. Touch targets must be at least 44x44px (WCAG). |
| **User-friendly error pages** | Bare browser 404/500 errors signal an unfinished product. React Router 7 has first-class error boundary support. | LOW | Need: 404 (not found), 403 (forbidden), 500 (server error), and expired/used token pages (existing `ActionErrorPage.tsx` is a usable pattern). React Router 7 `errorElement` on the root route handles unhandled navigation errors. |
| **Form validation UX** | Inline field errors are expected. Top-level "something went wrong" catch-alls are not acceptable. `react-hook-form` is already installed but used without schema validation. | LOW | Add `zod` as frontend dependency (already in backend). Use `@hookform/resolvers/zod` to integrate. Pattern: validate on blur, show inline errors per field, move focus to first error on submit. Error messages must be specific ("Password must be at least 8 characters") not generic. |
| **User profile / settings** | Users expect to change their own name, password, and language without admin help. Especially important because language preference is already stored on `User.locale`. | LOW | Extends existing `GET /auth/me`. New: `PATCH /users/me` route. Frontend: `ProfilePage.tsx` with tabs (Profile, Security, Notifications). Language switch already functional via i18next — persist selection to DB. Password change requires current password verification + re-hash. |

### Differentiators (Competitive Advantage)

Features that reinforce Validly's core value proposition: frictionless validation with complete audit trail. These go beyond baseline UX expectations.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **In-app notification center** | Workflow participants track events without relying solely on email. Reduces missed updates when email is noisy or filtered. | MEDIUM | Bell icon + popover (Jira/GitHub pattern). Unread badge count. Mark-as-read. Configurable per-user per-type toggles (on profile settings page). Backend: new `Notification` model (`userId`, `type`, `read`, `workflowId?`, `metadata Json?`, `createdAt`). Triggered inside existing `workflow-service.ts` state transitions. REST polling at 30s interval via `useQuery` `refetchInterval` — no WebSocket needed for v1.1. |
| **Workflow comments / discussion thread** | Contextual discussion lives alongside the workflow rather than dispersed across email chains. Preserves context without requiring validators to log in to leave quick questions. | MEDIUM | `WorkflowAction.comment` (existing) is for validator decision justification — NOT for freeform discussion. A separate `WorkflowComment` model is needed: `workflowId`, `authorId`, `content`, `createdAt`. Chronological thread displayed on `WorkflowDetailPage` below the stepper. No mentions, no reactions for v1.1. API: `GET /workflows/:id/comments`, `POST /workflows/:id/comments`. |
| **DOCX in-browser preview** | PDFs already render. DOCX is the dominant file format in most enterprises. "No preview available — please download" breaks the validator experience, especially on mobile where downloading and opening a DOCX requires Office. | LOW-MEDIUM | `DocumentPreview.tsx` already handles PDF (react-pdf) and images. Add DOCX branch for MIME type `application/vnd.openxmlformats-officedocument.wordprocessingml.document`. Use `mammoth.js`: converts DOCX ArrayBuffer to HTML client-side. Produces semantic HTML (not pixel-perfect replica) — acceptable for review context where content matters more than formatting fidelity. Alternative: `docx-preview` for exact formatting (colors, merged cells, images) at higher bundle cost. |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Real-time WebSocket notifications** | "Live" updates feel modern; instant feedback is expected in consumer apps. | Self-hosted deployments add infrastructure complexity: sticky sessions required, Redis pub/sub for multi-instance scale, connection management. Document validation workflows have inherently async timescales (hours/days) — sub-second latency has no UX value here. | REST polling every 30s on `GET /notifications`. Acceptable for this domain. Implement WebSocket in a later milestone only if polling becomes a performance concern. |
| **Rich text comments (markdown, formatting)** | Reviewers want to emphasize text and format lists in discussion threads. | Creates XSS sanitization complexity (must sanitize server-side), increases bundle size (markdown editor), degrades mobile UX (markdown shortcuts don't work on mobile keyboards), and is overkill for short validation feedback. | Plain text with preserved newlines only. Reserve rich text for v2 if users explicitly demand it. |
| **Avatar / profile photo uploads** | Profile pages with photos feel more personal and humanize the interface. | Requires image storage path, resize pipeline (multiple sizes), CDN or local storage management — disproportionate infrastructure cost for an internal tool. | Initials-based avatar generated from user name (common pattern in enterprise SaaS, already used in Figma, Linear, etc.). No storage needed. |
| **Email digest / batched notifications** | Reduces notification noise for users in high-volume workflows. | Requires scheduled jobs (BullMQ exists but adds queue config complexity), complicates "mark as read" semantics, delays delivery of critical workflow events that users need to act on quickly. | Per-event in-app notifications with configurable opt-out per type. Granular per-type toggle is better UX than digest batching. Digest is a v2 concern. |
| **@mentions in discussion threads** | Familiar pattern from Slack and Jira; users want to direct-message specific participants. | Requires user lookup autocomplete (typeahead), notification routing by mention (separate from workflow notifications), and disambiguation between registered users and external validator emails. High complexity relative to v1.1 value. | Simple chronological thread visible to all workflow participants. In-app notification on new comment (via notification center) is sufficient. |
| **Two-factor authentication (2FA)** | Security-conscious admins may request TOTP for admin accounts. | Out of scope for a UX polish milestone. TOTP adds: secret generation + storage, QR code flow, recovery codes, and testing complexity. | Strong password policy already enforced (8+ chars, hashed with scrypt). 2FA is a separate security hardening milestone. |
| **Notification sound / browser push** | "Notify me even when the tab is not active." | Browser Push API requires VAPID key management, service worker registration, and per-browser permission prompts. For an internal tool, tab-active polling is sufficient. | In-app badge visible when tab is open. Document workflows are not time-critical enough to warrant push notifications. |

---

## Feature Dependencies

```
[Password Reset Flow]
    requires──> [Email service / SMTP] (EXISTS: email-service.ts + nodemailer)
    requires──> [PasswordResetToken DB model] (NEW — mirrors ActionToken without stepId/action fields)
    enhances──> [Login Page] (add "Forgot password?" link — one-line change)

[User Profile / Settings Page]
    requires──> [PATCH /users/me API route] (NEW)
    enhances──> [Language switcher] (EXISTS in i18next — needs DB persistence via PATCH /users/me)
    enables──>  [Password change] (reuses authService hashPassword + verifyPassword)
    enables──>  [Notification preferences] (prefs live on profile settings page)

[Notification Preferences]
    requires──> [User Profile / Settings] (prefs UI lives on profile page)
    requires──> [In-app Notification Center] (no point configuring what doesn't exist)

[In-app Notification Center]
    requires──> [Notification DB model] (NEW)
    triggered-by──> [Workflow state transitions] (EXISTS: workflow-service.ts — add notification creation calls)
    enhances──> [Dashboard] (bell icon + badge count in nav)
    enhances──> [User Profile / Settings] (per-type toggle on notifications tab)

[Workflow Comments / Discussion Thread]
    requires──> [WorkflowComment DB model] (NEW — separate from WorkflowAction)
    note: WorkflowAction.comment (EXISTS) — for validator decision justification, NOT freeform discussion
    enhances──> [WorkflowDetailPage] (thread section added below stepper — no new pages)
    can trigger──> [Notification Center] (COMMENT_ADDED notification type — optional in v1.1)

[DOCX In-browser Preview]
    requires──> [mammoth npm package] (NEW: ~180KB minified)
    extends──> [DocumentPreview.tsx] (EXISTS — add DOCX MIME branch alongside PDF/image branches)
    note: no backend changes required (file already served by GET /documents/:id/file)

[Responsive Mobile Layout]
    requires──> [No new dependencies] (Tailwind 4 responsive utilities already available)
    most-critical-for──> [ActionConfirmPage] (validator opens email link on phone)
    affects──> [DashboardPage, WorkflowDetailPage, LoginPage, all forms]
    note: WorkflowCreatePage (complex wizard) — tablet minimum acceptable, not phone

[Error Pages + Form Validation]
    requires──> [React Router 7 errorElement] (EXISTS: react-router ^7.2.0 installed)
    requires──> [zod frontend schemas] (NEW frontend dependency — zod already in backend)
    requires──> [@hookform/resolvers] (NEW — bridges react-hook-form + zod)
    pattern-from──> [ActionErrorPage.tsx] (EXISTS — reusable error page pattern)
```

### Dependency Notes

- **Password reset requires no new infrastructure.** SMTP, token hashing, and rate limiting are all installed. Cost is: 1 Prisma model + 2 API routes + 2 frontend pages.
- **User profile unlocks notification preferences.** Build profile settings first; notification prefs tab follows naturally. Don't split across separate phases.
- **DOCX preview is self-contained.** No backend changes. Only `DocumentPreview.tsx` modification + mammoth install. Lowest risk item in the milestone.
- **Notification center is the highest-complexity feature.** Requires: new DB model, event hooks in workflow-service, REST polling on frontend, badge state, preferences integration. Build last with most context.
- **Comments are independent of notification center.** The thread can ship without triggering notifications — add `COMMENT_ADDED` notification type as an enhancement, not a blocker.
- **Form validation affects every existing form.** Budget time to update `LoginPage`, `SignupPage`, `WorkflowCreatePage`, and `TemplateFormPage`. Not just new pages.

---

## MVP Definition for v1.1

### Ship in This Milestone

All 7 features are in defined scope. Recommended implementation order based on dependency chain and risk profile:

- [x] **Error pages + form validation** — Zero dependencies, no DB changes. Makes everything feel more complete immediately. Foundation for later features to build on.
- [x] **Password reset flow** — Table stakes. Blocks user self-service without admin. Uses existing token patterns exactly.
- [x] **DOCX preview** — Self-contained. No DB changes. Immediate validator value. Minimal risk.
- [x] **Responsive mobile layout** — Cross-cutting concern; easier after feature pages exist. `ActionConfirmPage` is the critical mobile path.
- [x] **User profile / settings** — Enables notification prefs to follow. Name, password, language toggle.
- [x] **Workflow comments / discussion thread** — New DB model, contained to `WorkflowDetailPage`. Independent of notification center.
- [x] **In-app notification center** — Highest complexity. Built last with most context available.

### Defer to v2+

- [ ] **Rich text comments** — Wait for explicit user demand signal
- [ ] **Email digest** — Scheduled job complexity not justified yet
- [ ] **@mentions in threads** — Requires autocomplete + routing complexity
- [ ] **2FA** — Separate security milestone
- [ ] **Avatar uploads** — Low value for internal tool; initials are sufficient
- [ ] **Browser push notifications** — Service worker overhead not warranted
- [ ] **WebSocket real-time notifications** — Polling covers the async workflow use case

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Password reset flow | HIGH | LOW | P1 |
| Responsive mobile layout | HIGH | MEDIUM | P1 |
| Error pages + form validation | MEDIUM | LOW | P1 |
| User profile / settings | HIGH | LOW | P1 |
| DOCX in-browser preview | HIGH | LOW | P1 |
| Workflow comments / discussion | MEDIUM | MEDIUM | P2 |
| In-app notification center | MEDIUM | MEDIUM | P2 |

**Priority key:**
- P1: Core polish — high effort/value ratio, ships first, unblocks other features
- P2: Differentiators — meaningful improvements, acceptable to ship in second sub-phase of milestone

---

## Implementation Notes by Feature

### Password Reset Flow
- Token: `randomBytes(32)` + SHA-256 hash stored — identical pattern to `tokenService.createToken()`
- Expiry: 30 minutes (OWASP recommendation; NIST SP 800-63B guidance)
- Single-use: mark `usedAt` on consumption, same as `tokenService.resolveToken()`
- User enumeration prevention: always return "if this email exists, a reset link was sent" — never differentiate response based on email existence
- Rate limiting: apply `@fastify/rate-limit` (already installed) to `POST /auth/forgot-password`
- New Prisma model: `PasswordResetToken` — fields: `id`, `tokenHash` (unique), `userId`, `usedAt?`, `expiresAt`, `createdAt`
- New routes: `POST /auth/forgot-password`, `POST /auth/reset-password`
- New frontend pages: `ForgotPasswordPage.tsx`, `ResetPasswordPage.tsx`
- Touch point: add "Forgot password?" link to `LoginPage.tsx` (one line)

### In-app Notification Center
- Transport: REST polling. `GET /notifications` every 30s via `useQuery` with `refetchInterval: 30000`
- New Prisma model: `Notification` — `id`, `userId`, `type` (enum), `read` (bool, default false), `workflowId?`, `metadata Json?`, `createdAt`
- Notification types for v1.1: `STEP_APPROVED`, `STEP_REFUSED`, `WORKFLOW_COMPLETED`, `WORKFLOW_REFUSED`, `COMMENT_ADDED`
- Trigger points: inside `workflow-service.ts` at existing state transition points (same location initiator notification emails are sent)
- Frontend: bell icon in nav bar with unread badge count. Click opens popover list (max 20 items). "Mark all read" action. "View workflow" link per notification.
- Configurable per-user: `UserNotificationPrefs` stored as JSON on User model or as separate `NotificationPreference` table with `userId`, `type`, `enabled` rows
- API routes: `GET /notifications` (paginated, supports `?unread=true`), `POST /notifications/mark-read` (bulk), `GET/PUT /users/me/notification-prefs`

### Workflow Comments / Discussion Thread
- New Prisma model: `WorkflowComment` — `id`, `workflowId`, `authorId`, `content`, `createdAt`
- Explicit distinction: `WorkflowAction.comment` is validator decision justification. `WorkflowComment.content` is freeform discussion.
- Display: chronological thread on `WorkflowDetailPage`, positioned below stepper, above audit trail toggle. Author name + relative timestamp + content.
- Access: any authenticated user who is the workflow initiator OR a registered user listed as validator
- API routes: `GET /workflows/:id/comments`, `POST /workflows/:id/comments`
- Content: plain text, newlines preserved. No length cap beyond reasonable DB constraint (e.g., 2000 chars).
- Optional v1.1 enhancement: create `COMMENT_ADDED` notification for workflow initiator when a comment is posted by a validator (and vice versa)

### DOCX In-browser Preview
- Library: `mammoth` npm package (v1.11.0, ~180KB minified, ~1.8M weekly downloads, actively maintained)
- Tradeoff accepted: mammoth produces semantic HTML (not pixel-perfect). For validation review, content fidelity matters more than visual formatting. If exact formatting is critical (colors, merged cells), switch to `docx-preview` — heavier but more faithful.
- Integration point: `DocumentPreview.tsx`, add MIME type branch for `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
- Implementation: fetch file as ArrayBuffer (already done for PDF), pass to `mammoth.convertToHtml({ arrayBuffer })`, render result in sandboxed `<div>` with scoped CSS to prevent style bleed
- CSS sandboxing: wrap rendered HTML in a container with `.docx-preview { all: revert }` or Tailwind's `prose` class for readable typography
- Bundle optimization: dynamic import (`import('mammoth')`) to avoid loading 180KB unless a DOCX is opened
- No backend changes required — file already served by `GET /documents/:id/file`

### Responsive Mobile Layout
- Priority breakpoints: mobile (< 640px `sm`), tablet (640-1024px `md`), desktop (> 1024px `lg`)
- Critical paths for mobile (must work perfectly on phone):
  - `ActionConfirmPage` — email link tapped on phone; approve/refuse buttons must be large, prominent, thumb-accessible
  - `LoginPage` — first touch point for any mobile user
  - `DashboardPage` list view — initiators check status on phone
- Lower priority for mobile (tablet minimum acceptable):
  - `WorkflowCreatePage` — complex multi-step wizard; mobile experience can be degraded
  - `AdminUsersPage` — admin task typically done at desk
- Touch targets: minimum 44x44px for all interactive elements (WCAG 2.5.5)
- Navigation: consider a bottom navigation bar or hamburger menu for mobile breakpoints if sidebar nav is present
- Tailwind 4 responsive utilities: `sm:`, `md:`, `lg:` — no new dependencies required

### User Profile / Settings
- Page: `ProfilePage.tsx` with tabbed navigation: Profile | Security | Notifications
- Profile tab: display name edit (`PATCH /users/me` with `{ name }`). Email shown as read-only (email change is a separate security-sensitive flow, defer to v2).
- Security tab: change password form — requires current password (verify before accepting new), new password, confirm new password. Reuses `authService.verifyPassword()` and `hashPassword()`.
- Language tab / profile section: language toggle (EN/FR) that calls `PATCH /users/me` with `{ locale }` and updates `i18next.changeLanguage()`. Currently this works in-memory — persisting to DB means it survives re-login.
- Notifications tab: per-type toggle for in-app notification types. Disabled types are filtered server-side before storing to DB.
- Edit mode: inline editing (no separate "edit mode" button — each field is directly editable with save/cancel on change). Inline editing is faster and fits the single-settings-page pattern.
- New API route: `PATCH /users/me` — accepts `{ name?, locale?, password?: { current, new } }`

### Error Pages + Form Validation
- React Router 7 `errorElement` on root route captures unhandled navigation errors and renders `ServerErrorPage`
- Dedicated error page components: `NotFoundPage.tsx` (404), `ForbiddenPage.tsx` (403), `ServerErrorPage.tsx` (500)
- Pattern reference: `ActionErrorPage.tsx` already exists — same visual style should be applied to all error pages
- Form validation stack: add `zod` to frontend `package.json` + `@hookform/resolvers` for bridge. Both are small dependencies.
- Validation pattern: define Zod schemas per form (`loginSchema`, `signupSchema`, `passwordResetSchema`, etc.) and pass to `useForm({ resolver: zodResolver(schema) })`
- Apply to existing forms: `LoginPage`, `SignupPage`, `WorkflowCreatePage` forms, `TemplateFormPage`, and new pages (`ForgotPasswordPage`, `ResetPasswordPage`, `ProfilePage`)
- Error display: inline errors below each field (`<p role="alert">` with field-specific message). Red border on invalid field. No color-only signaling (add icon or text).
- API errors: centralize in `apiFetch` or a query error boundary. Map HTTP status codes to user-readable messages.

---

## Sources

- OWASP Forgot Password Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html
- SuperTokens — Implementing a Forgot Password Flow: https://supertokens.com/blog/implementing-a-forgot-password-flow
- Smashing Magazine — Design Guidelines for Better Notifications UX: https://www.smashingmagazine.com/2025/07/design-guidelines-better-notifications-ux/
- SuprSend — Building JIRA-like In-App Inbox: https://www.suprsend.com/inapp-inbox-inspiration/building-jira-like-in-app-inbox-for-your-workflow-management-application-with-production-grade-code
- mammoth.js GitHub: https://github.com/mwilliamson/mammoth.js
- npm-compare (mammoth vs docx-preview vs docxtemplater): https://npm-compare.com/docx-preview,docxtemplater,jszip,mammoth,officegen
- React Router 7 Error Boundaries: https://reactrouter.com/how-to/error-boundary
- Toptal — How to Improve App Settings UX: https://www.toptal.com/designers/ux/settings-ux
- Webflow — Responsive web design best practices 2025: https://webflow.com/blog/responsive-web-design
- Userpilot — Notification UX: https://userpilot.com/blog/notification-ux/
- Codebase analysis: `token-service.ts`, `email-service.ts`, `workflow-service.ts`, `DocumentPreview.tsx`, `ActionErrorPage.tsx`, Prisma schema

---
*Feature research for: Validly v1.1 UX Polish milestone*
*Researched: 2026-02-20*
