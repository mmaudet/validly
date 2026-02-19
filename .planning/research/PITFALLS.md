# Pitfalls Research

**Domain:** Document validation workflow platform — UX polish features added to existing Fastify 5 + React 19 + Prisma 6 + PostgreSQL 15 system
**Researched:** 2026-02-20
**Confidence:** HIGH for integration-specific pitfalls (verified against existing codebase); MEDIUM for library-specific behavior (WebSearch verified with official sources)

---

## Critical Pitfalls

### Pitfall 1: apiFetch Always Sets Content-Type: application/json — New Endpoints Break on Empty Body

**What goes wrong:**
The existing `apiFetch` wrapper in `frontend/src/lib/api.ts` unconditionally sets `Content-Type: application/json` for all non-FormData requests. Fastify 5 rejects any request that carries `Content-Type: application/json` with an empty body (error code `FST_ERR_CTP_EMPTY_JSON_BODY`). New endpoints that have no request body — such as "mark all notifications read" (POST with no body), "resend password reset email" (POST with just a path param), or "dismiss notification" — will fail if the frontend sends no body JSON.

This bug has been fixed three times in v1.0. It will be hit again on every new no-body POST or DELETE added in v1.1 unless the root cause is addressed once.

**Why it happens:**
The frontend wrapper was built to always add the header for authenticated JSON endpoints, which is correct for most routes. Empty-body requests are an edge case that slips through code review because the route works fine in Swagger UI (which sends `{}` automatically) but fails from the frontend.

**How to avoid:**
Fix `apiFetch` permanently: only set `Content-Type: application/json` when `options.body` is a non-null, non-undefined, non-empty string. For requests with no body, omit the header entirely. Add a comment in `api.ts` documenting this constraint so future contributors understand why the check exists.

```typescript
// In api.ts — only set Content-Type when there is a body to describe
if (options?.body != null && options.body !== '' && !(options?.body instanceof FormData)) {
  headers['Content-Type'] = 'application/json';
}
```

Alternatively, on the Fastify side: configure a custom content-type parser for `application/json` that treats an empty body as `{}` rather than erroring. This is a one-line plugin registration but must be done before routes are registered.

**Warning signs:**
- "Invalid body" or 400 errors on new POST endpoints with no body
- Works in Swagger UI but fails from the React frontend
- Any route where the handler immediately destructures `req.body` without an explicit body schema

**Phase to address:** Phase: Password Reset or the first new no-body POST endpoint in v1.1. Fix `apiFetch` once at the start of v1.1 work before adding any new endpoints.

---

### Pitfall 2: Prisma Enum Migration Fails Silently in Transactions (PostgreSQL Limitation)

**What goes wrong:**
The existing schema has multiple PostgreSQL enums (`UserRole`, `WorkflowStatus`, `PhaseStatus`, `StepStatus`, `QuorumRule`, `StepExecution`). Adding a new enum value to any of these in Prisma generates a migration that uses `ALTER TYPE ... ADD VALUE`, which **cannot run inside a PostgreSQL transaction block**. Prisma wraps all migrations in transactions by default. The migration will fail with: `ERROR: ALTER TYPE ... ADD cannot run inside a transaction block`. The database is left partially migrated.

Worse: if the new enum value is then used as a column default in the same migration file, it fails with "unsafe use of new value of enum type — new enum values must be committed before they can be used."

For v1.1, this will be triggered when adding notification types, comment status fields, or any new status value to existing enums.

**Why it happens:**
This is a PostgreSQL constraint, not a Prisma bug. Prisma generates the `ALTER TYPE ADD VALUE` inside its standard transaction wrapper without awareness of the constraint. Developers run `prisma migrate dev`, see the error, and are unsure whether the schema is now inconsistent.

**How to avoid:**
Use the expand-and-contract pattern: split the migration into two files. File 1: add the enum value with `-- @db.AlterType` pragma and no transaction. File 2 (separate migration): use the new value as a default. Alternatively, for new enum values, manually edit the generated migration to add `ALTER TYPE ... ADD VALUE` outside the transaction boundary using `-- pragma: no-transaction` at the top of the migration file.

If adding a new enum is avoidable — for example, storing notification type as a string column instead of an enum — do that instead. New Prisma enums are harder to evolve than string columns with application-level validation.

