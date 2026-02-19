---
phase: 10-am-liorer-gestion-demandes-et-ux
plan: "05"
subsystem: frontend
tags: [react, tanstack-query, react-hook-form, i18n, admin, rbac]
dependency-graph:
  requires:
    - "10-01: UserRole enum ADMIN/INITIATEUR/VALIDATEUR"
    - "10-02: GET /users, POST /users, PATCH /users/:id, DELETE /users/:id API endpoints"
  provides:
    - AdminUsersPage with full CRUD (create/edit/delete users)
    - /admin/users route with AuthGuard + role guard
    - ADMIN-only nav link in DashboardPage
    - ConfirmDialog reusable component
  affects:
    - frontend/src/App.tsx (route added)
    - frontend/src/pages/DashboardPage.tsx (nav link)
tech-stack:
  added: []
  patterns:
    - useQuery + useMutation for user CRUD
    - react-hook-form for create/edit forms
    - Role guard pattern: check user.role !== 'ADMIN', redirect to dashboard
    - Inline confirm dialog modal for delete confirmation
    - 409 error handling for last-admin and email-exists cases
key-files:
  created:
    - frontend/src/pages/AdminUsersPage.tsx
    - frontend/src/components/ui/ConfirmDialog.tsx
  modified:
    - frontend/src/App.tsx
    - frontend/src/pages/DashboardPage.tsx
    - frontend/src/i18n/locales/en/common.json
    - frontend/src/i18n/locales/fr/common.json
decisions:
  - "ConfirmDialog created as standalone reusable component in components/ui/ (used by both AdminUsersPage and WorkflowDetailPage)"
  - "AdminUsersPage has inline role guard (not a separate HOC) — simpler given single use"
  - "Role badges: ADMIN=purple, INITIATEUR=blue, VALIDATEUR=green (consistent with brand)"
metrics:
  duration: 4m
  completed: "2026-02-19"
  tasks: 1
  files-changed: 6
---

# Phase 10 Plan 05: Admin Users Page + Phase 10 End-to-End Verification Summary

**One-liner:** Admin user management page (CRUD via react-hook-form + TanStack Query) with role-based access guard, nav link, and ConfirmDialog component — plus end-to-end verification checkpoint pending.

## What Was Built

### Task 1: AdminUsersPage with CRUD, route, and nav link

**`frontend/src/pages/AdminUsersPage.tsx`** — Full admin user management page:
- Users table with columns: Name, Email, Role (colored badge), Created date, Actions (edit/delete)
- Role badges: ADMIN=purple, INITIATEUR=blue, VALIDATEUR=green
- Loading state: animated skeleton rows (5 placeholder rows)
- Empty state: "No users found" / "Aucun utilisateur trouvé"
- Create user modal (react-hook-form): email, name, password, role select, locale select
- Edit user modal (react-hook-form): name, role, locale (password not editable)
- Delete with ConfirmDialog: "Delete user?" / "This user will be permanently removed."
- 409 error handling: last-admin guard ("Cannot delete the last administrator") and email-exists ("This email is already in use")
- Role guard: `user.role !== 'ADMIN'` → `navigate('/')` redirect

**`frontend/src/App.tsx`** — Route registered:
- `<Route path="/admin/users" element={<AuthGuard><AdminUsersPage /></AuthGuard>} />`

**`frontend/src/pages/DashboardPage.tsx`** — Nav link:
- `{user?.role === 'ADMIN' && <Link to="/admin/users">{t('nav.users')}</Link>}` visible only to ADMIN users

**`frontend/src/components/ui/ConfirmDialog.tsx`** — Reusable confirm dialog:
- Props: `open`, `title`, `message`, `confirmLabel`, `cancelLabel`, `variant` (danger/default), `onConfirm`, `onCancel`
- Used by both AdminUsersPage (delete user) and WorkflowDetailPage (cancel workflow)

**i18n** (EN + FR):
- `nav.users`: "Users" / "Utilisateurs"
- `admin.*` namespace: 16 keys covering all UI text (title, buttons, fields, role names, errors)

### Task 2: End-to-End Verification Checkpoint (PENDING)

This plan has `autonomous: false` and Task 2 is a `checkpoint:human-verify`. The checkpoint has not been executed — it awaits human review of all phase 10 features end-to-end.

**What to verify:**
1. **Role system**: Admin navigates /admin/users, CRUD works (create/edit/delete with confirm dialog). Non-admin is redirected.
2. **Dashboard**: Table view, column sorting, status/date/search filters, "A valider" tab badge count, header notification icon.
3. **Workflow detail**: Horizontal stepper, phase click shows step details, PDF preview, cancel/notify with confirm dialog.
4. **Action confirmation**: Workflow summary before form, submit with comment, initiator email received.
5. **Error pages**: Expired token page has "Go to dashboard" link.

Resume signal: Type "approved" if all features work, or describe issues found.

## Deviations from Plan

### Situation Found

Task 1 was already implemented in commit `ea9f5f4` as part of the Plan 04 execution (which appears to have implemented AdminUsersPage, ConfirmDialog, the nav link, and route ahead of this plan). The files were already present and the build was already passing.

The plan executor verified all artifacts were present and correct, confirmed the build passes with zero TypeScript errors, and did not create duplicate commits for already-committed work.

**Pre-existing missing module fixed** (`ConfirmDialog` import in WorkflowDetailPage): The `ConfirmDialog.tsx` component file was created by Plan 04's execution (commit `ea9f5f4`) before this plan ran. The build now succeeds without errors.

## Self-Check: PASSED

| Item | Status |
|------|--------|
| frontend/src/pages/AdminUsersPage.tsx | FOUND |
| frontend/src/components/ui/ConfirmDialog.tsx | FOUND |
| frontend/src/App.tsx — /admin/users route | FOUND |
| frontend/src/pages/DashboardPage.tsx — nav.users link | FOUND |
| i18n en/common.json — admin.* keys | FOUND |
| i18n fr/common.json — admin.* keys | FOUND |
| npm run build — zero TypeScript errors | PASSED |
| Commit ea9f5f4 (task implementation) | FOUND |

## Checkpoint Pending

Task 2 requires human end-to-end verification of all phase 10 features. The orchestrator will present this checkpoint to the user for manual testing approval.
