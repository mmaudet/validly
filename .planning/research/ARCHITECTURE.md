# Architecture Research

**Domain:** Document validation workflow platform (Validly) — v1.1 UX Polish integration
**Researched:** 2026-02-20
**Confidence:** HIGH — All findings based on direct inspection of the existing codebase (8,971 LOC).

---

## Context: Existing Architecture Baseline

This document focuses on **how v1.1 features integrate with the existing codebase**, not on the original architecture design. All integration points, touch files, and data flow changes are derived from reading the actual code.

### What Already Exists

**Backend (Fastify 5, Prisma 6, PostgreSQL 15, BullMQ/Redis)**

```
backend/src/
├── api/routes/          auth.ts, workflows.ts, documents.ts, templates.ts,
│                        users.ts, actions.ts, audit.ts, health.ts
├── services/            auth-service.ts, workflow-service.ts, document-service.ts,
│                        email-service.ts, token-service.ts, audit-service.ts,
│                        reminder-service.ts, template-service.ts, user-service.ts
├── domain/              state-machine.ts, workflow-types.ts
├── infrastructure/      database.ts, queue/index.ts, storage/
├── jobs/                reminder-worker.ts (BullMQ)
├── i18n/                index.ts (i18next-fs-backend, EN + FR)
├── config/              env.ts
└── app.ts               (Fastify, registered at /api prefix)
```

**Frontend (React 19, Vite 6, Tailwind v4)**

```
frontend/src/
├── pages/               DashboardPage, WorkflowCreatePage, WorkflowDetailPage,
│                        TemplateFormPage, AdminUsersPage, LoginPage, SignupPage,
│                        ActionConfirmPage, ActionErrorPage
├── components/
│   ├── ui/              ConfirmDialog.tsx (the only generic UI component)
│   └── workflow/        CircuitBuilderStep, DocumentPreview, PhaseRow, ReviewStep,
│                        StepDetail, StepRow, TemplatePicker, WorkflowStepper
├── hooks/               useAuth.ts
├── lib/                 api.ts (apiFetch, token refresh, ApiError), utils.ts
├── i18n/                index.ts (i18next, EN + FR JSON bundles)
└── App.tsx              (React Router v7, QueryClientProvider, AuthGuard)
```

**Prisma Schema (PostgreSQL 15)**

Models: User, RefreshToken, Document, WorkflowTemplate, WorkflowInstance,
WorkflowDocument, PhaseInstance, StepInstance, ActionToken, WorkflowAction,
AuditEvent, ScheduledEvent

**No existing models for:** notifications, comments, password reset tokens.

---

## System Overview (Current State)

```
┌────────────────────────────────────────────────────────────────────┐
│                        Browser (React 19)                          │
│  Pages: Dashboard, WorkflowCreate, WorkflowDetail, Admin, ...      │
│  State: TanStack Query v5 (server state), local useState           │
│  Auth: JWT in localStorage, auto-refresh via api.ts               │
└───────────────────────────┬────────────────────────────────────────┘
                            │ HTTP (proxied /api → localhost:3000)
┌───────────────────────────▼────────────────────────────────────────┐
│                   Fastify 5 API (/api prefix)                       │
│  Routes: auth, workflows, documents, templates, users,              │
│          actions, audit, health                                     │
│  Plugins: @fastify/jwt, @fastify/multipart, @fastify/cors,         │
│           @fastify/swagger                                          │
└──────┬───────────────────────────────────────────────────────┬─────┘
       │ Prisma 6                                              │ BullMQ
┌──────▼──────────────────────┐           ┌───────────────────▼─────┐
│   PostgreSQL 15              │           │   Redis 7               │
│   (source of truth)          │           │   reminder queue        │
└─────────────────────────────┘           └─────────────────────────┘
```

---

## v1.1 Features: Integration Analysis

### Feature 1: Password Reset

**What it needs:**
- A short-lived, single-use token (distinct from JWT refresh tokens and action tokens)
- An email template in the existing email-service pattern
- Two new routes on auth: request reset, consume reset

