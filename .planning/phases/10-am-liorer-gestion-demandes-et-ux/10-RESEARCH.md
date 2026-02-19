# Phase 10: Améliorer gestion demandes et UX - Research

**Researched:** 2026-02-19
**Domain:** UX improvement, workflow management, BullMQ scheduler, PDF inline preview, RBAC, email notifications
**Confidence:** HIGH (codebase confirmed) / MEDIUM (BullMQ scheduler patterns, react-pdf)

## Summary

Phase 10 is a pure enhancement phase layered on top of an already-functioning v1 Validly implementation. The existing codebase (Fastify 5 + Prisma 6 + React 19 + TanStack Query 5 + BullMQ 5) is in good shape. All new work consists of extending, not replacing, existing services and components. The six main areas are: (1) enriched action confirmation page, (2) stepper-based workflow detail, (3) filtered/sortable dashboard, (4) initiator email notifications, (5) BullMQ deadline reminders, and (6) admin user CRUD.

The primary technical unknowns are: BullMQ Worker integration (the queue already exists but no Worker is wired into server.ts), PDF inline preview via react-pdf (new npm install required), and the schema changes needed for the new 3-role system (current schema has `USER | ADMIN` enum — a migration is needed to add `INITIATEUR` and `VALIDATEUR` or repurpose `USER`).

**Primary recommendation:** Build backend API first for each feature, then wire the frontend. The BullMQ deadline reminder worker is the only background-process concern; everything else is standard CRUD + UI work.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Page de confirmation action (validateur)
- Résumé complet avant soumission : titre workflow, document(s), étape, initiateur, puis champ commentaire + bouton confirmer
- Commentaire obligatoire pour approuver ET refuser
- Pages d'erreur (token expiré/utilisé/invalide) : message clair + lien vers le dashboard

#### Suivi des workflows (page détail)
- Stepper horizontal pour visualiser la progression phase par phase, avec détail au clic
- Détail complet par étape : validateurs, qui a agi, commentaires, date d'action, règle de quorum, deadline
- Actions initiateur : annuler un workflow en cours + relancer les notifications manuellement
- Documents attachés : liste avec preview en ligne (PDF.js) et lien de téléchargement