**Warning signs:**
- Adding a new field to `WorkflowStatus`, `PhaseStatus`, or `StepStatus` enums
- `prisma migrate dev` fails on first run but reports partial success
- Error message contains "ADD cannot run inside a transaction block" or "unsafe use of new value"

**Phase to address:** Phase: In-App Notifications (schema change), Phase: Workflow Comments (if comment status is added as an enum). Address at schema design time — choose string columns over new enum values where possible.

---

### Pitfall 3: Password Reset Tokens — Ghost Sessions After Password Change

**What goes wrong:**
After a user changes their password (via the password reset flow or the profile password-change endpoint), existing JWT access tokens issued before the password change remain valid until they expire. If an attacker or an old browser tab has a valid JWT, they retain access even after the password was changed to lock them out. The current auth architecture uses short-lived JWTs backed by refresh tokens stored in the `refresh_tokens` table. The refresh tokens table is correctly deleted on logout, but a password change does not invalidate refresh tokens or access tokens.

**Why it happens:**
JWTs are stateless by design — the server cannot invalidate them mid-lifetime. Refresh token invalidation only happens on explicit logout. Password change is not treated as a security event requiring session termination.

**How to avoid:**
On password change (whether via reset flow or profile endpoint):
1. Delete ALL `refreshToken` rows for the user (`prisma.refreshToken.deleteMany({ where: { userId } })`) — this terminates all refresh-based sessions immediately.
2. Optionally store a `passwordChangedAt` timestamp on the User model, and validate in the JWT middleware that `token.iat > user.passwordChangedAt` — rejecting tokens issued before the password change. This handles the short window where an attacker holds a valid access token.
3. Write an `AuditEvent` with `action: 'PASSWORD_CHANGED'` and `actorEmail` for security audit trail.

The existing `authService.logout()` already does `prisma.refreshToken.deleteMany({ where: { userId } })` — call this from the password change handler.

**Warning signs:**
- Password change handler does not call `refreshToken.deleteMany`
- No `passwordChangedAt` field on User model
- Test: change password in tab A, use old token in tab B — old tab should get 401 on next refresh attempt within minutes

**Phase to address:** Phase: Password Reset. Must be in the same implementation that ships password change.

---

### Pitfall 4: Password Reset TOCTOU — Token Valid/Consumed Race Condition

**What goes wrong:**
The password reset flow has two steps: (1) validate the token, (2) consume the token and change the password. If these are not atomic, two simultaneous requests with the same token can both pass validation and both consume it — resetting the password twice, potentially to two different values (whichever write wins last), and leaving the audit trail with a duplicate event.

The existing `tokenService.resolveToken()` reads-then-updates in two separate Prisma calls (no transaction). For password reset tokens, this same pattern will have the same vulnerability.

**Why it happens:**
The `findUnique` + `update` sequence is not atomic. Two simultaneous requests both execute `findUnique`, both see `usedAt = null`, both proceed, then both execute `update`. The second update overwrites the first. This is a classic check-then-act race.

**How to avoid:**
Use `prisma.$transaction` with `updateOne WHERE usedAt IS NULL` and check the return count:
```typescript
// Atomic: only succeeds if usedAt was NULL at update time
const result = await prisma.passwordResetToken.updateMany({
  where: { tokenHash, usedAt: null, expiresAt: { gt: new Date() } },
  data: { usedAt: new Date() },
});
if (result.count === 0) {
  return { valid: false, reason: 'already_used_or_expired' };
}
```
This collapses validate+consume into a single atomic operation. Only one request can get `count === 1`.

**Warning signs:**
- Password reset token validation is a `findUnique` followed by a separate `update`
- No database unique constraint on `(tokenHash, usedAt)` preventing double-consume
- Concurrent test: send two simultaneous reset requests with the same token — if both succeed, the race exists

**Phase to address:** Phase: Password Reset. This must be built correctly from the start — it cannot be patched after-the-fact without invalidating existing reset flows.

---

### Pitfall 5: In-App Notifications — N+1 on Unread Count + Per-Workflow Notifications

**What goes wrong:**
The most common in-app notification anti-pattern: the dashboard renders a list of workflows, and for each workflow it fires a separate query to get "unread notification count" for that workflow. With 20 workflows on the dashboard, that is 21 queries (1 list + 20 counts). The page feels fast in dev (single user, empty DB) but slows dramatically in production.

A second variant: the notification bell fetches a full list of notification objects on every page navigation, including notification body text for 50+ notifications, when only the count matters for the bell badge.