**New backend components:**
- `PasswordResetToken` — new Prisma model. Fields: `id`, `tokenHash` (unique, SHA-256 of raw token), `userId`, `expiresAt`, `usedAt`. Same security pattern as `ActionToken`.
- `POST /auth/forgot-password` — takes `email`, generates token, sends email. Returns 200 regardless of whether email exists (prevents enumeration).
- `POST /auth/reset-password` — takes `token` + `newPassword`. Validates token (not expired, not used), hashes new password via existing `hashPassword()` in auth-service, marks token used, updates `User.password`.
- New email template function in `email-service.ts`: `sendPasswordReset(input: PasswordResetEmailInput)`. Follows existing pattern (inline HTML, i18n via `tWithLang`, EN+FR).

**Existing code touched:**
- `backend/src/services/auth-service.ts` — add `requestPasswordReset()` and `resetPassword()` methods.
- `backend/src/services/email-service.ts` — add `sendPasswordReset()`.
- `backend/src/api/routes/auth.ts` — add two new routes.
- `backend/prisma/schema.prisma` — add `PasswordResetToken` model.

**New frontend components:**
- `ForgotPasswordPage` — email input form, calls `POST /api/auth/forgot-password`. New route `/forgot-password`.
- `ResetPasswordPage` — reads `?token=...` from query string, password input form, calls `POST /api/auth/reset-password`. New route `/reset-password`.
- Add "Forgot password?" link to `LoginPage.tsx` (minimal change).

**Data flow:**
```
LoginPage (link) → /forgot-password
    │
    ▼
ForgotPasswordPage → POST /api/auth/forgot-password
    │
    ▼
auth-service.requestPasswordReset()
  ├── find user by email (if not found: silent return — no enumeration)
  ├── generate 32-byte CSPRNG token
  ├── store hash in PasswordResetToken (15min expiry)
  └── email-service.sendPasswordReset() → SMTP

User clicks email link → /reset-password?token=<raw>
    │
    ▼
ResetPasswordPage → POST /api/auth/reset-password
    │
    ▼
auth-service.resetPassword()
  ├── hash(token) → lookup PasswordResetToken
  ├── validate not expired, not used
  ├── hashPassword(newPassword) → User.password
  └── mark token used
```

**i18n:** Add keys to both EN and FR locale files (frontend `common.json`) and backend locale files for the email subject/body.

---

### Feature 2: In-App Notification Center

**What it needs:**
- A persistent `Notification` model in PostgreSQL
- Creation of notifications at the same workflow events that currently trigger emails
- An API to fetch and mark notifications read
- A polling or real-time frontend component

**New backend components:**
- `Notification` — new Prisma model. Fields: `id`, `userId`, `type` (enum: `STEP_PENDING`, `STEP_APPROVED`, `STEP_REFUSED`, `WORKFLOW_COMPLETE`, `WORKFLOW_CANCELLED`), `workflowId`, `stepId` (nullable), `readAt` (nullable), `createdAt`.
- `notification-service.ts` — new service. Methods: `createNotification()`, `listForUser(userId)`, `markRead(notificationId, userId)`, `markAllRead(userId)`.
- `GET /notifications` — list notifications for authenticated user, ordered by `createdAt desc`, paginated.
- `PATCH /notifications/:id/read` — mark one notification read.
- `PATCH /notifications/read-all` — mark all read for user.

**Existing code touched (notification creation hooks):**
- `workflow-service.ts` — after each state transition that currently calls `notifyValidators()` or sends initiator emails, also call `notification-service.createNotification()`. Specifically:
  - On workflow launch: create `STEP_PENDING` notification for validators who are registered users.
  - On `recordAction()`: create `STEP_APPROVED` or `STEP_REFUSED` notification for the initiator; create `STEP_PENDING` for next-step validators.
  - On workflow completion: create `WORKFLOW_COMPLETE` notification for initiator.
  - On workflow cancel: create `WORKFLOW_CANCELLED` notification for all involved users.

**Real-time vs polling decision:**
Use **polling** (30-second interval via TanStack Query `refetchInterval`). Rationale: no WebSocket infrastructure exists, polling is sufficient for document workflows (not a real-time chat), consistent with the existing `staleTime: 30_000` pattern in QueryClient. SSE or WebSocket can be added post-v1.1 if demand exists.

