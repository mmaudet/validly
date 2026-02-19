# Phase 12: Template Management UI - Research

**Researched:** 2026-02-19
**Domain:** React frontend CRUD UI using the project's existing stack (React 19 + react-hook-form + TanStack Query + Tailwind v4 + react-i18next)
**Confidence:** HIGH

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TMPL-01 | User can create workflow templates defining phases, steps, validators, and quorum rules | CircuitBuilderStep.tsx already implements the full phase/step/validator/quorum form. A TemplateFormPage wrapping it with FormProvider + create mutation covers this requirement. |
| TMPL-02 | Templates are created via a structured form (not drag-and-drop) | CircuitBuilderStep / PhaseRow / StepRow already provide the structured form. Reuse is the correct approach; no new form components need to be written from scratch. |
</phase_requirements>

---

## Summary

This phase adds template CRUD to the dashboard. The backend already has all four routes (GET/POST/PUT/DELETE /templates) and the frontend already has all the necessary building blocks: `CircuitBuilderStep`, `PhaseRow`, `StepRow`, `TemplatePicker`, `ConfirmDialog`, and `apiFetch`. The work is primarily routing, page composition, and dashboard wiring — not building new form components.

The main new artifact is a `TemplateFormPage` (create + edit in one page, distinguished by the presence of a route param `id`). This page wraps `FormProvider` around the existing `CircuitBuilderStep` component exactly like `WorkflowCreatePage` does. The dashboard gets a "Mes modèles" tab rendered by a new `TemplatesTab` component. Delete confirmation uses the existing `ConfirmDialog`.

**Primary recommendation:** Reuse `CircuitBuilderStep` + `PhaseRow` + `StepRow` unchanged; build `TemplateFormPage` as a thin wrapper; add `TemplatesTab` to `DashboardPage`; wire in two new routes in `App.tsx`.

---

## Standard Stack

### Core (all already installed — no new dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-hook-form | ^7.54.2 | Form state, validation, `useFieldArray` | Already used for the circuit builder; `useFieldArray` is required for dynamic phases/steps/emails |
| @tanstack/react-query | ^5.66.9 | Data fetching, cache invalidation, mutations | Already used throughout; `useMutation` + `invalidateQueries` is the project pattern |
| react-i18next | ^15.4.1 | i18n keys for all new UI text | Already used; all new strings go in `common.json` for both `en` and `fr` |
| tailwindcss | ^4.0.7 | Styling | All UI is Tailwind utility classes |
| react-router | ^7.2.0 | Routing for new `/templates/new` and `/templates/:id/edit` routes | Already used in `App.tsx` |

### No New Dependencies Required

The entire phase is implementable with the existing dependency set. Do not add any new packages.

---

## Architecture Patterns

### Recommended Project Structure

```
frontend/src/
├── pages/
│   └── TemplateFormPage.tsx    # NEW — create + edit template (unified page)
├── components/
│   └── workflow/
│       └── CircuitBuilderStep.tsx   # UNCHANGED — reused as-is
│       └── PhaseRow.tsx             # UNCHANGED
│       └── StepRow.tsx              # UNCHANGED
│       └── TemplatePicker.tsx       # UNCHANGED (already uses GET /templates)
├── i18n/locales/
│   ├── en/common.json           # ADD template.* keys
│   └── fr/common.json           # ADD template.* keys
└── App.tsx                      # ADD two new routes
```

`DashboardPage.tsx` receives a `TemplatesTab` component added inline (following the existing pattern where `SubmissionsTab`, `PendingTab`, and `UsersTab` are all defined in the same file).

### Pattern 1: Unified Create/Edit Page

**What:** A single `TemplateFormPage` component that behaves as create when no `:id` param is present, and as edit when `:id` is present. The edit variant fetches existing data and pre-populates the form.

**When to use:** Whenever create and edit forms share the same fields (which they do here).

