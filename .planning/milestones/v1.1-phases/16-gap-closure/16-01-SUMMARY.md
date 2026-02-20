---
phase: 16-gap-closure
plan: "01"
started: 2026-02-20
completed: 2026-02-20
commits: 3
one_liner: "Fixed all 4 audit gaps plus 1 re-audit gap — comment thread display, mapApiError wiring, MobileNav on all 5 authenticated pages, notification context key"
requirements-completed: [COMM-01, COMM-02, ERR-06, RESP-06, NOTIF-05]
---

# Summary: Plan 16-01 — Gap Closure

## What was done

### Task 1: Fix CommentThread response parsing (COMM-01, COMM-02)
- Removed `CommentsResponse` interface wrapper
- Changed `useQuery<CommentsResponse>` → `useQuery<Comment[]>`
- Changed `data?.comments ?? []` → `data ?? []`
- Comments now display correctly in chronological thread

### Task 2: Wire mapApiError into apiFetch (ERR-06)
- Changed apiFetch throw from raw message to `mapApiError(body.message ?? res.statusText)`
- All API errors now auto-translate through i18n before reaching UI

### Task 3: Add MobileNav to all authenticated pages (RESP-06)
- Added MobileNav to WorkflowDetailPage, TemplateFormPage, ProfilePage
- Re-audit found WorkflowCreatePage also missing — fixed in follow-up commit
- All 5 authenticated pages now have hamburger menu on mobile
- Desktop cancel/back links hidden on mobile via `hidden sm:inline-flex`

### Task 4: Fix notification context key (NOTIF-05)
- Changed `authorEmail: author.email` → `commentAuthor: author.name ?? author.email`
- Added `name: true` to Prisma author select
- NotificationCenter now displays comment author correctly

## Files changed
- `frontend/src/components/workflow/CommentThread.tsx`
- `frontend/src/lib/api.ts`
- `frontend/src/pages/WorkflowDetailPage.tsx`
- `frontend/src/pages/TemplateFormPage.tsx`
- `frontend/src/pages/ProfilePage.tsx`
- `frontend/src/pages/WorkflowCreatePage.tsx`
- `backend/src/services/comment-service.ts`

## Deviations
- WorkflowCreatePage was not in original plan (found during re-audit). Added as follow-up fix using same pattern.
