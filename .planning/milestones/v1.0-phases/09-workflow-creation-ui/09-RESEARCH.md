# Phase 9: Workflow Creation UI - Research

**Researched:** 2026-02-19
**Confidence:** HIGH

## Summary

All backend APIs are in place. The frontend uses React 19 + Tailwind v4 + TanStack Query 5 + react-hook-form 7 (installed, unused). The core complexity is the "circuit builder" — nested dynamic arrays of phases containing steps, mapping to `useFieldArray` nested inside `useFieldArray`.

## Key Findings

- **No new packages needed.** react-hook-form 7, TanStack Query 5, react-router 7, Tailwind v4 are all installed.
- **Circuit builder pattern:** Outer `useFieldArray` for phases, inner for steps in a separate `PhaseRow` component (Rules of Hooks).
- **Launch flow:** Upload all staged files in parallel (`Promise.all`), then `POST /api/workflows` with returned document IDs.
- **`apiFetch` already handles FormData** — skips Content-Type header for multipart.
- **Route order matters:** `/workflows/new` must precede `/workflows/:id` in App.tsx.
- **Existing i18n key `workflow.create`** already exists ("New workflow" / "Nouveau circuit").

## Architecture

- Single `useForm` in `WorkflowCreatePage`, shared via `FormProvider`/`useFormContext`
- Wizard step tracking in `useState` (documents → circuit → review)
- `trigger()` for per-step validation before advancing
- File staging in `useState<File[]>` — upload only on launch (avoids orphaned docs)
- Template loading via `reset({ ...getValues(), structure: template.structure })`
- `useMutation` for uploads + workflow creation
- `queryClient.invalidateQueries` after create for dashboard refresh

## Pitfalls

1. `/workflows/new` must be declared before `/:id` in routes
2. Inner `useFieldArray` must be in its own component (not in `.map()`)
3. `reset()` must merge with `getValues()` to preserve title when loading template
4. Use `isPending` not `isLoading` for mutations (TanStack Query v5 rename)
5. Stage files locally, upload only on launch (avoid orphaned documents)

## API Contracts

**POST /api/documents** (multipart): `file` (required), `title`, `description`, `tags` → `{ id, title, fileName, fileSize, mimeType, createdAt }`

**POST /api/workflows** (JSON): `{ title, documentIds[], structure: { phases: [{ name, steps: [{ name, execution, quorumRule, quorumCount?, validatorEmails[], deadlineHours? }] }] } }` → Full workflow instance

**GET /api/templates** (JSON): `?page=1&limit=20` → `{ templates[], total, page, limit, totalPages }`