**Example:**
```typescript
// Source: codebase pattern — mirrors WorkflowCreatePage + DashboardPage UsersTab
import { useParams, useNavigate } from 'react-router';
import { useForm, FormProvider } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CircuitBuilderStep } from '../components/workflow/CircuitBuilderStep';
import { apiFetch } from '../lib/api';
import type { WorkflowForm } from './WorkflowCreatePage';

export function TemplateFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Fetch existing template for edit
  const { data: existing } = useQuery({
    queryKey: ['templates', id],
    queryFn: () => apiFetch<Template>(`/templates/${id}`),
    enabled: isEdit,
  });

  const methods = useForm<TemplateForm>({
    defaultValues: { name: '', description: '', structure: { phases: [/* ...default... */] } },
  });

  // Populate form once existing data arrives
  useEffect(() => {
    if (existing) methods.reset(templateToForm(existing));
  }, [existing, methods]);

  const mutation = useMutation({
    mutationFn: (data: TemplateForm) =>
      isEdit
        ? apiFetch(`/templates/${id}`, { method: 'PUT', body: JSON.stringify(buildPayload(data)) })
        : apiFetch('/templates', { method: 'POST', body: JSON.stringify(buildPayload(data)) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      navigate('/dashboard');
    },
  });

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit((d) => mutation.mutate(d))}>
        {/* name, description inputs */}
        <CircuitBuilderStep />
        {/* submit / cancel buttons */}
      </form>
    </FormProvider>
  );
}
```

### Pattern 2: TemplateForm Type vs. Payload Builder

**What:** The form type uses `validatorEmails: ValidatorEmailEntry[]` (objects), but the API expects `validatorEmails: string[]` and `execution` (not `executionMode`). Use the same mapping pattern as `buildWorkflowPayload` in `WorkflowCreatePage`.

**Critical invariant (from STATE.md):**
- Form field: `executionMode` (`'SEQUENTIAL' | 'PARALLEL'`)
- API payload field: `execution`
- `validatorEmails` in form: `{ email: string }[]`
- `validatorEmails` in API payload: `string[]`

The same `buildWorkflowPayload` transform applies to template structure. Extract a shared `buildStructurePayload` helper or duplicate the mapping in `TemplateFormPage`.

**Example:**
```typescript
// Source: WorkflowCreatePage.tsx — buildWorkflowPayload pattern
function buildTemplatePayload(data: TemplateForm) {
  return {
    name: data.name,
    description: data.description || undefined,
    structure: {
      phases: data.structure.phases.map((phase) => ({
        name: phase.name,
        steps: phase.steps.map((step) => ({
          name: step.name,
          execution: step.executionMode,           // rename field
          quorumRule: step.quorumRule,
          validatorEmails: step.validatorEmails.map((v) => v.email),  // unwrap objects
          ...(step.deadlineHours != null ? { deadlineHours: step.deadlineHours } : {}),
          ...(step.quorumRule === 'ANY_OF' && step.quorumCount != null
            ? { quorumCount: step.quorumCount }
            : {}),
        })),
      })),
    },
  };
}
```

### Pattern 3: TemplatesTab in DashboardPage

**What:** A new `'templates'` value added to the `Tab` union type in `DashboardPage.tsx`. The tab renders a list of templates with Edit and Delete actions.

**Example:**
```typescript
// Source: DashboardPage.tsx — UsersTab pattern
type Tab = 'submissions' | 'pending' | 'users' | 'templates';

// Tab button (added after the existing pending tab button):
<button onClick={() => handleTabChange('templates')} ...>
  {t('nav.templates')}
</button>

// In main render:
{tab === 'templates' && <TemplatesTab />}
```

`TemplatesTab` follows the same structure as `UsersTab`: query for data, render a table, use Delete confirm dialog, navigate to edit on "Edit" click.

### Pattern 4: Lazy Query for Templates List

**What:** The templates query already uses `enabled: isOpen` in `TemplatePicker` (lazy fetch). `TemplatesTab` can use always-enabled fetch since the tab itself acts as the gate.