**New frontend components:**
- `NotificationCenter` — slide-out panel or dropdown, triggered by the bell icon already in `DashboardPage` header. The bell icon currently navigates to the "pending" tab; upgrade it to open the notification center instead.
- `useNotifications` hook — wraps `useQuery` with `refetchInterval: 30_000`.
- Unread count badge on the bell icon (already renders a red badge for `pendingCount`; reuse this pattern).

**Existing code touched:**
- `DashboardPage.tsx` — bell icon onClick becomes `setNotificationsOpen(true)` instead of `handleTabChange('pending')`. Unread count from new query replaces `pendingCount`.
- `App.tsx` — no route change needed if `NotificationCenter` is a panel/overlay, not a page.

**Data flow:**
```
workflow-service.recordAction()
    ├── [existing] send emails
    └── [new] notification-service.createNotification(userId, type, context)
                └── INSERT INTO notifications

Frontend (30s poll)
    → GET /api/notifications?limit=20
    → TanStack Query cache update
    → NotificationCenter re-renders with new items
    → User clicks notification → navigate to workflow
    → PATCH /api/notifications/:id/read
```

---

### Feature 3: Workflow Comments Thread

**What it needs:**
- A `WorkflowComment` model linked to `WorkflowInstance`
- A read/write comments API on the workflow resource
- A thread UI component on `WorkflowDetailPage`

**New backend components:**
- `WorkflowComment` — new Prisma model. Fields: `id`, `workflowId` (FK to WorkflowInstance), `authorId` (FK to User), `body` (text, required, non-empty), `createdAt`. No editing or deletion (immutable, consistent with audit trail philosophy).
- `GET /workflows/:id/comments` — returns ordered list of comments with author name/email.
- `POST /workflows/:id/comments` — authenticated, any user involved in the workflow (initiator or validator who has acted) posts a comment. Body: `{ body: string }`.

**Authorization boundary:** Comments are visible to anyone who can view the workflow. Posting requires authentication. No per-role restriction beyond authentication — the workflow detail page is already auth-guarded.

**Existing code touched:**
- `backend/src/api/routes/workflows.ts` — add two new route handlers (GET and POST comments).
- `backend/src/services/workflow-service.ts` — add `addComment()` and `listComments()` methods, or create a separate `comment-service.ts` (preferred for separation).
- `backend/prisma/schema.prisma` — add `WorkflowComment` model.

**New frontend components:**
- `CommentThread` component — renders comment list + new comment form. Lives in `frontend/src/components/workflow/CommentThread.tsx`.
- Add `CommentThread` to `WorkflowDetailPage.tsx` below the audit trail section.

**Data flow:**
```
WorkflowDetailPage mounts
    → GET /api/workflows/:id/comments (useQuery, staleTime: 0 for comments)
    → CommentThread renders list

User submits comment
    → POST /api/workflows/:id/comments { body }
    → useMutation onSuccess: queryClient.invalidateQueries(['workflow', id, 'comments'])
    → List re-fetches
```

---

### Feature 4: DOCX In-Browser Preview (mammoth.js)

**What it needs:**
- Client-side DOCX-to-HTML conversion via mammoth.js
- Integration with the existing `DocumentPreview` component

**Current state:** `DocumentPreview.tsx` handles `application/pdf` (react-pdf) and `image/*` (URL.createObjectURL). For all other MIME types, it shows a download link. DOCX files (`application/vnd.openxmlformats-officedocument.wordprocessingml.document`) currently show only the download link.

**New frontend components:**
- Install `mammoth` npm package in frontend.
- Extend `DocumentPreview.tsx` to handle `application/vnd.openxmlformats-officedocument.wordprocessingml.document`:
  - Fetch the file as `ArrayBuffer` (same auth-aware fetch already done for PDF).
  - Call `mammoth.convertToHtml({ arrayBuffer })` — returns `{ value: string, messages: Message[] }`.
  - Render the HTML inside a sandboxed `div` with scoped Tailwind prose styles.
- No backend changes required — file is already served by `GET /api/documents/:id/file`.

**Integration point (single file):**
```
frontend/src/components/workflow/DocumentPreview.tsx
  - Add DOCX branch alongside existing PDF and image branches
  - Import mammoth dynamically: import('mammoth').then(...) for code-splitting
  - Render: <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: htmlContent }} />
```