**Why it happens:**
The notification model is added incrementally — first the list, then the count, then the per-workflow badge. Each feature is built standalone without considering aggregate query shape.

**How to avoid:**
- Fetch unread count as a single aggregated query: `SELECT COUNT(*) FROM notifications WHERE user_id = ? AND read_at IS NULL` — one query regardless of workflow count.
- For the notification bell, return only `{ unreadCount: number }` from a dedicated lightweight endpoint. Full notification list is a separate endpoint only loaded when the user opens the notification panel.
- Add `@@index([userId, readAt])` to the notifications table from day one.
- Use TanStack Query with a 30-second stale time for the unread count — do not poll every 5 seconds unless the user has the panel open.

**Warning signs:**
- N+1 visible in Prisma query logs on the dashboard page (prisma `DEBUG` logging shows repeated notification queries)
- Notification fetch returns full message bodies when only counts are needed in the UI
- Dashboard load time grows linearly with number of workflows visible

**Phase to address:** Phase: In-App Notifications. Schema design and API shape must be decided before building the React component.

---

### Pitfall 6: mammoth.js DOCX Preview — XSS via Unsanitized HTML Output

**What goes wrong:**
mammoth.js converts DOCX to HTML. The official documentation explicitly states: "Mammoth performs no sanitisation of the source document, and should therefore be used extremely carefully with untrusted user input." If the converted HTML is set via `dangerouslySetInnerHTML` without sanitization, a malicious DOCX containing embedded HTML or script fragments can execute JavaScript in the browser under the context of the logged-in user — stealing JWT tokens from localStorage, making authenticated API calls, or exfiltrating document content.

Since Validly accepts user-uploaded DOCX files from validators and initiators who may not be fully trusted (or whose files may be compromised), this is a real attack surface.

**Why it happens:**
Developers see mammoth.js return a string of HTML and use `dangerouslySetInnerHTML={{ __html: html }}` directly. The name "dangerous" is ignored because the content looks safe in testing (their own test documents have no scripts).

**How to avoid:**
Always pipe mammoth.js output through DOMPurify before rendering:
```typescript
import DOMPurify from 'dompurify';

const result = await mammoth.convertToHtml({ arrayBuffer });
const safeHtml = DOMPurify.sanitize(result.value, {
  ALLOWED_TAGS: ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'strong', 'em', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'br', 'span'],
  ALLOWED_ATTR: [],
});
// Only then: dangerouslySetInnerHTML={{ __html: safeHtml }}
```
Keep DOMPurify updated — browser parsing edge cases occasionally bypass older versions.

**Warning signs:**
- `dangerouslySetInnerHTML={{ __html: mammothResult.value }}` without a sanitization step
- No DOMPurify in `frontend/package.json` dependencies
- Test: upload a DOCX with `<script>alert(1)</script>` embedded in a field — if alert fires, XSS is present

**Phase to address:** Phase: DOCX Preview. Non-negotiable from the first commit of the preview feature.

---

### Pitfall 7: mammoth.js DOCX Preview — Detached ArrayBuffer (Mirrors react-pdf Bug Already Fixed in v1.0)

**What goes wrong:**
v1.0 already encountered and fixed "ArrayBuffer detachment" with react-pdf. mammoth.js has the same vulnerability: if the ArrayBuffer is obtained from a `FileReader` result and the File input is cleared (or the component unmounts and re-mounts), the ArrayBuffer may be detached before mammoth processes it. The conversion call throws `TypeError: Cannot perform %TypedArray%.prototype.set on a detached ArrayBuffer`.

**Why it happens:**
React's strict mode double-invokes effects, which can cause two simultaneous mammoth conversion attempts on the same ArrayBuffer. The first run detaches the buffer from the second. The fix applied in v1.0 for react-pdf (copying to `Uint8Array` first) must be consciously applied for mammoth too, because it is a different component and developers may not know the prior fix exists.

**How to avoid:**
Copy the ArrayBuffer to a new Uint8Array before passing to mammoth:
```typescript
const arrayBuffer = await file.arrayBuffer();
const safeCopy = arrayBuffer.slice(0); // creates a new, undetached copy
const result = await mammoth.convertToHtml({ arrayBuffer: safeCopy });
```
Alternatively, use `mammoth.convertToHtml({ path: filePath })` on the server side and return sanitized HTML via API, avoiding client-side ArrayBuffer handling entirely.

