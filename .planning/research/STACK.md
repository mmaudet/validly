# Stack Research

**Domain:** Document validation workflow platform — v1.1 UX polish additions
**Researched:** 2026-02-20
**Confidence:** MEDIUM-HIGH (versions verified via npm search; @fastify/sse Fastify 5 compatibility LOW confidence — see notes)

---

> **Scope:** This document covers ONLY additions and changes needed for v1.1 features. The existing stack
> (Node 22, Fastify 5, Prisma 6, React 19, Vite 6, Tailwind v4, TanStack Query 5, react-hook-form 7,
> react-router 7, i18next, Zod, BullMQ 5, Redis 7, Nodemailer, react-pdf) is validated and NOT re-researched.

---

## New Dependencies by Feature

### Feature 1: Password Reset Email Flow

**Verdict: No new libraries needed.** The existing stack already covers this completely.

| What's needed | Existing solution |
|---------------|-------------------|
| Token generation | `crypto.randomBytes(32).toString('hex')` — Node 22 built-in |
| Email delivery | `nodemailer` (already installed) |
| Email templates | `react-email` / `@react-email/components` (already in stack) |
| Rate limiting | `@fastify/rate-limit` (already installed) |
| Token storage | Prisma 6 + PostgreSQL — new `password_reset_tokens` table |
| Form validation | `react-hook-form 7` + Zod (already installed) |

**Pattern:** Single-use token. Store `HMAC-SHA256(token)` in DB, send raw token in URL. Token expires in 1 hour.
`/auth/forgot-password` → rate-limited by email. `/auth/reset-password/:token` → validates token, hashes new password, marks token used.

---

### Feature 2: In-App Notification Center (Real-Time)

**Recommended approach: Server-Sent Events (SSE) via native Fastify streaming + TanStack Query polling fallback.**

#### Backend: SSE

**Do not use `fastify-sse-v2`** — last published 8+ months ago, Fastify 5 compatibility unconfirmed.
**`@fastify/sse` (official)** — version 0.4.0, last published ~3 months ago (Nov 2025). LOW confidence on Fastify 5 peer compatibility; verify before installing.

**Recommended: Raw Fastify streaming (no plugin dependency):**

```typescript
// No library needed — Fastify 5 supports raw reply streaming
fastify.get('/notifications/stream', async (request, reply) => {
  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  // push via reply.raw.write(`data: ${JSON.stringify(payload)}\n\n`)
  request.raw.on('close', cleanup);
});
```

Caveat: `reply.raw` bypasses Fastify lifecycle hooks. Authenticate via JWT query param or cookie on this route specifically; do not rely on `@fastify/jwt` hook running automatically.

#### Frontend: EventSource API

| What | How |
|------|-----|
| SSE client | Native browser `EventSource` — no library |
| State management | TanStack Query 5 (`useQuery` + `queryClient.invalidateQueries`) |
| UI component | shadcn/ui `Popover` + `ScrollArea` + Badge (unread count) — no new library |
| Polling fallback | TanStack Query `refetchInterval: 30_000` when `EventSource` unavailable |

**No new npm packages required for notifications.**

**DB schema addition:** `notifications` table with `user_id`, `type`, `payload JSONB`, `read_at`, `created_at`.

---

### Feature 3: Workflow Comments/Discussion Thread

**Verdict: No new libraries needed.** Pure UI composition with existing stack.

| What's needed | Existing solution |
|---------------|-------------------|
| Form (post comment) | `react-hook-form 7` + Zod |
| Data fetching | TanStack Query 5 (`useInfiniteQuery` for pagination) |
| Optimistic updates | React 19 `useOptimistic` hook — built-in, no library |
| Timestamps | `date-fns 4` (already in stack) |
| UI components | shadcn/ui `Card`, `Avatar`, `Textarea`, `Button` |
| Mentions (`@user`) | Custom — no library needed for v1.1 (textarea + user search query) |