**Security note:** mammoth output is sanitized HTML but dangerouslySetInnerHTML still needs a DOMPurify pass if the documents come from untrusted sources. For Validly's use case (documents uploaded by authenticated users), this is LOW risk but worth noting.

**No schema changes. No backend changes.**

---

### Feature 5: Responsive Layout

**What it needs:**
- Tailwind v4 responsive breakpoints applied to existing page layouts
- Mobile-friendly navigation (collapsible header)

**Current state:** All pages use `max-w-5xl mx-auto` containers with `px-4` padding. The header in `DashboardPage` has a horizontal `flex` row with multiple items that will overflow on mobile. Table-heavy layouts (workflow list, user list) do not have mobile-responsive alternatives.

**Existing code touched:**
- `DashboardPage.tsx` — header flex row: wrap or collapse nav items behind a mobile menu button at `sm:` breakpoint. Tables: use `overflow-x-auto` (already present on some) and consider card layouts at `sm:` for the pending tab.
- `WorkflowDetailPage.tsx` — header flex row same issue. Info bar and action buttons need flex-wrap at mobile.
- `WorkflowCreatePage.tsx` — stepper wizard is likely already scrollable; verify.
- `LoginPage.tsx` / `SignupPage.tsx` — already centered with `max-w-md`, likely already adequate.
- All pages sharing the same header pattern — consider extracting a `PageHeader` component to apply responsive changes once.

**Pattern to follow:**

```tsx
// Current (desktop-only)
<div className="flex items-center gap-4">

// Responsive version
<div className="flex flex-wrap items-center gap-2 sm:gap-4">
  <div className="flex items-center gap-2">
    {/* primary nav */}
  </div>
  <div className="ml-auto flex items-center gap-2">
    {/* secondary nav: bell, locale toggle, email, logout */}
  </div>
</div>
```

**No backend changes. No schema changes. No new routes.**

---

### Feature 6: Error Handling (React Error Boundaries + Error Pages)

**What it needs:**
- React Error Boundaries to catch component render errors
- Dedicated error pages (404, 500, network error)
- Improvement to the existing inline error pattern

**Current state:**
- Network errors surface as `ApiError` thrown from `apiFetch()`, caught by local `try/catch` or TanStack Query's `isError` state. No global boundary.
- `ActionErrorPage` exists for email token errors (`/action/expired`, `/action/used`, `/action/invalid`).
- No 404 page. No 500 / crash page.
- No React Error Boundary wrapping any route.

**New frontend components:**
- `ErrorBoundary.tsx` — class component (React error boundaries must be class components, or use `react-error-boundary` package). Wrap the main `<Routes>` block in `App.tsx` with it.
- `NotFoundPage.tsx` — render on `path="*"` catch-all route in `App.tsx`.
- `ErrorPage.tsx` — generic error page with retry button. Used as fallback in `ErrorBoundary`.
- Optionally install `react-error-boundary` (npm package) to avoid writing a class component.

**Existing code touched:**
- `App.tsx` — add `<Route path="*" element={<NotFoundPage />} />`. Wrap `<Routes>` with `<ErrorBoundary>`.
- `api.ts` — no change needed; `ApiError` is already typed. TanStack Query surfaces errors cleanly.

**No backend changes. No schema changes.**

---

### Feature 7: User Profile Page

**What it needs:**
- A profile page where the logged-in user can update their own name, locale, and password
- A backend route to allow self-service updates (distinct from admin user management)

**Current state:**
- `GET /api/auth/me` returns the profile (id, email, name, role, locale, createdAt).
- `PATCH /api/users/:id` exists but is **admin-only** (`requireAdmin` middleware). Cannot reuse for self-service.
- No self-service profile update route exists.