```typescript
// Source: TemplatePicker.tsx — queryKey pattern
const { data, isLoading } = useQuery({
  queryKey: ['templates'],           // same key — shared cache with TemplatePicker
  queryFn: () => apiFetch<TemplateListResponse>('/templates?limit=50'),
});
```

Using the same `queryKey: ['templates']` means that when a template is created/edited/deleted and the query is invalidated, both the `TemplatesTab` list and the `TemplatePicker` dropdown cache are cleared together.

### Pattern 5: Converting Template Structure to Form Shape

**What:** When editing a template, the API returns `execution` (not `executionMode`) and `validatorEmails: string[]` (not objects). Must convert before calling `methods.reset()`.

```typescript
// Source: WorkflowCreatePage.tsx — templateStructureToForm pattern
function templateToForm(template: Template): TemplateForm {
  return {
    name: template.name,
    description: template.description ?? '',
    structure: {
      phases: template.structure.phases.map((phase) => ({
        name: phase.name,
        steps: phase.steps.map((step) => ({
          name: step.name,
          executionMode: step.executionMode,   // API returns executionMode in GET /templates
          quorumRule: step.quorumRule,
          quorumCount: step.quorumCount ?? null,
          validatorEmails: step.validatorEmails.map((email) => ({ email })),
          deadlineHours: step.deadlineHours ?? null,
        })),
      })),
    },
  };
}
```

**NOTE:** The `Template` type in `TemplatePicker.tsx` uses `executionMode` (not `execution`). The backend stores the structure as-is from POST (which sends `execution`). This means the GET response's step field name is `executionMode` as defined in `TemplatePicker.tsx` line 18 — but this must be verified against the actual API response. See Open Questions.

### Anti-Patterns to Avoid

- **Duplicating CircuitBuilderStep:** Do not recreate phase/step/validator UI for the template form. Import and reuse the existing component.
- **Creating a separate TemplateForm type that diverges from WorkflowForm's structure:** Use the same `PhaseForm`/`StepForm` types exported from `WorkflowCreatePage.tsx`, or define a `TemplateForm` interface that embeds them with added `name`/`description` fields.
- **Adding a 3rd tab variant for the template page:** The pattern is a separate route page (`/templates/new`, `/templates/:id/edit`), not a modal. Modals are used only for short CRUD actions (as in `UsersTab`). Template editing involves the full circuit builder — it must be a full page.
- **Invalidating only one query key:** Always call `queryClient.invalidateQueries({ queryKey: ['templates'] })` after create/edit/delete — this refreshes both `TemplatesTab` and `TemplatePicker`.
- **Resetting the form before useEffect fires:** In edit mode, call `methods.reset(templateToForm(existing))` inside `useEffect` watching `existing`, not in the query `onSuccess` (which is deprecated in TanStack Query v5).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Dynamic phase/step list | Custom array state + input management | `useFieldArray` from react-hook-form | RHF handles field IDs, removal, re-ordering, and keeps form state consistent; critical for nested arrays |
| Confirm-before-delete dialog | Custom confirm state + inline JSX | `ConfirmDialog` from `components/ui/ConfirmDialog.tsx` | Already exists, already styled, already i18n'd |
| Circuit builder form | New form fields from scratch | `CircuitBuilderStep` / `PhaseRow` / `StepRow` | Already handles all fields (name, executionMode, quorumRule, quorumCount, validatorEmails, deadline) with full i18n |
| API fetch with auth | Raw fetch | `apiFetch` from `lib/api.ts` | Handles token injection, 401 refresh, error parsing |
| Optimistic cache updates | Manual state sync | `queryClient.invalidateQueries` | Simpler and sufficient; no optimistic updates needed for this CRUD scope |

**Key insight:** This phase is almost entirely composition. The circuit builder is done. The API client is done. The confirm dialog is done. New code is routing plumbing, page shells, tab wiring, and i18n strings.

---

## Common Pitfalls

### Pitfall 1: executionMode vs. execution Field Name Mismatch