**Warning signs:**
- `TypeError: Cannot perform %TypedArray%.prototype.set on a detached ArrayBuffer` in browser console
- Preview renders correctly once but fails on second open
- Component state includes raw `ArrayBuffer` stored in React state (buffers should not be stored in state)

**Phase to address:** Phase: DOCX Preview. Apply the `arrayBuffer.slice(0)` pattern from the start — reference the react-pdf fix in v1.0 as precedent.

---

### Pitfall 8: Workflow Comments — Triggering Notification Loops

**What goes wrong:**
When a user posts a comment on a workflow, the system sends notifications to other participants. If those notifications are also workflow events, they trigger notification creation for the commenter. If the notification creation itself sends emails via BullMQ and those emails contain reply links that, on click, create more events — a loop forms. More practically: a comment notification queues an email job; the email job queues a "reminder" job for unread notifications; the reminder fires and queues another email. With misconfigured retry logic, the loop runs until the dead letter queue or Redis is full.

**Why it happens:**
Notification triggers are added incrementally: "notify on comment" is added first, then "remind on unread notification" is added later. The interaction between them is not mapped before building either.

**How to avoid:**
Map the full notification event graph before writing any code:
```
User posts comment
  → Notify other participants (one-time)
  → Do NOT notify the commenter
  → Do NOT create a "new notification" event that itself triggers notifications
```
Add a `notificationType` field that distinguishes user-generated events from system-generated events. System-generated notifications (unread reminders, deadline alerts) must never themselves trigger further notifications. In BullMQ, use `UnrecoverableError` for notification jobs that fail because the user does not exist — do not retry indefinitely.

**Warning signs:**
- BullMQ queue depth grows without bound after a comment is posted
- Redis memory consumption spikes after the notifications feature ships
- Email logs show the same user receiving 10+ identical "you have unread notifications" emails in rapid succession

**Phase to address:** Phase: Workflow Comments + Phase: In-App Notifications. Design the notification event graph across both features before building either.

---

### Pitfall 9: Responsive Layout — Tailwind Mobile-First Breaks Existing Desktop-Built Classes

**What goes wrong:**
The existing frontend was built desktop-first without responsive prefixes. The layout assumes full-width containers, fixed sidebar widths, and horizontal navigation. Adding responsive Tailwind classes retroactively — using `md:` and `lg:` prefixes — has a counterintuitive effect: in Tailwind v4's mobile-first system, a class like `hidden md:flex` means "hidden on mobile, flex on md and above." Existing desktop classes without prefixes already apply at all breakpoints. Developers adding mobile styles by adding `sm:` prefixes to existing classes will find those classes now override at small screens but leave desktop behavior unchanged — leading to inconsistent layouts.

The deeper trap: components with fixed pixel widths (e.g., `w-96`, `w-128`) do not adapt. Sidebar navigation that is always visible on desktop becomes unusable on mobile without explicit handling. Attempting to add responsive sidebar toggle logic after the fact requires restructuring multiple components simultaneously.

**Why it happens:**
v1.0 was built for desktop users of a document validation tool — mobile was not a priority. Making it responsive is now a retrofit, which is always harder than building mobile-first. Developers underestimate how many components have hardcoded widths and fixed layouts.

**How to avoid:**
- Audit all existing components for hardcoded pixel widths before adding any responsive classes. Replace `w-96` with `w-full md:w-96` and `flex-row` container layouts with `flex-col md:flex-row`.
- Build the responsive navigation (hamburger menu, mobile sidebar toggle) as a standalone component first, then integrate — do not attempt to modify existing nav while also building other responsive changes.
- Test at three breakpoints during development: 375px (mobile), 768px (tablet), 1280px (desktop). Verify desktop layout is unchanged before shipping.
- Use visual regression snapshots of existing desktop pages before touching any layout component.

**Warning signs:**
- Desktop layout shifts or breaks after adding `sm:` classes to existing elements
- Sidebar or navigation disappears on desktop after mobile styles are added
- `w-[fixed]` Tailwind classes present in layout files (these do not adapt)

**Phase to address:** Phase: Responsive Layout. This phase should be last among the UX polish features — changing layout structure can break other features (notifications panel, comment drawers, DOCX preview modal) that were built assuming a fixed layout.

---

### Pitfall 10: React Error Boundaries Do Not Catch Async Errors or Event Handler Errors