#### Dashboard et navigation
- Organisation en deux onglets : « Mes demandes » et « À valider » (amélioration de l'existant)
- Vue tableau structuré avec colonnes (titre, statut, date, étape courante) et tri/filtre
- Filtres complets : statut + date + recherche texte (titre) + initiateur
- Badge numérique sur l'onglet « À valider » + icône notification dans le header

#### Emails et notifications
- Email à l'initiateur à chaque action d'un validateur (approbation ou refus)
- Email dédié à l'initiateur quand le workflow est terminé (approuvé ou refusé globalement)
- Contenu des emails validateur : actuel OK (titre workflow, étape, initiateur, boutons)
- Activer les relances automatiques avant deadline (ex: 24h avant expiration)

#### Gestion des utilisateurs et rôles
- 3 rôles : admin (gère les utilisateurs), initiateur (crée des workflows), validateur (reçoit les demandes)
- Admin crée/modifie/supprime les utilisateurs et affecte les rôles
- Tous les utilisateurs peuvent voir la liste des utilisateurs (pour choisir des validateurs)
- CRUD complet pour la gestion des comptes utilisateur

### Claude's Discretion
- Comportement après soumission de l'action (message inline vs redirection)
- Design exact du stepper horizontal
- Exact loading states et skeleton screens
- Implémentation technique des relances (BullMQ scheduler)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

## Standard Stack

### Core (all already in project)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| BullMQ | 5.41.3 | Delayed job queue for deadline reminders | Already in package.json; Redis 7 already configured |
| Prisma | 6.5.0 | DB access + migrations for schema changes | Already in use |
| Fastify 5 | 5.2.1 | New API routes for cancel/notify/users | Already in use |
| TanStack Query 5 | 5.66.9 | Data fetching, caching, invalidation | Already in use |
| React Hook Form | 7.54.2 | Form validation in admin user CRUD | Already in package.json |
| react-i18next | 15.4.1 | Translations for new UI strings | Already in use |

### New Dependencies

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-pdf | 10.x | PDF inline preview via PDF.js | For document preview panel in workflow detail |
| pdfjs-dist | (peer dep of react-pdf) | PDF.js worker | Auto-installed with react-pdf |

**Installation:**
```bash
# Frontend only
cd frontend && npm install react-pdf
```

Note: `react-pdf` wraps `pdfjs-dist` and simplifies React integration. The worker must be configured once at the module level:
```typescript
import { pdfjs } from 'react-pdf';
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();
```

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| react-pdf | pdfjs-dist raw | react-pdf saves considerable boilerplate; use react-pdf |
| BullMQ delayed jobs | ScheduledEvent table + polling | BullMQ is already installed and provides exact-time dispatch; use BullMQ |
| Client-side filter/sort | TanStack Table | The dataset is small (dashboard only shows user's own workflows/steps); simple useMemo filter in React is sufficient and avoids an extra dependency |

---

## Architecture Patterns

### Recommended Project Structure Extensions

```
backend/src/
├── api/routes/
│   ├── workflows.ts          # ADD: PATCH /workflows/:id/cancel, POST /workflows/:id/notify
│   └── users.ts              # NEW: admin CRUD /users
├── services/
│   ├── workflow-service.ts   # ADD: cancel(), notifyStep() methods
│   ├── email-service.ts      # ADD: sendInitiatorAction(), sendInitiatorComplete()
│   └── reminder-service.ts   # NEW: scheduleReminder(), cancelReminder()
├── jobs/
│   └── reminder-worker.ts    # NEW: BullMQ Worker for deadline reminders
└── infrastructure/
    └── queue.ts              # NEW: shared Queue/connection for BullMQ

frontend/src/
├── pages/
│   ├── DashboardPage.tsx     # MODIFY: add table, filters, badges
│   ├── WorkflowDetailPage.tsx # MODIFY: add stepper, PDF preview, cancel/notify actions
│   ├── ActionConfirmPage.tsx  # MODIFY: add workflow summary before form
│   └── AdminUsersPage.tsx    # NEW: user management UI
├── components/
│   ├── workflow/
│   │   ├── WorkflowStepper.tsx   # NEW: horizontal stepper component
│   │   └── DocumentPreview.tsx   # NEW: PDF.js preview panel
│   └── ui/
│       └── ConfirmDialog.tsx     # NEW: reusable confirmation dialog
```

### Pattern 1: BullMQ Delayed Job for Deadline Reminders

**What:** When a step with a deadline is activated, schedule a BullMQ delayed job to fire 24h before the deadline. The job processor queries the step, checks it's still IN_PROGRESS, and sends reminder emails to all pending validators.

**When to use:** Any time a StepInstance with a non-null `deadline` is activated (in `notifyValidators`).

**How it works (verified from BullMQ docs):**

```typescript
// backend/src/infrastructure/queue.ts
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { env } from '../config/env.js';

const connection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });

export const reminderQueue = new Queue('reminders', { connection });
export { connection as redisConnection };
```

```typescript
// backend/src/jobs/reminder-worker.ts
import { Worker } from 'bullmq';
import { prisma } from '../infrastructure/database.js';
import { tokenService } from '../services/token-service.js';
import { emailService } from '../services/email-service.js';
import { redisConnection } from '../infrastructure/queue.js';

const worker = new Worker('reminders', async (job) => {
  const { stepId } = job.data;
  const step = await prisma.stepInstance.findUnique({
    where: { id: stepId },
    include: { phase: { include: { workflow: { include: { documents: true } } } } },
  });
  if (!step || step.status !== 'IN_PROGRESS') return; // Already resolved

  // Find validators who haven't acted yet
  const actedEmails = (await prisma.workflowAction.findMany({ where: { stepId } }))
    .map(a => a.actorEmail);
  const pendingEmails = step.validatorEmails.filter(e => !actedEmails.includes(e));

  for (const email of pendingEmails) {
    const tokens = await tokenService.createTokensForStep(stepId, [email]);
    await emailService.sendReminder({
      to: email,
      locale: 'fr',
      workflowTitle: step.phase.workflow.title,
      documentTitle: step.phase.workflow.documents[0]?.document?.title ?? step.phase.workflow.title,
      stepName: step.name,
      deadlineDate: step.deadline!.toLocaleDateString('fr-FR'),
      approveUrl: `${env.API_URL}/api/actions/${tokens[email].approveToken}`,
      refuseUrl: `${env.API_URL}/api/actions/${tokens[email].refuseToken}`,
    });
  }
}, { connection: redisConnection });

export { worker as reminderWorker };
```

```typescript
// Scheduling a reminder (in workflow-service.ts, after notifyValidators):
import { reminderQueue } from '../infrastructure/queue.js';

if (step.deadline) {
  const REMINDER_HOURS_BEFORE = 24;
  const delay = step.deadline.getTime() - Date.now() - REMINDER_HOURS_BEFORE * 3600 * 1000;
  if (delay > 0) {
    await reminderQueue.add('deadline-reminder', { stepId: step.id }, {
      delay,
      jobId: `reminder-${step.id}`, // Idempotent: prevents duplicates on re-notification
      removeOnComplete: true,
      removeOnFail: false,
    });
  }
}
```

**Timezone:** BullMQ delays are computed in UTC milliseconds. The "configured timezone" note from the user means: store all deadlines as UTC (already true with `new Date()` in Prisma), and format dates for display using `toLocaleString()` with the user's locale/timezone in email templates.

**Source:** [BullMQ Delayed Docs](https://docs.bullmq.io/guide/jobs/delayed), [BullMQ Connections Docs](https://docs.bullmq.io/guide/connections)

### Pattern 2: Workflow Cancellation

**What:** A new `PATCH /workflows/:id/cancel` endpoint that sets `status = 'CANCELLED'` on a WorkflowInstance. Requires the user to be the initiator.

**Key considerations:**
- The `WorkflowStatus` enum in the Prisma schema already has `CANCELLED` — no migration needed for the status field.
- Must invalidate/remove the pending BullMQ reminder job for the current active step.
- Must cancel any active `ActionToken` records (mark expired) to prevent validators from submitting after cancellation.
- Initiator-only guard: check `workflow.initiatorId === user.sub`.

```typescript
// In workflow-service.ts
async cancel(workflowId: string, initiatorId: string) {
  const workflow = await prisma.workflowInstance.findUnique({
    where: { id: workflowId },
    include: { phases: { include: { steps: true } } },
  });
  if (!workflow) throw new WorkflowError(404, 'Not found');
  if (workflow.initiatorId !== initiatorId) throw new WorkflowError(403, 'Forbidden');
  if (workflow.status !== 'IN_PROGRESS') throw new WorkflowError(409, 'Not cancellable');

  await prisma.$transaction(async (tx) => {
    await tx.workflowInstance.update({ where: { id: workflowId }, data: { status: 'CANCELLED' } });
    // Expire active tokens
    const activeStepIds = workflow.phases.flatMap(p => p.steps)
      .filter(s => s.status === 'IN_PROGRESS').map(s => s.id);
    await tx.actionToken.updateMany({
      where: { stepId: { in: activeStepIds }, usedAt: null },
      data: { expiresAt: new Date(0) },
    });
    await tx.auditEvent.create({ /* ... */ });
  });

  // Remove reminder jobs
  for (const phaseSteps of workflow.phases.flatMap(p => p.steps)) {
    await reminderQueue.remove(`reminder-${phaseSteps.id}`);
  }
}
```

### Pattern 3: Manual Re-notification (Notify Step)

**What:** A `POST /workflows/:id/notify` endpoint that re-sends emails to all pending validators on the current active step. Used by the initiator from the detail page.

```typescript
// In workflow-service.ts
async notifyCurrentStep(workflowId: string, initiatorId: string) {
  const workflow = await this.getById(workflowId);
  if (workflow.initiatorId !== initiatorId) throw new WorkflowError(403, 'Forbidden');
  const activePhase = workflow.phases.find(p => p.status === 'IN_PROGRESS');
  const activeStep = activePhase?.steps.find(s => s.status === 'IN_PROGRESS');
  if (!activeStep) throw new WorkflowError(409, 'No active step to notify');

  const actedEmails = activeStep.actions.map((a: any) => a.actorEmail);
  const pendingEmails = activeStep.validatorEmails.filter((e: string) => !actedEmails.includes(e));
  if (pendingEmails.length === 0) throw new WorkflowError(409, 'All validators have acted');

  await notifyValidators(activeStep.id, pendingEmails, {
    workflowTitle: workflow.title,
    documentTitle: workflow.documents[0]?.document?.title ?? workflow.title,
    stepName: activeStep.name,
    initiatorName: workflow.initiator.name,
  });
}
```

### Pattern 4: Initiator Email Notifications

**What:** Two new email types: `sendInitiatorAction` (on each validator approval/refusal) and `sendInitiatorComplete` (on workflow fully approved or refused).

**Where to add:** In `workflowService.recordAction()`, after the transaction commits, alongside the existing `notifyValidators` call.

```typescript
// In email-service.ts
export interface InitiatorActionEmailInput {
  to: string;
  locale: string;
  workflowTitle: string;
  stepName: string;
  actorEmail: string;
  actionType: 'APPROVE' | 'REFUSE';
  comment: string;
  workflowUrl: string;
}

export interface InitiatorCompleteEmailInput {
  to: string;
  locale: string;
  workflowTitle: string;
  finalStatus: 'APPROVED' | 'REFUSED';
  workflowUrl: string;
}
```

In `workflow-service.ts recordAction()`, after the transaction:
```typescript
// Always notify initiator of validator action
const wf = await prisma.workflowInstance.findUnique({
  where: { id: workflow.id },
  include: { initiator: true },
});
if (wf) {
  await emailService.sendInitiatorAction({
    to: wf.initiator.email,
    locale: wf.initiator.locale,
    workflowTitle: wf.title,
    stepName: step.name,
    actorEmail: input.actorEmail,
    actionType: input.action,
    comment: input.comment,
    workflowUrl: `${env.APP_URL}/workflows/${workflow.id}`,
  });

  // If workflow is fully complete
  if (result.workflowAdvanced || (result.newStepStatus === 'REFUSED' && !result.activatedStep)) {
    await emailService.sendInitiatorComplete({
      to: wf.initiator.email,
      locale: wf.initiator.locale,
      workflowTitle: wf.title,
      finalStatus: result.newStepStatus === 'APPROVED' ? 'APPROVED' : 'REFUSED',
      workflowUrl: `${env.APP_URL}/workflows/${workflow.id}`,
    });
  }
}
```

### Pattern 5: Dashboard Filters (Client-side)

**What:** The dashboard dataset is small (user's own workflows, max ~20/page). Client-side filtering with `useMemo` is sufficient. No server-side filter API changes needed for the basic case.

```typescript
// DashboardPage.tsx — filtered + sorted submissions
const filtered = useMemo(() => {
  let result = submissions.data?.workflows ?? [];
  if (filters.status) result = result.filter(w => w.status === filters.status);
  if (filters.search) {
    const q = filters.search.toLowerCase();
    result = result.filter(w => w.title.toLowerCase().includes(q));
  }
  if (filters.dateFrom) result = result.filter(w => new Date(w.createdAt) >= new Date(filters.dateFrom!));
  if (filters.dateTo) result = result.filter(w => new Date(w.createdAt) <= new Date(filters.dateTo!));
  return result;
}, [submissions.data, filters]);
```

For the "initiator" filter on the "À valider" tab, the existing PendingStep data already includes `phase.workflow.initiator`. Client-side filter on `initiator.name/email`.

**Note:** If the dataset grows, add query string params to the existing GET endpoints and push filter logic server-side via Prisma `where` clause.

### Pattern 6: Role Management (RBAC)

**Schema change required.** The current `UserRole` enum is `USER | ADMIN`. The phase requires 3 roles: `ADMIN`, `INITIATEUR`, `VALIDATEUR`.

```prisma
// New enum in schema.prisma
enum UserRole {
  ADMIN
  INITIATEUR
  VALIDATEUR
}
```

This requires a Prisma migration. The auth service already propagates `role` in the JWT payload (`JwtPayload.role`). The frontend `useAuth` hook already reads `user.role`.

**Admin guard pattern (inline preHandler — no new plugin needed):**

```typescript
// In routes/users.ts
const requireAdmin = async (req: any, reply: any) => {
  await req.jwtVerify();
  const user = req.user as JwtPayload;
  if (user.role !== 'ADMIN') {
    return reply.status(403).send({ message: 'Admin required' });
  }
};

app.get('/users', { preHandler: [requireAdmin] }, async (req) => {
  return userService.list();
});
```

**List all users (for validator picker):** Requires an authenticated (non-admin) endpoint. All logged-in users can see the user list (locked decision).

```typescript
app.get('/users', { preHandler: [authenticate] }, async () => {
  return userService.listPublic(); // Returns id, name, email, role only
});
```

### Pattern 7: Horizontal Stepper Component

**What:** A pure React component with Tailwind styling. No external stepper library needed. Pattern: array of phases, each with a status indicator + label, connected by lines. Click on a phase expands its step details below.

```typescript
// WorkflowStepper.tsx
function WorkflowStepper({ phases, activePhaseId, onSelectPhase }) {
  return (
    <div className="flex items-center gap-0">
      {phases.map((phase, i) => (
        <React.Fragment key={phase.id}>
          <button
            onClick={() => onSelectPhase(phase.id)}
            className={`flex flex-col items-center ${activePhaseId === phase.id ? 'ring-2 ring-blue-500' : ''}`}
          >
            <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold
              ${phase.status === 'APPROVED' ? 'bg-green-500 text-white' :
                phase.status === 'REFUSED' ? 'bg-red-500 text-white' :
                phase.status === 'IN_PROGRESS' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
              {i + 1}
            </div>
            <span className="mt-1 text-xs text-gray-600 max-w-[80px] text-center truncate">{phase.name}</span>
          </button>
          {i < phases.length - 1 && (
            <div className={`h-0.5 flex-1 ${phase.status === 'APPROVED' ? 'bg-green-400' : 'bg-gray-200'}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}
```

### Pattern 8: ActionConfirmPage — Workflow Summary

**What:** The GET `/api/actions/:token` endpoint already calls `tokenService.validateToken()` and redirects to `/action/confirm?step=...&email=...&action=...&token=...`. The existing confirmation page uses only the `action` and `token` query params.

**To add the workflow summary**, the frontend needs to fetch the workflow context. Options:
1. Add a new public endpoint `GET /api/actions/:token/info` that returns workflow summary without consuming the token (uses `validateToken`, not `resolveToken`).
2. Or pass more context in the redirect URL query string.

**Recommended (option 1):** A lightweight `GET /api/actions/:token/info` endpoint:

```typescript
app.get('/actions/:token/info', async (req, reply) => {
  const { token } = req.params as any;
  const result = await tokenService.validateToken(token);
  if (!result.valid) {
    return reply.status(410).send({ reason: result.reason });
  }
  return reply.send({
    action: result.action,
    workflowTitle: result.workflow.title,
    stepName: result.step.name,
    initiatorName: result.workflow.initiator?.name ?? '',
    documents: result.workflow.documents.map(d => d.document?.title ?? ''),
    phase: result.step.phase?.name ?? '',
  });
});
```

This means `ActionConfirmPage` makes a `useQuery` call on load (token from URL), shows the summary, then submits.

### Pattern 9: PDF Inline Preview

**What:** A document preview panel in `WorkflowDetailPage`. The existing document download endpoint is `GET /api/documents/:id/file` (authenticated, returns file with `Content-Disposition: inline`).

```typescript
// frontend/src/components/workflow/DocumentPreview.tsx
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

export function DocumentPreview({ documentId }: { documentId: string }) {
  const [numPages, setNumPages] = useState(0);
  const token = localStorage.getItem('token');
  const fileUrl = `/api/documents/${documentId}/file`;

  return (
    <div className="border rounded overflow-auto max-h-[600px]">
      <Document
        file={{ url: fileUrl, httpHeaders: { Authorization: `Bearer ${token}` } }}
        onLoadSuccess={({ numPages }) => setNumPages(numPages)}
      >
        {Array.from({ length: numPages }, (_, i) => (
          <Page key={i + 1} pageNumber={i + 1} width={560} />
        ))}
      </Document>
    </div>
  );
}
```

**Note:** Only PDF files can be previewed inline. For non-PDF mimeTypes, fall back to a download link. Check `document.mimeType === 'application/pdf'` before rendering the preview.

### Anti-Patterns to Avoid

- **Don't start the BullMQ Worker inside `buildApp()`**: Workers should be started separately or as a separate process (or at least after the app is ready). Wire the worker in `server.ts`, not `app.ts`, to avoid worker startup blocking Fastify registration.
- **Don't create new reminder jobs on manual re-notification**: Use the idempotent `jobId: reminder-${stepId}` pattern — BullMQ will silently ignore adding a duplicate job with the same jobId if one already exists.
- **Don't filter users from JWT role for the action confirm page**: The action confirm flow is tokenless-auth (no JWT required). Use `validateToken` to fetch context; don't force login.
- **Don't re-use ActionToken after cancel**: When a workflow is cancelled, expired tokens should be blocked by `token.expiresAt < new Date()` check in `tokenService.validateToken()`. Setting `expiresAt: new Date(0)` achieves this without a new column.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PDF inline preview | Custom canvas/fetch renderer | `react-pdf` (wraps pdfjs-dist) | Worker threading, text layer, annotation layer all handled |
| Delayed job scheduling | Cron in server.ts or ScheduledEvent polling | BullMQ delayed jobs | BullMQ already installed, Redis already running, exact-time dispatch, survives restarts |
| Confirmation dialog | Custom modal with Portal | Tailwind `dialog` utility classes + React state | Project has no Radix/Headless UI; a simple inline Tailwind dialog is sufficient |
| Role guard in Fastify | New plugin | Inline `preHandler` function | Existing pattern in the codebase (see `authenticate` inline in every route) |
| Server-side search filtering | Custom parser | Prisma `contains + mode: 'insensitive' + OR` | Prisma already handles this natively |

**Key insight:** The existing codebase deliberately avoids heavy component libraries. Add `react-pdf` only; do not add Radix UI, shadcn, or other component frameworks for dialog/modal needs.

---

## Common Pitfalls

### Pitfall 1: UserRole Enum Migration Breaking Existing Users
**What goes wrong:** Changing `UserRole` from `USER | ADMIN` to `ADMIN | INITIATEUR | VALIDATEUR` will break all existing `USER` role records in the database.
**Why it happens:** PostgreSQL enum types do not automatically remap old values.
**How to avoid:** Migration strategy:
  1. Add `INITIATEUR` and `VALIDATEUR` to the enum (additive migration).
  2. `UPDATE users SET role = 'INITIATEUR' WHERE role = 'USER'`.
  3. Remove `USER` from the enum (or keep it as legacy/deprecated).
  Alternatively, keep `USER` as a synonym for `INITIATEUR` and add `VALIDATEUR` and `ADMIN` only. Pick one approach and commit to it.
**Warning signs:** `prisma migrate dev` will error if you try to rename/remove an enum value that has active rows.

### Pitfall 2: BullMQ Worker Not Started
**What goes wrong:** Jobs are enqueued but never processed — reminders never fire.
**Why it happens:** BullMQ Worker must be explicitly instantiated and kept alive. Simply importing `reminderQueue` does not start a worker.
**How to avoid:** Import and instantiate `reminderWorker` in `server.ts` after `buildApp()`. Attach error listener to prevent unhandled rejection: `reminderWorker.on('error', console.error)`.
**Warning signs:** Jobs accumulate in Redis with `delayed` state but no `completed` state.

### Pitfall 3: Duplicate Reminder Jobs on Re-notification
**What goes wrong:** Calling `notifyCurrentStep` creates new tokens and a new reminder job, while the old reminder job still fires with stale/expired tokens.
**Why it happens:** BullMQ does not deduplicate by default.
**How to avoid:** Use idempotent `jobId: \`reminder-\${stepId}\`` in `reminderQueue.add()`. BullMQ will throw a `Job already exists` error if a job with that ID is already queued — catch and ignore this error. Alternatively, call `reminderQueue.remove(\`reminder-\${stepId}\`)` before re-adding.

### Pitfall 4: ActionConfirmPage Fetching Context Without Token Validation
**What goes wrong:** Frontend loads the confirm page, fetches workflow info, then the POST is rejected because the token was already used between page load and submit.
**Why it happens:** Race condition — another browser tab or the same user double-clicked.
**How to avoid:** The existing `POST /api/actions/execute` already calls `resolveToken` which does the final single-use check. The frontend info fetch uses `validateToken` (read-only). The UX should handle the 410 response from execute gracefully, redirecting to `/action/used`.

### Pitfall 5: react-pdf Worker Version Mismatch
**What goes wrong:** `InvalidPDF` or blank render when previewing files.
**Why it happens:** The pdf.worker.min.mjs version must match the installed pdfjs-dist version.
**How to avoid:** Always use `new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()` — this resolves to the correct installed version automatically via Vite's static asset handling.

### Pitfall 6: Cancelling a Workflow That Has No Active BullMQ Job
**What goes wrong:** `reminderQueue.remove(jobId)` throws if the job doesn't exist (e.g., deadline was in the past, reminder never scheduled).
**Why it happens:** `remove()` may throw for non-existent jobs.
**How to avoid:** Wrap in try/catch: `try { await reminderQueue.remove(...) } catch {}`.

---

## Code Examples

### Backend: Prisma Filter Query for Dashboard

```typescript
// Verified pattern: Prisma filtering with OR + contains + insensitive + date range
// Source: https://www.prisma.io/docs/orm/prisma-client/queries/filtering-and-sorting

async listByInitiatorFiltered(
  initiatorId: string,
  filters: { status?: string; search?: string; dateFrom?: string; dateTo?: string; initiatorEmail?: string },
  page = 1,
  limit = 20,
) {
  const where: any = { initiatorId };
  if (filters.status) where.status = filters.status;
  if (filters.search) where.title = { contains: filters.search, mode: 'insensitive' };
  if (filters.dateFrom || filters.dateTo) {
    where.createdAt = {};
    if (filters.dateFrom) where.createdAt.gte = new Date(filters.dateFrom);
    if (filters.dateTo) where.createdAt.lte = new Date(filters.dateTo);
  }
  const skip = (page - 1) * limit;
  const [workflows, total] = await Promise.all([
    prisma.workflowInstance.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit, include: { ... } }),
    prisma.workflowInstance.count({ where }),
  ]);
  return { workflows, total, page, limit };
}
```

### Backend: Admin User CRUD

```typescript
// backend/src/api/routes/users.ts
export async function userRoutes(app: FastifyInstance) {
  const authenticate = async (req: any) => { await req.jwtVerify(); };
  const requireAdmin = async (req: any, reply: any) => {
    await req.jwtVerify();
    if ((req.user as JwtPayload).role !== 'ADMIN') return reply.status(403).send({ message: 'Admin required' });
  };

  // All authenticated users: list users (for validator picker)
  app.get('/users', { preHandler: [authenticate] }, async () => {
    return prisma.user.findMany({ select: { id: true, name: true, email: true, role: true } });
  });

  // Admin only: create user
  app.post('/users', { preHandler: [requireAdmin] }, async (req, reply) => {
    // Create user with hashed password (reuse authService.signup pattern)
  });

  // Admin only: update user role/name
  app.patch('/users/:id', { preHandler: [requireAdmin] }, async (req, reply) => {
    const { id } = req.params as any;
    const { role, name } = req.body as any;
    return prisma.user.update({ where: { id }, data: { role, name } });
  });

  // Admin only: delete user
  app.delete('/users/:id', { preHandler: [requireAdmin] }, async (req, reply) => {
    const { id } = req.params as any;
    await prisma.user.delete({ where: { id } });
    return reply.status(204).send();
  });
}
```

### Frontend: Pending Tab Badge Count

```typescript
// In DashboardPage header tab button — numeric badge
<button onClick={() => setTab('pending')}>
  {t('nav.pending')}
  {(pending.data?.total ?? 0) > 0 && (
    <span className="ml-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
      {pending.data?.total}
    </span>
  )}
</button>
```

### Frontend: Confirmation Dialog (no external lib)

```typescript
// components/ui/ConfirmDialog.tsx — simple Tailwind dialog, no Radix/Headless UI
export function ConfirmDialog({ open, title, message, onConfirm, onCancel }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        <p className="mt-2 text-sm text-gray-600">{message}</p>
        <div className="mt-4 flex justify-end gap-3">
          <button onClick={onCancel} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
            Annuler
          </button>
          <button onClick={onConfirm} className="px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-md hover:bg-red-700">
            Confirmer
          </button>
        </div>
      </div>
    </div>
  );
}
```

---

## Key Codebase Facts (Confirmed by Reading)

### Existing State (What's Already Done)

| Feature | Status | Location |
|---------|--------|----------|
| Dashboard tabs (Mes demandes / À valider) | Done (basic list cards) | `DashboardPage.tsx` |
| ActionConfirmPage (comment + submit) | Done (no workflow summary) | `ActionConfirmPage.tsx` |
| ActionErrorPage (expired/used/invalid) | Done (no dashboard link) | `ActionErrorPage.tsx` |
| WorkflowDetailPage (phases/steps/actions) | Done (no stepper, no cancel) | `WorkflowDetailPage.tsx` |
| Document download endpoint | Done | `GET /api/documents/:id/file` |
| Reminder email template | Done | `emailService.sendReminder()` |
| CANCELLED status on WorkflowStatus | Done (in schema) | `schema.prisma` |
| ScheduledEvent model | Done (exists but unused) | `schema.prisma` |
| BullMQ installed | Done | `backend/package.json` |
| UserRole enum (USER \| ADMIN) | Done (needs extension) | `schema.prisma` |
| JWT payload includes `role` | Done | `auth-service.ts JwtPayload` |

### What's Missing / Needs Building

| Feature | Gap |
|---------|-----|
| Initiator email on validator action | `emailService.sendInitiatorAction()` doesn't exist |
| Initiator email on workflow complete | `emailService.sendInitiatorComplete()` doesn't exist |
| BullMQ Worker (reminder processor) | No `reminder-worker.ts`, no Worker instantiation |
| BullMQ Queue export | No `infrastructure/queue.ts` |
| Reminder scheduling on step activation | Not called in `notifyValidators()` |
| Workflow cancel endpoint | No `PATCH /workflows/:id/cancel` |
| Manual re-notify endpoint | No `POST /workflows/:id/notify` |
| Action token info endpoint | No `GET /api/actions/:token/info` |
| User CRUD admin routes | No `routes/users.ts` |
| Dashboard filters (frontend) | No filter UI, no filter state |
| Horizontal stepper UI | Not in `WorkflowDetailPage` |
| PDF inline preview | `react-pdf` not installed |
| Dashboard link on ActionErrorPage | Missing |
| Numeric badge on pending tab | Missing |
| AdminUsersPage | Missing |
| UserRole migration (3 roles) | Missing |

---

## State of the Art

| Old Approach | Current Approach | Notes |
|--------------|------------------|-------|
| QueueScheduler (BullMQ < 2.0) | Not needed in BullMQ 2.0+ | Source: BullMQ docs |
| pdfjs raw canvas usage | `react-pdf` wrapper | Simplifies worker + rendering |
| Manual React memoization everywhere | React 19 Compiler (optional) | Project doesn't use the Compiler; `useMemo` is still explicit and correct here |

---

## Open Questions

1. **Should `INITIATEUR` and `VALIDATEUR` replace `USER`, or should `USER` remain as a fallback?**
   - What we know: `USER` role exists for all current users. No frontend role-gating logic yet.
   - What's unclear: Should all existing `USER` accounts become `INITIATEUR`? The 3-role model suggests yes.
   - Recommendation: Rename `USER` → `INITIATEUR` in the migration. One-step migration.

2. **Should dashboard filters hit the server or stay client-side?**
   - What we know: Current list endpoints return up to 20 items (paginated). Client-side filter only sees the current page.
   - What's unclear: Will the user want to filter across all pages?
   - Recommendation: For phase 10, implement client-side filter on the current page. Add `TODO: add server-side filter if pagination + filter combo is needed` comment. The locked decision says "filtres complets" but does not specify server-side; client-side is simpler and sufficient for v1.

3. **Should the BullMQ Worker run in the same process as the API server?**
   - What we know: Current `server.ts` is a single process. BullMQ workers can run in the same process.
   - Recommendation: Run in the same process for simplicity (import and start `reminderWorker` in `server.ts`). Separate process only needed if CPU-intensive jobs are expected.

4. **Password for admin-created users?**
   - What we know: Existing signup uses `scrypt` password hashing. Admin creates users.
   - What's unclear: Does admin set the initial password, or is there an invite/reset flow?
   - Recommendation: Admin sets a temporary password. Out of scope: password reset email flow. Admin simply provides an initial password that the user should change.

---

## Sources

### Primary (HIGH confidence)
- Codebase read: `/Users/mmaudet/work/validly/backend/src/` — workflow-service, email-service, token-service, auth-service, all routes, Prisma schema, app.ts, server.ts
- Codebase read: `/Users/mmaudet/work/validly/frontend/src/` — all pages, hooks, lib/api, i18n
- [BullMQ Delayed Jobs Docs](https://docs.bullmq.io/guide/jobs/delayed) — delay option, jobId idempotency
- [BullMQ Connections Docs](https://docs.bullmq.io/guide/connections) — ioredis, maxRetriesPerRequest: null
- [BullMQ Workers Docs](https://docs.bullmq.io/guide/workers) — Worker instantiation, event handling
- [BullMQ Queue Docs](https://docs.bullmq.io/guide/queues) — Queue.add() API

### Secondary (MEDIUM confidence)
- [react-pdf GitHub](https://github.com/wojtekmaj/react-pdf) — version 10.x, workerSrc setup, CSS imports
- [Prisma Filtering Docs](https://www.prisma.io/docs/orm/prisma-client/queries/filtering-and-sorting) — contains, mode: insensitive, OR, date range

### Tertiary (LOW confidence)
- WebSearch results on Fastify RBAC — confirmed that inline preHandler is the correct pattern (no new plugin needed)
- WebSearch on React 19 + useMemo — confirmed useMemo still appropriate for explicit filter/sort operations

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all confirmed from package.json and codebase
- Architecture: HIGH — based on direct codebase reading
- BullMQ patterns: MEDIUM-HIGH — verified from official docs
- react-pdf patterns: MEDIUM — verified from GitHub README
- Pitfalls: HIGH for schema migration and worker startup; MEDIUM for others

**Research date:** 2026-02-19
**Valid until:** 2026-03-19 (BullMQ docs stable; react-pdf 10.x stable; Prisma 6.x stable)