**What goes wrong:** The backend `StepStructure` type uses `execution` but the frontend form uses `executionMode`. When building the POST/PUT payload, forgetting to rename will cause backend validation errors or silent wrong behavior.
**Why it happens:** The rename was intentional (see STATE.md) to avoid collision with an HTML attribute `execution`. The form type is `executionMode`; the API payload must use `execution`.
**How to avoid:** Use `buildTemplatePayload` that explicitly maps `step.executionMode → execution` in every place a template structure is sent to the API.
**Warning signs:** API returns 400 or templates save with wrong execution mode.

### Pitfall 2: validatorEmails Object vs. String Array

**What goes wrong:** The form stores `validatorEmails` as `{ email: string }[]` (required by `useFieldArray`). Sending this directly to the API produces a type error.
**Why it happens:** `useFieldArray` requires objects (not primitives) for tracking field identity. The mapping to `string[]` must happen at payload build time.
**How to avoid:** Always call `.map((v) => v.email)` when building the API payload.
**Warning signs:** API returns 400 on create/update; validator emails save as `[object Object]`.

### Pitfall 3: Stale Form Data on Edit Navigation

**What goes wrong:** User navigates edit → create → edit (different template). The form retains old values because `useEffect` doesn't run if `existing` reference didn't change from React's perspective.
**Why it happens:** The query cache may return the same object reference.
**How to avoid:** Include `id` in the `useEffect` dependency array: `useEffect(() => { if (existing) methods.reset(...) }, [existing, id, methods])`. Also consider calling `methods.reset()` on component unmount or using `key={id}` on the form component to force remount on route change.
**Warning signs:** Opening edit for template B shows template A's data.

### Pitfall 4: TanStack Query v5 — onSuccess Removed from useQuery

**What goes wrong:** Using `onSuccess` callback on `useQuery` to pre-populate edit form — this was removed in TanStack Query v5.
**Why it happens:** TanStack Query v5 dropped `onSuccess`/`onError` from `useQuery`. They still exist on `useMutation`.
**How to avoid:** Use `useEffect(() => { if (data) methods.reset(...) }, [data])` instead of `useQuery({ onSuccess })`.
**Warning signs:** TypeScript error "Property 'onSuccess' does not exist on type UseQueryOptions".

### Pitfall 5: Shared queryKey Cache Collision

**What goes wrong:** `TemplatePicker` and `TemplatesTab` both fetch from `['templates']`. If `TemplatesTab` uses a different key format (e.g., `['templates', 'list']`), they won't share the cache, and invalidation from create/delete won't refresh the picker.
**Why it happens:** Query keys must match exactly for cache sharing.
**How to avoid:** Use `queryKey: ['templates']` for all template list queries. Use `queryKey: ['templates', id]` for individual template fetches.

### Pitfall 6: DashboardPage Tab Type Not Extended

**What goes wrong:** Adding the templates tab button but forgetting to add `'templates'` to the `Tab` union type causes TypeScript errors on `setTab` calls.
**Why it happens:** The `Tab` type is defined inline in `DashboardPage.tsx` as `type Tab = 'submissions' | 'pending' | 'users'`.
**How to avoid:** Add `| 'templates'` to the `Tab` type and add the tab to `handleTabChange` reset logic.

---

## Code Examples

### Creating a Template (POST /templates)

```typescript
// Source: backend/src/api/routes/templates.ts — POST /templates schema
// Required body: { name: string, structure: WorkflowStructure, description?: string, isShared?: boolean }
// Returns 201 with full template object

const createMutation = useMutation({
  mutationFn: (data: TemplateForm) =>
    apiFetch<Template>('/templates', {
      method: 'POST',
      body: JSON.stringify(buildTemplatePayload(data)),
    }),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['templates'] });
    navigate('/dashboard');
  },
  onError: (err: Error) => {
    setSubmitError(err.message);
  },
});
```

### Updating a Template (PUT /templates/:id)

