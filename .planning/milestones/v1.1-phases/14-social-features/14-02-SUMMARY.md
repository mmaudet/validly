---
phase: 14-social-features
plan: 02
subsystem: ui
tags: [react, tanstack-query, i18n, notifications, comments, tailwind]

# Dependency graph
requires:
  - phase: 14-social-features
    provides: REST API for GET/POST /api/workflows/:id/comments, GET /api/notifications, PATCH /api/notifications/read-all, PATCH /api/notifications/:id/read, GET/PUT /api/users/me/notification-prefs; readAt/metadata Notification schema
  - phase: 13-foundation
    provides: ProfilePage, apiFetch with auth, useAuth, TanStack Query setup, i18n setup
provides:
  - useNotifications hook with 30s polling (refetchInterval: 30000), markRead, markAllRead mutations
  - useUnreadCount lightweight hook sharing TanStack Query cache
  - useNotificationPrefs hook with GET/PUT preference management
  - CommentThread component: chronological comments, append-only, disabled on terminal workflows, 403 guard
  - NotificationCenter slide-out panel with type icons, relative timestamps, unread indicators
  - Bell icon with unread badge on DashboardPage and WorkflowDetailPage
  - Notification preferences section on ProfilePage: 5 toggle switches per type
  - EN and FR translations for comments, notifications, notification_prefs
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "useUnreadCount and useNotifications share queryKey ['notifications'] — single TanStack Query cache entry with 30s refetchInterval"
    - "NotificationCenter rendered as slide-out panel via fixed positioning + translate-x transition (NOT a separate route)"
    - "readAt === null check for unread status throughout frontend (not a boolean read field)"
    - "TERMINAL_STATUSES array used in CommentThread to disable input on APPROVED/REFUSED/CANCELLED/ARCHIVED"

key-files:
  created:
    - frontend/src/hooks/useNotifications.ts
    - frontend/src/components/workflow/CommentThread.tsx
    - frontend/src/components/ui/NotificationCenter.tsx
  modified:
    - frontend/src/pages/DashboardPage.tsx
    - frontend/src/pages/WorkflowDetailPage.tsx
    - frontend/src/pages/ProfilePage.tsx
    - frontend/src/i18n/locales/en/common.json
    - frontend/src/i18n/locales/fr/common.json

key-decisions:
  - "Used readAt === null (not read: boolean) for unread checks throughout frontend, matching Phase 13/14-01 backend schema"
  - "useUnreadCount shares queryKey with useNotifications — avoids duplicate polling, both update together"
  - "CommentThread handles 403 with retry: false guard so non-participants see access message instead of spinner loop"
  - "NotificationPrefsSection extracts as standalone component inside ProfilePage.tsx to keep ProfilePage component focused"
  - "Toggle change immediately updates optimistically in UI via setTimeout success indicator, while mutation runs"

patterns-established:
  - "Pattern: Notification unread check always uses readAt === null (null=unread, string=read)"
  - "Pattern: Bell icon + NotificationCenter pair added to each major authenticated page via local useState"

requirements-completed: [COMM-01, COMM-02, COMM-03, COMM-04, COMM-05, NOTIF-01, NOTIF-02, NOTIF-03, NOTIF-04, NOTIF-06, NOTIF-07]

# Metrics
duration: 4min
completed: 2026-02-20
---

# Phase 14 Plan 02: Comments and Notifications Frontend Summary

**React hooks and components delivering comment threads, in-app notification polling with slide-out panel, and per-type notification preferences — wired to the Phase 14-01 REST API**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-20T00:13:55Z
- **Completed:** 2026-02-20T00:17:55Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments
- Comment thread UI below the workflow stepper: chronological, append-only, disabled on APPROVED/REFUSED/CANCELLED/ARCHIVED
- NotificationCenter slide-out panel with type icons, relative timestamps, mark-read and mark-all-read — accessible via bell icon on DashboardPage and WorkflowDetailPage
- 30-second polling via TanStack Query refetchInterval shared between useNotifications and useUnreadCount
- Notification preferences section on ProfilePage: 5 toggle switches persisting to backend via PUT /users/me/notification-prefs
- Full EN and FR translations for all new strings

## Task Commits

Each task was committed atomically:

1. **Task 1: Create useNotifications hook and CommentThread component** - `dbf9c8a` (feat)
2. **Task 2: Create NotificationCenter panel and integrate into DashboardPage + WorkflowDetailPage** - `b828883` (feat)
3. **Task 3: Add notification preferences to profile page and i18n translations** - `dba65d6` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `frontend/src/hooks/useNotifications.ts` - useNotifications (30s polling, markRead/markAllRead), useUnreadCount, useNotificationPrefs hooks; Notification/NotificationPrefs types
- `frontend/src/components/workflow/CommentThread.tsx` - Comment list with chronological display, add-comment textarea, terminal-state guard, 403 handling
- `frontend/src/components/ui/NotificationCenter.tsx` - Slide-out panel with backdrop, type icons (green/red/blue/gray), relative timestamps, unread blue dot, mark-read on click
- `frontend/src/pages/DashboardPage.tsx` - Bell icon opens NotificationCenter (replaces tab-switch behavior); unreadCount badge from useUnreadCount
- `frontend/src/pages/WorkflowDetailPage.tsx` - Bell icon in header + NotificationCenter; CommentThread below initiator actions before audit trail
- `frontend/src/pages/ProfilePage.tsx` - NotificationPrefsSection component with 5 toggle switches using useNotificationPrefs
- `frontend/src/i18n/locales/en/common.json` - Added comments, notifications, notification_prefs sections
- `frontend/src/i18n/locales/fr/common.json` - Added same sections in French

## Decisions Made
- **readAt field throughout:** Used `readAt === null` (not `read: boolean`) consistent with 14-01 backend schema — all UI unread checks use this pattern
- **Shared query key:** useUnreadCount and useNotifications use the same queryKey `['notifications']` so a single poll serves both consumers with no duplicate requests
- **CommentThread 403 handling:** `retry: false` when error is ApiError status 403 — prevents infinite retry loops for non-participants, shows access message immediately
- **NotificationPrefsSection extracted:** Standalone component (not inline in ProfilePage body) to keep concerns separated and allow independent loading state

## Deviations from Plan

None — plan executed exactly as written. The 14-01 backend schema adaptations (readAt/metadata) were pre-specified in the execution prompt; they were applied as designed rather than discovered during execution.

## Issues Encountered
None — frontend build produced zero TypeScript errors across all three tasks. Build completed successfully (1.43s). Pre-existing chunk size warning is unrelated to this plan.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All COMM and NOTIF frontend requirements satisfied
- Phase 14 social features complete (both plans done)
- Phase 15 or remaining v1.1 work can proceed
- Bell icon polling is live; notifications will appear as workflow actions occur

---
*Phase: 14-social-features*
*Completed: 2026-02-20*