**What goes wrong:**
Error boundaries in React only catch errors that occur during synchronous rendering. They do not catch: (1) errors thrown inside async functions (`async () => { throw new Error() }` inside `useEffect`), (2) errors thrown inside event handlers (`onClick`, `onChange`), (3) errors in `apiFetch` calls that are not explicitly caught. When the DOCX preview conversion fails, the notification polling throws a network error, or the comment submission hits a 500 — the error boundary wrapping the component does not intercept it. The error is silently swallowed or causes an unhandled promise rejection in the browser console.

**Why it happens:**
Developers add an `<ErrorBoundary>` wrapper and assume it covers all errors. The boundary only covers render-phase errors. Async errors in effects and event handlers require explicit `try/catch` and manual error state management.

**How to avoid:**
For async errors in event handlers and effects, use the `useErrorBoundary` hook from `react-error-boundary` (or manually propagate via `setState`):
```typescript
import { useErrorBoundary } from 'react-error-boundary';

function DocxPreview({ fileId }) {
  const { showBoundary } = useErrorBoundary();

  async function loadPreview() {
    try {
      const buffer = await fetchDocumentBuffer(fileId);
      const result = await mammoth.convertToHtml({ arrayBuffer: buffer.slice(0) });
      setHtml(DOMPurify.sanitize(result.value));
    } catch (err) {
      showBoundary(err); // propagates to nearest ErrorBoundary
    }
  }
}
```
Every new feature in v1.1 that involves an async operation visible to the user needs explicit error handling — not just a top-level boundary.

**Warning signs:**
- `apiFetch` call result is awaited inside `useEffect` without a `try/catch`
- Component shows a loading spinner indefinitely when the API fails (error was swallowed)
- Browser console shows "Unhandled promise rejection" with no UI feedback to the user
- Error boundary wraps a component but async fetch errors still show blank screens

**Phase to address:** Phase: Error Handling (dedicated phase). Also enforce as a code review requirement for DOCX Preview, Notifications, and Comments phases.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Polling for notifications instead of SSE | Simpler to implement; no new server infrastructure | Database load grows linearly with active users × poll interval; stale data up to poll interval | Acceptable for MVP if poll interval is ≥ 30s and user count is < 500 |
| Storing password reset tokens with same pattern as action tokens (in existing `ActionToken` table) | No new migration | Token purposes mixed; audit trail harder to query; different expiry semantics | Never — create a dedicated `PasswordResetToken` table with its own expiry and scoping |
| Using `dangerouslySetInnerHTML` without DOMPurify | One fewer dependency | XSS attack surface on every document preview | Never |
| Skipping session invalidation on password change | Simpler implementation | Ghost session vulnerability — attacker retains access after victim changes password | Never |
| Adding responsive CSS without first snapshotting existing desktop layout | Faster to skip | Regressions in desktop layout not caught until end-to-end test or user report | Never — capture baseline first |
| One giant `notifications` table for all event types | Simpler schema | Hard to add notification-type-specific fields; hard to query by category | Acceptable for v1.1 if notification types are stored as a string column and not an enum |
| Rendering mammoth.js output server-side and caching HTML | Eliminates client-side conversion cost and ArrayBuffer issues | Requires storage for cached HTML; cache invalidation complexity | Recommended for v1.2+ if files are large; acceptable to do client-side conversion in v1.1 |

---

## Integration Gotchas

Common mistakes when connecting new features to the existing v1.0 system.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Password reset → existing auth routes | Adding reset route to `auth.ts` alongside login/signup, causing Fastify plugin encapsulation issues with `setErrorHandler` | Password reset is its own route file; register separately; do not assume parent error handler scope |
| Notifications → existing `WorkflowAction` events | Triggering notifications by listening to `WorkflowAction` creates in the service layer — creating coupling between two independent concerns | Notifications read from a dedicated `Notification` model; workflow service writes to both `WorkflowAction` and `Notification` explicitly |
| Notifications → BullMQ email jobs | Queuing an email job from inside a notification creation that was itself triggered by an email action — creating a feedback loop | Distinguish event source: jobs triggered by email actions must not queue further user-facing notification emails |
| DOCX preview → document download endpoint | Calling `GET /api/documents/:id/download` which returns a signed URL, then fetching the binary from that URL with `apiFetch` — which sets `Content-Type: application/json` on a binary fetch | Use raw `fetch()` (not `apiFetch`) for binary document downloads; `apiFetch` is only for JSON API calls |
| Comments → `WorkflowAction` table | Storing comments in the existing `WorkflowAction.comment` nullable column instead of a dedicated table | `WorkflowAction.comment` is a decision comment (approve/refuse rationale); freeform workflow comments need their own `WorkflowComment` model with threading support |
| User profile update → JWT claims | Updating `name`, `locale`, or `role` in the DB but not invalidating existing JWTs — frontend shows stale profile data until token expires | On profile update, return a new access token with updated claims; or force re-fetch of `/auth/me` after profile mutation |