```typescript
// Source: backend/src/api/routes/templates.ts — PUT /templates/:id
// Returns 200 with updated template
// Returns 403 if user is not the creator (ownership check)
// Returns 404 if template not found

const updateMutation = useMutation({
  mutationFn: (data: TemplateForm) =>
    apiFetch<Template>(`/templates/${id}`, {
      method: 'PUT',
      body: JSON.stringify(buildTemplatePayload(data)),
    }),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['templates'] });
    queryClient.invalidateQueries({ queryKey: ['templates', id] });
    navigate('/dashboard');
  },
});
```

### Deleting a Template (DELETE /templates/:id)

```typescript
// Source: backend/src/api/routes/templates.ts — DELETE /templates/:id
// Returns 204 No Content on success
// Returns 403 if user is not the creator
// apiFetch handles 204 by returning undefined (line 87 in api.ts: if (res.status === 204) return undefined as T)

const deleteMutation = useMutation({
  mutationFn: (templateId: string) =>
    apiFetch<void>(`/templates/${templateId}`, { method: 'DELETE' }),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['templates'] });
    setConfirmDelete(null);
  },
});
```

### Listing Templates in TemplatesTab

```typescript
// Source: TemplatePicker.tsx — query pattern
interface TemplateListResponse {
  templates: Template[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const { data, isLoading } = useQuery<TemplateListResponse>({
  queryKey: ['templates'],
  queryFn: () => apiFetch<TemplateListResponse>('/templates?limit=50'),
});
```

### Routing (App.tsx additions)

```typescript
// Source: App.tsx — existing AuthGuard pattern
import { TemplateFormPage } from './pages/TemplateFormPage';

// In <Routes>:
<Route path="/templates/new" element={<AuthGuard><TemplateFormPage /></AuthGuard>} />
<Route path="/templates/:id/edit" element={<AuthGuard><TemplateFormPage /></AuthGuard>} />
```

### TemplateForm Type Definition

```typescript
// Extends WorkflowCreatePage types — import PhaseForm and StepForm from there
import type { PhaseForm } from './WorkflowCreatePage';

export interface TemplateForm {
  name: string;
  description: string;
  structure: {
    phases: PhaseForm[];
  };
}
```

### i18n Keys to Add (both en and fr)

```json
// common.json additions needed
{
  "template": {
    "page_title_create": "New Template",
    "page_title_edit": "Edit Template",
    "name_label": "Template Name",
    "name_placeholder": "e.g. Standard Legal Review",
    "description_label": "Description (optional)",
    "description_placeholder": "Describe when to use this template",
    "save": "Save Template",
    "cancel": "Cancel",
    "create_button": "New Template",
    "edit": "Edit",
    "delete": "Delete",
    "delete_confirm_title": "Delete template?",
    "delete_confirm_message": "This template will be permanently removed.",
    "no_templates": "No templates yet. Create your first template!",
    "column_name": "Name",
    "column_description": "Description",
    "column_actions": "Actions",
    "error_403": "You can only edit or delete your own templates"
  }
}
```

---

## API Contract Summary

| Route | Method | Auth | Body Required | Returns | Error Cases |
|-------|--------|------|---------------|---------|-------------|
| `/templates` | GET | Bearer | — | `{ templates[], total, page, limit, totalPages }` | — |
| `/templates` | POST | Bearer | `{ name, structure, description?, isShared? }` | 201 Template | — |
| `/templates/:id` | GET | Bearer | — | Template | 404 |
| `/templates/:id` | PUT | Bearer | `{ name?, description?, structure?, isShared? }` | Template | 403, 404 |
| `/templates/:id` | DELETE | Bearer | — | 204 | 403, 404 |

**Ownership:** PUT and DELETE enforce `createdById === currentUser.id`. Only the creator can modify or delete. There is no admin override in the current backend implementation.