**Pattern:** Append-only `workflow_comments` table. TanStack Query `useMutation` with `optimisticUpdate` shows comment instantly, rolls back on error. Use `useInfiniteQuery` for cursor-based pagination if thread grows large.

---

### Feature 4: DOCX In-Browser Preview (Client-Side)

**New library needed: `docx-preview`**

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| `docx-preview` | 0.3.7 | Convert DOCX → DOM in browser | Better fidelity than mammoth.js for visual preview. Renders to a container element, preserves layout, tables, styles. 178+ dependents, last published Sep 2025. |
| `dompurify` | 3.3.1 | Sanitize HTML output before DOM insertion | Mandatory. docx-preview and mammoth both warn they do NOT sanitize. User-uploaded DOCX files are untrusted. DOMPurify 3.3.1 is current stable (published Dec 2025, 19M weekly downloads). |

**Why `docx-preview` over `mammoth`:**
- mammoth produces semantic HTML (good for content extraction, loses visual fidelity)
- docx-preview renders a faithful visual representation (tables, columns, page breaks, fonts) — better for document preview use case
- mammoth is already usable for text extraction elsewhere if needed

**Installation:**
```bash
npm install docx-preview dompurify
npm install -D @types/dompurify
```

**Integration pattern:**
```typescript
import { renderAsync } from 'docx-preview';
import DOMPurify from 'dompurify';

// Container ref receives the rendered DOCX DOM
await renderAsync(arrayBuffer, containerRef.current, undefined, {
  className: 'docx-preview',
  injectStylesheet: true,
});
// After render, sanitize the container innerHTML
containerRef.current.innerHTML = DOMPurify.sanitize(containerRef.current.innerHTML);
```

**Note:** react-pdf (already installed) handles PDF previews. docx-preview handles DOCX. Route by file extension/MIME type in a `<DocumentPreview>` component.

---

### Feature 5: Responsive/Mobile Layout

**Verdict: No new libraries needed.** Tailwind v4 already handles this.

**Pattern — Tailwind v4 mobile-first:**

Tailwind v4 uses the same breakpoint system as v3 but configured via CSS `@theme` variables instead of `tailwind.config.js`. No new config file syntax needed:

```css
/* globals.css — already where @theme lives in v4 */
@theme {
  --breakpoint-sm: 40rem;   /* 640px */
  --breakpoint-md: 48rem;   /* 768px */
  --breakpoint-lg: 64rem;   /* 1024px */
}
```

**Key patterns for the dashboard:**

```html
<!-- Sidebar: hidden on mobile, visible on lg+ -->
<aside class="hidden lg:flex lg:w-64 ...">

<!-- Navigation: bottom nav on mobile, left sidebar on desktop -->
<nav class="fixed bottom-0 lg:hidden ...">

<!-- Grid: 1 col mobile, 2 col md, 3 col lg -->
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 ...">
```

shadcn/ui `Sheet` component (already available via shadcn CLI) — use for mobile slide-in navigation. No new library.

**Mobile-specific additions to document preview:** cap container width, use `overflow-x-auto` on docx-preview output since DOCX pages are fixed-width.

---

### Feature 6: Error Boundaries and Error Pages

**New library recommended: `react-error-boundary`**

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| `react-error-boundary` | 6.1.1 | Declarative error boundaries with hooks | React 19 improved error reporting but class-based error boundaries are still required to catch render errors. react-error-boundary eliminates the class boilerplate and provides `useErrorBoundary()` hook for imperative throwing. Actively maintained (6.1.1 published Feb 2026, 1845 dependents). |

**Installation:**
```bash
npm install react-error-boundary
```

**Integration with React 19 and react-router 7:**

```typescript
// Route-level error boundary wrapping each major view
import { ErrorBoundary } from 'react-error-boundary';

<ErrorBoundary
  FallbackComponent={ErrorPage}
  onError={(error, info) => logger.error(error, info)}
  onReset={() => navigate('/')}
>
  <WorkflowDetailPage />
</ErrorBoundary>
```

