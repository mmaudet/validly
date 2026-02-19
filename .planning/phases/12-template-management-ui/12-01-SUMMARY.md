---
phase: 12-template-management-ui
plan: "01"
subsystem: frontend
tags: [react, react-hook-form, tanstack-query, i18n, routing]
dependency_graph:
  requires:
    - frontend/src/components/workflow/CircuitBuilderStep.tsx
    - frontend/src/components/workflow/TemplatePicker.tsx (Template type)
    - frontend/src/pages/WorkflowCreatePage.tsx (PhaseForm, StepForm types)
    - frontend/src/lib/api.ts (apiFetch, ApiError)
  provides:
    - frontend/src/pages/TemplateFormPage.tsx
    - /templates/new route
    - /templates/:id/edit route
    - template.* i18n namespace (EN + FR)
  affects:
    - frontend/src/App.tsx (new routes added)
    - frontend/src/i18n/locales/en/common.json
    - frontend/src/i18n/locales/fr/common.json
tech_stack:
  added: []
  patterns:
    - useParams-based create/edit mode detection
    - useEffect for useQuery data -> form reset (TanStack Query v5 pattern)
    - FormProvider wrapping CircuitBuilderStep for shared form context
    - templateToForm + buildTemplatePayload field rename pattern
key_files:
  created:
    - frontend/src/pages/TemplateFormPage.tsx
  modified:
    - frontend/src/App.tsx
    - frontend/src/i18n/locales/en/common.json
    - frontend/src/i18n/locales/fr/common.json
decisions:
  - "Used step.execution (not step.executionMode) in templateToForm because phase 11-02 already renamed the Template type field in TemplatePicker.tsx before this plan executed"
  - "buildTemplatePayload renames executionMode back to execution for API payload — consistent with WorkflowCreatePage pattern"
  - "templateToForm converts validatorEmails string[]->object[] for react-hook-form useFieldArray compatibility"
metrics:
  duration: "~2 minutes"
  completed_date: "2026-02-19"
  tasks_completed: 2
  files_changed: 4
---

# Phase 12 Plan 01: Template Form Page Summary

**One-liner:** Unified create/edit template page using FormProvider + CircuitBuilderStep with field rename helpers, two authenticated routes, and 18 i18n keys in EN and FR.

## What Was Built

### TemplateFormPage.tsx (new)

A unified create/edit page component that:

- Uses `useParams<{ id: string }>()` to detect create vs edit mode (`isEdit = Boolean(id)`)
- Wraps the entire form in `<FormProvider>` so `CircuitBuilderStep` can access `useFormContext()` internally
- In edit mode, fetches the existing template via `useQuery` with `enabled: isEdit`, then resets the form via `useEffect` (TanStack Query v5 compatible — no `onSuccess` on useQuery)
- Has separate `createMutation` (POST /templates) and `editMutation` (PUT /templates/:id)
- Both mutations invalidate `['templates']` query cache on success and navigate to `/dashboard`
- Handles 403 errors with typed `ApiError` check, showing `template.error_403` i18n key

**Key helper functions:**

`templateToForm(existing: Template) -> TemplateForm`:
- Reads `step.execution` from Template type (renamed by phase 11-02 before execution)
- Maps to form's `executionMode` field (kept as-is per react-hook-form form type)
- Converts `validatorEmails: string[]` to `{ email: string }[]`
- Defaults `quorumCount` and `deadlineHours` to `null` if undefined

`buildTemplatePayload(data: TemplateForm) -> API payload`:
- Renames `executionMode` -> `execution` (STATE.md decision: form field vs API field)
- Converts `validatorEmails: { email }[]` -> `string[]`
- Conditionally includes `quorumCount` (only when `quorumRule === 'ANY_OF'`)
- Conditionally includes `deadlineHours` (only when not null)

### App.tsx (modified)

Added two new authenticated routes after `/admin/users`:
```
/templates/new       -> TemplateFormPage (create mode)
/templates/:id/edit  -> TemplateFormPage (edit mode)
```

### i18n keys (18 keys each, EN + FR)

Both `frontend/src/i18n/locales/en/common.json` and `fr/common.json` now have a `template.*` namespace covering: `page_title_create`, `page_title_edit`, `name_label`, `name_placeholder`, `description_label`, `description_placeholder`, `save`, `cancel`, `create_button`, `edit`, `delete`, `delete_confirm_title`, `delete_confirm_message`, `no_templates`, `column_name`, `column_description`, `column_actions`, `error_403`.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 48df244 | feat(12-01): create TemplateFormPage with create and edit mutations |
| 2 | 539ab44 | feat(12-01): add template routes and i18n keys for EN and FR |

## Deviations from Plan

### Parallel Phase Adaptation

**Found during:** Task 1 (reading TemplatePicker.tsx before writing code)

**Context:** The objective note warned that phase 11-02 was renaming `executionMode` to `execution` in the Template interface. When reading the file, the rename was already committed (commit `edecf5c`).

**Adaptation:** Used `step.execution` instead of `step.executionMode` in `templateToForm` when reading from the Template type. The form type (`StepForm`) still uses `executionMode` internally — only the API-facing types changed. This is a correct adaptation, not a bug.

**Files affected:** `frontend/src/pages/TemplateFormPage.tsx` (templateToForm function, line 39)

No other deviations — plan executed exactly as written otherwise.

## Self-Check: PASSED

- [x] `frontend/src/pages/TemplateFormPage.tsx` exists (270 lines)
- [x] `frontend/src/App.tsx` has both template routes
- [x] EN common.json has `template` section with 18 keys — JSON valid
- [x] FR common.json has `template` section with 18 keys — JSON valid
- [x] `npx tsc --noEmit` passes with 0 errors
- [x] Commit 48df244 exists
- [x] Commit 539ab44 exists