**isShared field:** The backend supports `isShared: boolean` on templates (defaults to false). The UI does not currently expose this. For Phase 12, omit `isShared` from the create/edit form — it defaults to `false`. Do not add a "share" toggle unless explicitly requested.

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| TanStack Query v4 `useQuery({ onSuccess })` | v5: use `useEffect` to react to data | Must not use `onSuccess` on `useQuery` |
| Separate create + edit pages | Unified page with `useParams` | Reduces duplication |
| Global form reset in parent | `methods.reset()` inside `useEffect` watching fetched data | Correct v5 pattern |

---

## Open Questions

1. **Does GET /templates return `executionMode` or `execution` in step objects?**
   - What we know: `TemplatePicker.tsx` types it as `executionMode` (line 18). The backend `WorkflowStructure` / `StepStructure` uses `execution`. When the backend reads from the DB and returns, it returns the raw JSON as stored — which was written by POST using `execution`.
   - What's unclear: Whether the GET response actually has `executionMode` or `execution` in step objects. The `TemplatePicker.tsx` type might be wrong (it was written before the rename issue was documented).
   - Recommendation: Before implementing `templateToForm()`, make one test GET request to `/templates/:id` in the running backend and confirm the field name. If the API returns `execution`, update `TemplatePicker.tsx`'s Template type and the `templateToForm` conversion. This is a 5-minute verification; do it before writing conversion code.

2. **Should the TemplatesTab show only own templates or all (own + shared)?**
   - What we know: The GET /templates list returns `own OR isShared` templates. `isShared` defaults to false for all current templates.
   - What's unclear: Whether the phase requires UI differentiation (e.g., can't delete shared templates you don't own).
   - Recommendation: The backend already handles 403 on delete/update if not the owner. Surface the 403 as a user-visible error message. No UI differentiation (e.g., "shared" badge) is required for TMPL-01/02.

---

## Sources

### Primary (HIGH confidence)

- `/Users/mmaudet/work/validly/frontend/src/components/workflow/CircuitBuilderStep.tsx` — exact component API, useFormContext usage
- `/Users/mmaudet/work/validly/frontend/src/components/workflow/PhaseRow.tsx` — useFieldArray for steps pattern
- `/Users/mmaudet/work/validly/frontend/src/components/workflow/StepRow.tsx` — useFieldArray for emails, executionMode field name
- `/Users/mmaudet/work/validly/frontend/src/pages/WorkflowCreatePage.tsx` — FormProvider + CircuitBuilderStep pattern, buildWorkflowPayload, templateStructureToForm
- `/Users/mmaudet/work/validly/frontend/src/pages/DashboardPage.tsx` — Tab union type, UsersTab CRUD pattern with useForm + useMutation
- `/Users/mmaudet/work/validly/frontend/src/components/workflow/TemplatePicker.tsx` — Template type, queryKey pattern
- `/Users/mmaudet/work/validly/frontend/src/components/ui/ConfirmDialog.tsx` — existing confirm dialog component
- `/Users/mmaudet/work/validly/backend/src/api/routes/templates.ts` — exact HTTP contract (methods, paths, body shapes, status codes)
- `/Users/mmaudet/work/validly/backend/src/services/template-service.ts` — ownership enforcement (403), 404 handling, isShared behavior
- `/Users/mmaudet/work/validly/backend/src/domain/workflow-types.ts` — canonical field names: `execution` (not `executionMode`), `validatorEmails: string[]`
- `/Users/mmaudet/work/validly/frontend/src/lib/api.ts` — apiFetch signature, 204 handling
- `/Users/mmaudet/work/validly/frontend/src/App.tsx` — AuthGuard pattern, route registration
- `/Users/mmaudet/work/validly/frontend/src/i18n/locales/en/common.json` — existing i18n key structure
- `/Users/mmaudet/work/validly/frontend/package.json` — confirmed library versions

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all dependencies read directly from package.json; no new dependencies needed
- Architecture: HIGH — patterns read directly from existing codebase files
- Pitfalls: HIGH — field name mismatch documented in STATE.md; TanStack Query v5 behavior confirmed from package.json version
- API contract: HIGH — read directly from backend route and service files

**Research date:** 2026-02-19
**Valid until:** 2026-03-21 (30 days — stable codebase)