**New backend components:**
- `PATCH /api/auth/profile` — authenticated (any role), allows updating own `name` and `locale`. Body: `{ name?: string; locale?: string }`. Uses `req.user.sub` from JWT, not a path param (prevents users updating other users' profiles).
- `POST /api/auth/change-password` — authenticated, takes `{ currentPassword: string, newPassword: string }`. Verifies current password with existing `verifyPassword()`, then updates.
- Both routes added to `backend/src/api/routes/auth.ts` (co-located with profile GET).

**Existing code touched:**
- `backend/src/api/routes/auth.ts` — two new route handlers.
- `backend/src/services/auth-service.ts` — add `updateProfile()` and `changePassword()` methods.

**New frontend components:**
- `ProfilePage.tsx` — new page at `/profile`. Shows: name field (editable), locale selector (editable), email (read-only), role (read-only), created at (read-only). Separate sub-form for password change.
- Add profile link in `DashboardPage` header (e.g., clicking the user's email navigates to `/profile`).

**Existing code touched:**
- `App.tsx` — add `<Route path="/profile" element={<AuthGuard><ProfilePage /></AuthGuard>} />`.
- `DashboardPage.tsx` — make email span a `<Link to="/profile">`.
- `useAuth.ts` — after `updateProfile()` mutation succeeds, refetch profile with `fetchProfile()` to update JWT-derived state. Note: locale change does NOT require a new JWT because `useAuth` already stores the locale from the API response, not from the token claims.

**Data flow:**
```
ProfilePage → GET /api/auth/me (existing query)
    │
User edits name/locale → PATCH /api/auth/profile { name, locale }
    → auth-service.updateProfile(userId, { name, locale })
    → prisma.user.update(...)
    → onSuccess: refetch /auth/me → useAuth state updates

User changes password → POST /api/auth/change-password { currentPassword, newPassword }
    → auth-service.changePassword(userId, current, new)
    → verifyPassword(current) → hashPassword(new) → prisma.user.update(password)
    → onSuccess: show success message (no redirect needed)
```

---

## Component Boundaries Map

| Feature | New Files | Modified Files |
|---------|-----------|----------------|
| Password Reset | `PasswordResetToken` (schema), `ForgotPasswordPage.tsx`, `ResetPasswordPage.tsx`, `sendPasswordReset()` (email-service) | `auth.ts` (routes), `auth-service.ts`, `schema.prisma`, `App.tsx` (routes), `LoginPage.tsx` (link), EN+FR locale files |
| Notification Center | `Notification` (schema), `notification-service.ts`, `notifications.ts` (route), `NotificationCenter.tsx`, `useNotifications.ts` | `workflow-service.ts` (creation hooks), `schema.prisma`, `DashboardPage.tsx` (bell icon), `app.ts` (route registration) |
| Comments | `WorkflowComment` (schema), `comment-service.ts`, `CommentThread.tsx` | `workflows.ts` (routes), `schema.prisma`, `WorkflowDetailPage.tsx` |
| DOCX Preview | — | `DocumentPreview.tsx`, `frontend/package.json` (add mammoth) |
| Responsive Layout | Optionally `PageHeader.tsx` | `DashboardPage.tsx`, `WorkflowDetailPage.tsx`, `WorkflowCreatePage.tsx` |
| Error Handling | `ErrorBoundary.tsx`, `NotFoundPage.tsx`, `ErrorPage.tsx` | `App.tsx` |
| User Profile | `ProfilePage.tsx` | `auth.ts` (routes), `auth-service.ts`, `App.tsx` (route), `DashboardPage.tsx` (nav link), `useAuth.ts` |

---

## Build Order (Dependency-Aware)

This order minimizes blocked work between features. Independent features can be built in parallel.

```
STEP 1 — Schema migrations (unblocks all backend work)
  ├── Add PasswordResetToken model
  ├── Add Notification model
  └── Add WorkflowComment model

STEP 2 — Backend-only features (parallel, no frontend dependency)
  ├── 2A: Password reset routes + service + email template
  └── 2B: User profile update routes + service

STEP 3 — Frontend-only features (no new backend required)
  ├── 3A: DOCX preview (mammoth.js in DocumentPreview.tsx)
  ├── 3B: Responsive layout breakpoints
  └── 3C: Error boundaries + 404 page

STEP 4 — Comment thread (backend then frontend)
  ├── 4A: WorkflowComment service + routes
  └── 4B: CommentThread component in WorkflowDetailPage

STEP 5 — Notification center (backend then frontend, most complex)
  ├── 5A: notification-service + routes
  ├── 5B: Hook notification creation into workflow-service events
  └── 5C: NotificationCenter component + useNotifications hook + DashboardPage bell upgrade

STEP 6 — Connect frontend to backend (requires steps 2 + 5)
  ├── ForgotPasswordPage + ResetPasswordPage
  └── ProfilePage
```

**Recommended phase breakdown:**
- Phase 1: Steps 1 + 2 + 3 (schema + backend APIs + frontend-only polish)
- Phase 2: Steps 4 + 5 (comments + notifications — the heavier social features)
- Phase 3: Step 6 frontend completion + i18n completion for all new surfaces

---

## Architectural Patterns for v1.1

### Pattern: Self-Service vs Admin Route Separation

The existing `/api/users/:id PATCH` route is admin-only. The new `/api/auth/profile PATCH` is self-service. Do NOT relax the admin guard on the users route — keep them separate. The self-service route uses `req.user.sub` from the JWT (no path param), making it impossible for one user to update another's profile by accident.

### Pattern: Notification Creation as Side Effect

Notifications are created as a side effect of workflow state transitions, similar to how emails are currently sent. Follow the same pattern: create notifications **after the DB transaction commits**, not inside it. A notification creation failure must not roll back a workflow state change.

```typescript
// In workflow-service.recordAction() — after prisma.$transaction resolves:
try {
  await notificationService.createNotification(...)
} catch (err) {
  console.error('Failed to create notification:', err); // non-critical
}
```

### Pattern: Polling over WebSocket for Notifications

Use `refetchInterval: 30_000` in TanStack Query for the notifications endpoint. This matches the existing `staleTime: 30_000` in the QueryClient config and requires zero new infrastructure. SSE or WebSocket is a post-v1.1 concern.

```typescript
const { data } = useQuery({
  queryKey: ['notifications'],
  queryFn: () => apiFetch<NotificationList>('/notifications?limit=20'),
  refetchInterval: 30_000,
});
```

### Pattern: mammoth.js Dynamic Import for DOCX

Import mammoth lazily to avoid adding it to the initial bundle, since DOCX preview is only triggered when a DOCX document is expanded.

```typescript
// In DocumentPreview.tsx
if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
  const { default: mammoth } = await import('mammoth');
  const result = await mammoth.convertToHtml({ arrayBuffer: buffer });
  setDocxHtml(result.value);
}
```

### Pattern: Error Boundary at Router Level

Wrap `<Routes>` in `App.tsx` with a single top-level Error Boundary. This catches render errors in any page without needing per-page boundaries.

```tsx
// App.tsx
import { ErrorBoundary } from './components/ErrorBoundary';

<QueryClientProvider client={queryClient}>
  <BrowserRouter>
    <ErrorBoundary fallback={<ErrorPage />}>
      <Routes>
        {/* all routes */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </ErrorBoundary>
  </BrowserRouter>
</QueryClientProvider>
```

---

## Anti-Patterns to Avoid

### Anti-Pattern: Reusing ActionToken Model for Password Reset

The `ActionToken` model is coupled to `stepId` and `validatorEmail` — it carries workflow semantics. Password reset tokens are user-account tokens. Create a separate `PasswordResetToken` model. Reuse the SHA-256 hashing pattern from `token-service.ts`, but do not share the model.

### Anti-Pattern: Storing Notifications in Memory or Redis Only

Notifications must survive server restarts and be queryable per-user. Store them in PostgreSQL. Redis is for BullMQ job queuing only — do not put notifications there.

### Anti-Pattern: Allowing Comment Editing or Deletion

The existing platform philosophy is immutability (audit trail is INSERT-only, actions are never deleted). Apply the same to comments. No `PATCH /comments/:id` or `DELETE /comments/:id`. If users need to "retract" a comment, that is a future feature with soft-delete semantics, not a v1.1 concern.

### Anti-Pattern: Embedding the Notification Center in a Separate Page

The notification center should be a slide-out panel or dropdown overlay anchored to the bell icon, not a separate `/notifications` route. A page navigation breaks the workflow — users expect to click a notification and land on the relevant workflow without a full page reload.

### Anti-Pattern: Blocking the Workflow Transaction on Notification Creation

Never call `notificationService.createNotification()` inside a `prisma.$transaction()` block. A notification DB write failure would roll back a completed workflow action. Always create notifications after the transaction commits, wrapped in try/catch.

---

## Integration Points

### New API Routes (v1.1)

| Route | Method | Auth | Description |
|-------|--------|------|-------------|
| `/auth/forgot-password` | POST | None | Request password reset email |
| `/auth/reset-password` | POST | None | Consume token, set new password |
| `/auth/profile` | PATCH | JWT | Update own name/locale |
| `/auth/change-password` | POST | JWT | Update own password |
| `/notifications` | GET | JWT | List notifications for current user |
| `/notifications/:id/read` | PATCH | JWT | Mark one notification read |
| `/notifications/read-all` | PATCH | JWT | Mark all notifications read |
| `/workflows/:id/comments` | GET | JWT | List comments on a workflow |
| `/workflows/:id/comments` | POST | JWT | Post a comment on a workflow |

### New Prisma Models (v1.1)

| Model | Relation | Key Fields |
|-------|----------|------------|
| `PasswordResetToken` | User (many-to-one) | tokenHash, userId, expiresAt, usedAt |
| `Notification` | User (many-to-one), WorkflowInstance | userId, type, workflowId, stepId?, readAt? |
| `WorkflowComment` | WorkflowInstance, User | workflowId, authorId, body, createdAt |

### Frontend New Routes

| Path | Component | Guard |
|------|-----------|-------|
| `/forgot-password` | `ForgotPasswordPage` | None |
| `/reset-password` | `ResetPasswordPage` | None |
| `/profile` | `ProfilePage` | AuthGuard |

### External Library Additions

| Library | Side | Purpose | Bundle Impact |
|---------|------|---------|---------------|
| `mammoth` | Frontend | DOCX to HTML conversion | ~500KB; use dynamic import to keep from main bundle |
| `react-error-boundary` (optional) | Frontend | Error boundary hook/component | ~5KB; alternative to writing class component |

---

## Confidence Assessment

| Area | Confidence | Basis |
|------|------------|-------|
| Integration points | HIGH | Read directly from codebase |
| New model design | HIGH | Follows existing patterns (ActionToken, AuditEvent) |
| Route design | HIGH | Follows existing Fastify route conventions |
| Frontend component boundaries | HIGH | Based on current page/component structure |
| DOCX preview approach | HIGH | mammoth.js is the standard; DocumentPreview pattern is clear |
| Notification polling approach | HIGH | Matches existing TanStack Query usage |
| Build order | HIGH | Dependency graph derived from actual imports |

---

## Sources

All findings from direct codebase inspection:
- `/Users/mmaudet/work/validly/backend/prisma/schema.prisma`
- `/Users/mmaudet/work/validly/backend/src/api/routes/auth.ts`
- `/Users/mmaudet/work/validly/backend/src/services/auth-service.ts`
- `/Users/mmaudet/work/validly/backend/src/services/token-service.ts`
- `/Users/mmaudet/work/validly/backend/src/services/email-service.ts`
- `/Users/mmaudet/work/validly/backend/src/services/workflow-service.ts`
- `/Users/mmaudet/work/validly/backend/src/api/routes/users.ts`
- `/Users/mmaudet/work/validly/frontend/src/App.tsx`
- `/Users/mmaudet/work/validly/frontend/src/lib/api.ts`
- `/Users/mmaudet/work/validly/frontend/src/hooks/useAuth.ts`
- `/Users/mmaudet/work/validly/frontend/src/pages/DashboardPage.tsx`
- `/Users/mmaudet/work/validly/frontend/src/pages/WorkflowDetailPage.tsx`
- `/Users/mmaudet/work/validly/frontend/src/pages/LoginPage.tsx`
- `/Users/mmaudet/work/validly/frontend/src/components/workflow/DocumentPreview.tsx`
- `/Users/mmaudet/work/validly/frontend/package.json`
- `/Users/mmaudet/work/validly/backend/package.json`

---
*Architecture research for: Validly v1.1 UX Polish milestone*
*Researched: 2026-02-20*