---

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Polling notifications every 5s per user | Database CPU spikes during business hours; identical queries repeated in pg logs | Use 30s stale time in TanStack Query; consider SSE for users actively viewing dashboard | ~50 concurrent active users |
| mammoth.js client-side conversion of files > 5MB | Browser tab freezes during conversion; main thread blocked; UI unresponsive | Off-load to a Web Worker or convert server-side; limit preview to first N pages | Files > 3MB on low-end hardware |
| Fetching all notifications (unread + read) for badge count | Badge query returns 200+ rows just to display "99+" | Dedicated `COUNT` endpoint for badge; paginate notification list separately | ~100 notifications per user |
| Eager-loading all workflow participants to send comment notifications | N+1 email sends when a comment is posted on a high-participant workflow | Batch email dispatch via BullMQ; one job per recipient, not one query per recipient | Workflows with > 10 participants |
| DOCX preview rendered in a visible `<div>` even when modal is closed | mammoth conversion runs even when user never opens the preview | Lazy-load preview on modal open; do not pre-convert on page load | Always (wasted compute for unused previews) |

---

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Password reset token stored in plaintext `ActionToken` table | DB compromise exposes all pending reset links directly; attacker can reset any account | Create dedicated `PasswordResetToken` table; store `tokenHash` (SHA-256), never raw token; mirror existing `ActionToken` security pattern |
| Password reset endpoint vulnerable to user enumeration | Attacker can determine which emails are registered by comparing response times or messages | Return identical response body and status code for both registered and unregistered emails; use constant-time path that always writes to DB (e.g., insert a dummy token for unknown emails, or use `await delay()` to equalize timing) |
| mammoth.js HTML output rendered without DOMPurify | XSS from malicious DOCX file; token theft from localStorage; authenticated API abuse | Always sanitize via `DOMPurify.sanitize()` before `dangerouslySetInnerHTML` |
| Password change does not invalidate existing sessions | Ghost session: attacker retains access after victim locks them out | `prisma.refreshToken.deleteMany({ where: { userId } })` on every password change; optionally add `passwordChangedAt` JWT claim check |
| Comment content not sanitized before storage or display | Stored XSS in workflow comment thread | Sanitize on write (strip HTML) or sanitize on read (DOMPurify before render); do not trust comment text as safe HTML |
| Notifications expose data from workflows the user is no longer a participant in | Data leakage if user role or workflow access is revoked | Notification read access must be checked against current role/access, not just notification ownership |

---

## UX Pitfalls

Common user experience mistakes specific to these features.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Password reset email arrives but link is already expired by the time user reads email | User cannot reset password; must request again with no guidance | Set reset token expiry to 2 hours minimum (not 15 minutes); display time remaining on the confirmation page; include "link expires in 2 hours" in the email |
| Notification bell badge shows stale count after user reads notifications in the panel | User sees "3 unread" badge after reading — confusing | Optimistically decrement badge count on mark-as-read in TanStack Query mutation; invalidate notification count cache after mutation resolves |
| DOCX preview shows "converting..." with no timeout or error state | Infinite spinner for large files or format errors — user thinks UI is broken | Add a 10-second conversion timeout; show a "Preview unavailable for this document — download to view" fallback |
| Comment box appears in workflow regardless of workflow status | Users can post comments on APPROVED or REFUSED workflows — comments go unread | Disable comment input when `workflow.status` is a terminal state (`APPROVED`, `REFUSED`, `CANCELLED`, `ARCHIVED`); show "Workflow closed — comments disabled" message |
| Responsive layout shifts existing desktop navigation without a mobile alternative | Desktop users see broken nav during transition; mobile users see no nav at all | Build mobile nav first in isolation; use `hidden md:block` / `block md:hidden` pairs consistently; test desktop layout unchanged before merging |
| Profile password change succeeds but user is not informed other sessions were terminated | User is confused when their phone app is logged out | Display explicit message: "Password changed. All other devices have been signed out for your security." |