**React 19 note:** React 19 added `onCaughtError` / `onUncaughtError` / `onRecoverableError` root-level hooks and eliminated duplicate error logging. react-error-boundary 6.x is compatible and recommended over hand-rolling class components.

**Error page components:** Build using shadcn/ui primitives (no library). Standard pages: 404, 500, network error, permission denied.

---

### Feature 7: User Profile/Settings Page

**Verdict: No new libraries needed.** Pure composition of existing stack.

| What's needed | Existing solution |
|---------------|-------------------|
| Form state | `react-hook-form 7` with `defaultValues` from TanStack Query |
| Validation | Zod schema (share with backend) |
| Avatar upload | `@fastify/multipart` (backend already installed) |
| Password change form | react-hook-form + Zod (confirm password cross-field validation) |
| Notification preferences | react-hook-form checkbox fields |
| i18n preference | i18next `changeLanguage()` — already integrated |
| UI | shadcn/ui `Form`, `Input`, `Select`, `Switch`, `Separator`, `Avatar` |

**Pattern:** Two separate `useForm` instances — profile fields and password change. `defaultValues` populated via `useQuery` on user profile endpoint. Dirty-state check via `formState.isDirty` before prompting navigation away.

---

## Recommended Stack Additions (Summary)

### New Frontend Libraries

| Library | Version | Feature | Why |
|---------|---------|---------|-----|
| `docx-preview` | 0.3.7 | DOCX preview | Best client-side DOCX-to-DOM fidelity |
| `dompurify` | 3.3.1 | DOCX/HTML sanitization | Security — DOCX output is untrusted HTML |
| `react-error-boundary` | 6.1.1 | Error boundaries | Eliminates class boilerplate, hooks API |

### New Backend Libraries

**None.** Password reset, notifications, comments all use existing Fastify 5, Prisma 6, nodemailer, BullMQ, and crypto built-ins.

### New DB Tables Required

| Table | Feature | Key Columns |
|-------|---------|-------------|
| `password_reset_tokens` | Password reset | `token_hash`, `user_id`, `expires_at`, `used_at` |
| `notifications` | Notification center | `user_id`, `type`, `payload JSONB`, `read_at`, `created_at` |
| `workflow_comments` | Comment threads | `workflow_id`, `user_id`, `content`, `created_at` |

---

## Installation

```bash
# Frontend — new additions only
npm install docx-preview dompurify react-error-boundary
npm install -D @types/dompurify
```

---

## Alternatives Considered

| Recommended | Alternative | Why Not |
|-------------|-------------|---------|
| `docx-preview` | `mammoth.js` | mammoth produces clean semantic HTML optimized for content extraction, not visual fidelity. For preview use case, docx-preview renders closer to Word's appearance. |
| `docx-preview` | `react-doc-viewer` | react-doc-viewer is a React wrapper around multiple renderers including docx-preview. Adds unnecessary abstraction; use docx-preview directly for control. |
| `docx-preview` | Microsoft Office Online embed | Requires sending document to Microsoft servers — not acceptable for a self-hosted, privacy-first platform. |
| `react-error-boundary` | Custom class component | Class-based error boundaries still work but require 15+ lines of boilerplate per boundary. react-error-boundary is the community standard (1845 dependents, Kent C. Dodds maintainer). |
| Native SSE (raw reply) | `@fastify/sse` plugin | @fastify/sse is at v0.4.0 (experimental versioning) — Fastify 5 peer compatibility is LOW confidence (not verified from official source). Native streaming is 10 lines of code and has no dependency risk. |
| Native SSE | WebSockets | Notifications are unidirectional (server → client). WebSockets add bidirectional complexity and require ws/socket.io libraries. SSE is HTTP/1.1 native, auto-reconnects, works through proxies. |
| Native SSE | TanStack Query polling only | Polling at 30s intervals is acceptable fallback but SSE gives instant notification delivery. Implement SSE with polling fallback for graceful degradation. |