---

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Password Reset:** Token is hashed before storage (not plaintext); expiry enforced; timing-safe response for unknown emails; all existing refresh tokens deleted on successful reset; audit event written
- [ ] **Password Reset:** TOCTOU race condition prevented — token consume is an atomic `updateMany WHERE usedAt IS NULL`, not a read-then-update
- [ ] **In-App Notifications:** Unread count is a single aggregated `COUNT` query, not N per-workflow queries; badge uses separate lightweight endpoint from full notification list
- [ ] **In-App Notifications:** Notification loop impossible — system-generated notifications do not themselves trigger further notifications; BullMQ jobs have bounded retry counts with `UnrecoverableError` for non-transient failures
- [ ] **Workflow Comments:** Comments stored in a dedicated table (not `WorkflowAction.comment`); comment input disabled on terminal-state workflows; comment notification does not notify the commenter
- [ ] **DOCX Preview:** mammoth.js output piped through DOMPurify before `dangerouslySetInnerHTML`; ArrayBuffer copied via `.slice(0)` before conversion; conversion timeout set (≤ 10s); fallback shown on failure
- [ ] **Responsive Layout:** Desktop layout visually regression-tested at 1280px before and after changes; mobile navigation built before responsive CSS is applied to existing components; no hardcoded pixel widths remain in layout files
- [ ] **Error Handling:** Every async operation in every new component has explicit `try/catch`; errors are propagated to ErrorBoundary via `showBoundary()`, not swallowed; no component shows infinite loading spinner on API failure
- [ ] **User Profile:** Password change invalidates all refresh tokens; new access token returned after profile mutation; `passwordChangedAt` audit event written
- [ ] **apiFetch fix:** `Content-Type: application/json` only set when `body` is non-null and non-empty — verified with a no-body POST endpoint from the frontend (not just Swagger UI)

---

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| apiFetch Content-Type regression on new endpoint | LOW | Identify the new no-body endpoint; add `body: '{}'` to the frontend call as emergency fix; then properly fix `apiFetch` check; no DB migration required |
| Prisma enum migration leaves DB in partial state | MEDIUM | Run `prisma migrate resolve --applied [migration_name]` to mark partial as complete; manually apply the failed SQL outside a transaction via `psql`; test schema integrity |
| Password reset ghost session discovered | HIGH | Force-expire all refresh tokens for all users (`prisma.refreshToken.deleteMany({})` in a one-time script); notify users they must re-login; patch password change handler immediately |
| XSS via mammoth.js output in production | HIGH | Immediately disable DOCX preview feature flag; audit if any malicious DOCX was uploaded by untrusted users; add DOMPurify; re-enable after fix |
| Notification loop fills BullMQ queue | MEDIUM | Pause the notification queue in BullMQ (Bull Board or Redis CLI); drain the queue; identify and fix the triggering condition; add `UnrecoverableError` guards; resume queue |
| Responsive layout breaks desktop in production | LOW-MEDIUM | Revert the layout change via git; desktop is primary audience — revert is acceptable; rebuild mobile styles more carefully with regression tests |
| Password reset token timing attack exposed | MEDIUM | Add constant-time delay to the unknown-email code path; rotate existing outstanding reset tokens as precaution; the attack is low-severity but must be patched before next audit |

---

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| apiFetch Content-Type empty body (recurring) | First phase of v1.1 — fix before any new endpoints | Test: POST to new no-body endpoint from React frontend returns 2xx, not 400 |
| Prisma enum migration failure | Schema design for each phase — prefer string columns | Test: `prisma migrate dev` succeeds cleanly on fresh database for all migrations |
| Password reset ghost sessions | Phase: Password Reset | Test: change password, attempt token refresh with old refresh token — must get 401 |
| Password reset TOCTOU | Phase: Password Reset | Concurrent test: two simultaneous reset requests with same token — only one succeeds |
| Notification N+1 queries | Phase: In-App Notifications | Verify: dashboard loads with exactly 2 notification queries (count + recent list), not N+1 |
| mammoth.js XSS | Phase: DOCX Preview | Test: upload DOCX with `<script>alert(1)</script>` in content — no alert fires |
| ArrayBuffer detachment | Phase: DOCX Preview | Test: open preview, close, reopen — no TypeError in console |
| Notification loop | Phase: Notifications + Comments (joint design) | Test: post a comment, verify BullMQ queue depth returns to 0 within 60s |
| Responsive layout regression | Phase: Responsive Layout (last among UX phases) | Visual regression snapshot at 1280px — no diff from pre-phase baseline |
| Async error swallowing | Phase: Error Handling (dedicated phase) | Test: kill API server mid-operation — every component shows an error message, not a spinner |
| Profile update JWT staleness | Phase: User Profile | Test: update name, verify next API call reflects new name without re-login |
| Ghost session after password change | Phase: Password Reset + User Profile | Test: change password in tab A, verify tab B's refresh token returns 401 within one refresh cycle |

---

## Sources

- [FST_ERR_CTP_EMPTY_JSON_BODY — Fastify GitHub Issue #5148](https://github.com/fastify/fastify/issues/5148) — known empty body error with `Content-Type: application/json` (HIGH confidence — official issue tracker)
- [mammoth.js official repository — mwilliamson/mammoth.js](https://github.com/mwilliamson/mammoth.js) — "Mammoth performs no sanitisation" documented in official README (HIGH confidence)
- [Prisma Enum Migration Issue #5290](https://github.com/prisma/prisma/issues/5290) and [Issue #8424](https://github.com/prisma/prisma/issues/8424) — ALTER TYPE ADD VALUE transaction block failure and new value commit requirement (HIGH confidence — Prisma official issue tracker)
- [DOMPurify — cure53/DOMPurify](https://github.com/cure53/DOMPurify) — recommended sanitizer for HTML output (HIGH confidence — OWASP-endorsed)
- [OWASP Cross-Site Scripting Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html) — HTML sanitization requirement for untrusted content (HIGH confidence)
- [Ghost Session vulnerability — Medium: Your Password Changed But Your Old Sessions Didn't](https://medium.com/@mr.nt09/your-password-changed-but-your-old-sessions-didnt-the-ghost-session-bug-and-how-to-kill-it-0f0f7a8de6dc) — JWT invalidation on password change pattern (MEDIUM confidence)
- [JWT Lifecycle Management — skycloak.io](https://skycloak.io/blog/jwt-token-lifecycle-management-expiration-refresh-revocation-strategies/) — refresh token revocation on password change (MEDIUM confidence)
- [TOCTOU Race Condition in Password Reset — PortSwigger Web Security Academy](https://portswigger.net/web-security/race-conditions) — atomic token consume pattern (HIGH confidence — official security reference)
- [Drupal Password Reset Race Condition — drupal.org Issue #3367493](https://www.drupal.org/project/drupal/issues/3367493) — real-world TOCTOU in reset flow (MEDIUM confidence)
- [React Error Boundaries cannot catch async errors — Medium: Why React Error Boundaries Can't Catch Asynchronous Errors](https://medium.com/@bloodturtle/why-react-error-boundaries-cant-catch-asynchronous-errors-28b9cab07658) — error boundary limitation (HIGH confidence — matches official React docs behavior)
- [react-error-boundary useErrorBoundary hook — bvaughn/react-error-boundary GitHub](https://github.com/bvaughn/react-error-boundary) — propagating async errors to boundary (HIGH confidence)
- [BullMQ UnrecoverableError — BullMQ docs](https://docs.bullmq.io/patterns/stop-retrying-jobs) — preventing infinite retry loops (HIGH confidence — official BullMQ documentation)
- [Timing Attack on Node.js string comparison — sqreen.github.io](https://sqreen.github.io/DevelopersSecurityBestPractices/timing-attack/nodejs) — `crypto.timingSafeEqual` for constant-time comparison (HIGH confidence — the existing `auth-service.ts` already correctly uses `timingSafeEqual`)
- [Prisma N+1 query optimization — Prisma official docs](https://docs.prisma.io/docs/orm/prisma-client/queries/advanced/query-optimization-performance) — aggregate queries vs per-row queries (HIGH confidence — official documentation)
- Existing codebase inspection: `frontend/src/lib/api.ts`, `backend/src/services/auth-service.ts`, `backend/src/services/token-service.ts`, `backend/src/services/user-service.ts`, `backend/prisma/schema.prisma`, `backend/src/app.ts` — direct code analysis (HIGH confidence — first-party source)

---
*Pitfalls research for: Validly v1.1 UX Polish — Password Reset, Notifications, Comments, DOCX Preview, Responsive Layout, Error Handling, User Profile*
*Researched: 2026-02-20*