---

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `socket.io` | Bidirectional WebSocket library — overkill for read-only notification push. Adds 80kb+ to bundle, requires socket.io server adapter for Fastify. | Native SSE (raw reply) |
| `mammoth` (for preview) | Strips formatting, produces plain HTML — not suitable for "preview" UX. | `docx-preview` |
| `react-hot-toast` | Sonner is already in the stack (shadcn/ui's recommended toast). Do not add a competing toast library. | `sonner` (already installed) |
| `marked` / `remark` | No Markdown rendering needed for comments in v1.1. Plain text with line breaks is sufficient. Add in v1.2 if users request it. | Plain textarea + `white-space: pre-wrap` |
| `@tanstack/react-virtual` | Virtual scrolling for comment threads — premature optimization. Add only if thread exceeds 200+ items. | `useInfiniteQuery` + native scroll |
| `react-query-devtools` | Already available — just not listed. It ships with `@tanstack/react-query`. | Already included |

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `docx-preview` 0.3.7 | Browser (no Node.js) | Client-side only. Uses ArrayBuffer input from FileReader or fetch. |
| `dompurify` 3.3.1 | Browser + Node.js (with jsdom) | Use browser build in React. @types/dompurify available for TypeScript. |
| `react-error-boundary` 6.1.1 | React 18+, React 19 | 6.x updated for React 19 error hook changes. |
| Native SSE (Fastify 5) | Fastify 5.x, Node 22 | `reply.raw` available in all Fastify versions. Bypasses lifecycle — auth must be explicit. |

---

## Stack Patterns for v1.1

**DOCX preview component structure:**
```
<DocumentPreview file={...}>
  ├── if PDF → <PDFPreview /> (react-pdf, existing)
  └── if DOCX → <DocxPreview /> (docx-preview, new)
      └── sanitize output with DOMPurify after render
```

**Notification architecture:**
```
Backend: SSE endpoint /api/notifications/stream
         Reads from Redis pub/sub channel per user_id
         BullMQ job publishes to Redis on workflow state change

Frontend: EventSource hook → React state → Badge count + Popover list
          TanStack Query refetchInterval=30s as fallback
```

**Error boundary placement:**
```
App root (catches catastrophic failures)
  └── Route layout (catches page-level render errors)
      └── DocumentPreview (catches DOCX parse failures)
      └── CommentThread (catches data errors without breaking page)
```

---

## Sources

- WebSearch: `mammoth` npm — version 1.11.0, browser support confirmed; official warning: "performs no sanitisation"
- WebSearch: `docx-preview` npm — version 0.3.7, published ~Sep 2025 (MEDIUM confidence — npm blocked direct fetch)
- WebSearch: `dompurify` npm — version 3.3.1, published Dec 2025, 19M weekly downloads (MEDIUM confidence)
- WebSearch: `react-error-boundary` npm — version 6.1.1, published Feb 2026, 1845 dependents (MEDIUM confidence)
- WebSearch: `@fastify/sse` npm — version 0.4.0, published ~Nov 2025; Fastify 5 peer compatibility unconfirmed (LOW confidence)
- WebSearch: fastify-sse-v2 — last published 8+ months ago, Fastify 5 compatibility unconfirmed (LOW confidence)
- WebSearch: Fastify raw reply streaming for SSE — documented in official Fastify Reply reference
- react.dev/blog/2024/12/05/react-19 — React 19 error hook additions (onCaughtError, onUncaughtError) confirmed
- tailwindcss.com/docs/responsive-design — v4 breakpoint system via @theme CSS variables confirmed
- shadcn/ui — Sheet, Popover, ScrollArea, Badge, Avatar components confirmed available (CLI install)
- WebSearch: DOMPurify required after mammoth/docx-preview — official mammoth.js README warning confirmed
- WebSearch: useOptimistic hook React 19 — confirmed as built-in, no library needed for comment optimistic updates

---

*Stack research for: Validly v1.1 UX polish — document validation workflow platform*
*Researched: 2026-02-20*
