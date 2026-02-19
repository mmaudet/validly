# Phase 11: Engine & Wiring Fixes - Research

**Researched:** 2026-02-19
**Domain:** Workflow engine correctness, frontend type alignment, email locale resolution, PostgreSQL audit immutability, TypeScript domain types
**Confidence:** HIGH

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| WF-02 | Workflow engine supports sequential phases containing sequential or parallel steps | Parallel activation requires modifying `launch()` and `tryAdvance()` in workflow-service.ts; logic identified in codebase |
| WF-08 | Workflow instances are deep-copied from templates at launch (template changes don't affect running workflows) | The mismatch is in TemplatePicker.tsx using `executionMode` while backend JSON stores `execution`; fix is a type rename in that file only |
| EMAIL-06 | Email templates are localized (EN + FR) | `notifyValidators()` and `notifyCurrentStep()` hardcode `locale: 'fr'`; fix requires Prisma bulk user lookup by email array |
| INFRA-05 | Email templates are fully localized in English and French | Same fix as EMAIL-06 + reminder-worker.ts hardcodes `locale: 'fr'`; fix requires loading step validators' User records |
| AUDIT-02 | Audit trail table enforces INSERT-only at database level (no UPDATE or DELETE) | SQL trigger already written in `prisma/audit-immutability.sql`; not yet in a Prisma migration; needs a custom migration |
</phase_requirements>

---

## Summary

Phase 11 is entirely a gap-closure phase — all five bugs are in existing production code with no new library dependencies required. The fixes are surgical: two workflow-service.ts changes (parallel activation at launch and in tryAdvance), one TypeScript type rename in TemplatePicker.tsx, two locale-lookup changes in workflow-service.ts and reminder-worker.ts, one Prisma migration for audit immutability, and one type addition in workflow-types.ts.

The most complex fix is EMAIL-06/INFRA-05: the `notifyValidators()` function currently loops over plain email strings but needs to resolve each email to a User record to obtain the preferred locale. This requires a `prisma.user.findMany({ where: { email: { in: validatorEmails } } })` call before the notification loop, with a fallback to `'en'` for validators not yet registered in the system (email-only validators are valid in the schema).

The AUDIT-02 fix already has the SQL written in `prisma/audit-immutability.sql` — it just needs to be promoted into a proper Prisma migration so it runs automatically. The correct Prisma mechanism for custom SQL in migrations is `prisma migrate dev --create-only` followed by appending the SQL to the generated migration file.

**Primary recommendation:** Execute fixes in dependency order — domain type first (ARCHIVED in workflow-types.ts), then parallel engine (WF-02), then template type alignment (WF-08), then locale resolution (EMAIL-06/INFRA-05), then audit migration (AUDIT-02).

---

## Standard Stack

No new dependencies for this phase. All fixes use the existing stack.

### Core (already installed)
| Library | Version | Purpose | Relevant to Phase |
|---------|---------|---------|------------------|
| Prisma | 6.5.0 | ORM + migration runner | AUDIT-02 migration, locale lookup |
| PostgreSQL | 15 | Database | AUDIT-02 trigger/rule |
| TypeScript | 5.8 | Type system | WF-08 type alignment, ARCHIVED type |
| Fastify | 5 | API server | No changes needed |
| React Hook Form | (frontend) | Form state | WF-08 form type unchanged |

### No New Installations Required

This phase is pure bug fixes within the existing stack.

---

## Architecture Patterns

### Existing Code Locations (authoritative map)

```
backend/src/
├── domain/
│   ├── workflow-types.ts          # ARCHIVED fix: add to WorkflowStatus union
│   └── state-machine.ts          # No changes needed
├── services/
│   └── workflow-service.ts       # WF-02: launch() + tryAdvance()
│                                 # EMAIL-06: notifyValidators() + notifyCurrentStep()
└── jobs/
    └── reminder-worker.ts        # INFRA-05: hardcoded locale: 'fr'

backend/prisma/
├── schema.prisma                 # Already has ARCHIVED in WorkflowStatus enum
├── audit-immutability.sql        # SQL exists, not in migration
└── migrations/
    └── [new migration]/          # AUDIT-02: promote SQL to migration

frontend/src/
├── components/workflow/
│   └── TemplatePicker.tsx        # WF-08: executionMode → execution in Template type
└── pages/
    └── WorkflowCreatePage.tsx    # Already has correct templateStructureToForm()
                                  # but reads step.executionMode (which is undefined)
```

### Pattern 1: Parallel Step Activation at Launch (WF-02)

**What:** In `launch()`, when phase 0 is activated, all steps whose execution field is `'PARALLEL'` within that phase should be activated simultaneously, not just `si === 0`.

**Current bug (workflow-service.ts line ~110):**
```typescript
// BUG: Only the very first step (pi===0 && si===0) gets IN_PROGRESS
const isFirstStep = pi === 0 && si === 0;
await tx.stepInstance.create({
  data: {
    ...
    status: isFirstStep ? 'IN_PROGRESS' : 'PENDING',
  },
});
```

**Fix — launch() logic:**
The activation condition for phase 0 steps should be: activate ALL steps in the first phase if ANY step in that phase has `execution: 'PARALLEL'`. If all steps are SEQUENTIAL, activate only step 0 (current behavior).

```typescript
// Determine activation mode for phase 0
const phaseIsParallel = pi === 0 && phaseDef.steps.some(s => s.execution === 'PARALLEL');
const isFirstStep = pi === 0 && si === 0;
const shouldActivate = phaseIsParallel || isFirstStep;
await tx.stepInstance.create({
  data: {
    ...
    status: (pi === 0 && shouldActivate) ? 'IN_PROGRESS' : 'PENDING',
  },
});
```

**After-transaction email blast:** The launch() code currently only calls `notifyValidators` for `firstStep`. For parallel activation, it must notify ALL IN_PROGRESS steps in phase 0.

### Pattern 2: Parallel Step Advancement in tryAdvance() (WF-02)

**What:** In `tryAdvance()`, after a step is APPROVED, the current code always finds the first PENDING step and activates it sequentially. For PARALLEL phases, if a step approves but siblings are still IN_PROGRESS, no new step should be activated — the phase only advances when ALL parallel steps complete.

**Current code (workflow-service.ts line ~506):**
```typescript
} else if (phaseResult === 'IN_PROGRESS') {
  // BUG: Always activates next PENDING step regardless of execution mode
  const nextStep = steps.find((s: any) => s.status === 'PENDING');
  if (nextStep) {
    await tx.stepInstance.update({...});
    activatedStep = { ... };
  }
}
```

**Fix:**
```typescript
} else if (phaseResult === 'IN_PROGRESS') {
  // Only activate next PENDING step if in SEQUENTIAL mode
  // In PARALLEL mode, all steps were activated at phase start — no new activations
  const hasParallelStep = steps.some((s: any) => s.execution === 'PARALLEL');
  if (!hasParallelStep) {
    const nextStep = steps.find((s: any) => s.status === 'PENDING');
    if (nextStep) {
      await tx.stepInstance.update({ where: { id: nextStep.id }, data: { status: 'IN_PROGRESS' } });
      activatedStep = { id: nextStep.id, name: nextStep.name, validatorEmails: nextStep.validatorEmails };
    }
  }
}
```

**Phase advance for parallel:** When `tryAdvance()` is called for a PARALLEL phase, `evaluatePhaseCompletion` already handles this correctly — it returns `'IN_PROGRESS'` until all steps are APPROVED, then returns `'APPROVED'`. No changes needed to evaluatePhaseCompletion.

### Pattern 3: Template Type Alignment (WF-08)

**Root cause:** `TemplatePicker.tsx` has its own local `Template` interface with `step.executionMode`, but the backend stores `step.execution` in the JSON blob. The mapping function `templateStructureToForm()` in `WorkflowCreatePage.tsx` reads `step.executionMode` which is always undefined.

**Fix — only change TemplatePicker.tsx's local type:**
```typescript
// BEFORE (TemplatePicker.tsx line 17):
executionMode: 'SEQUENTIAL' | 'PARALLEL';

// AFTER:
execution: 'SEQUENTIAL' | 'PARALLEL';
```

**Then fix templateStructureToForm() in WorkflowCreatePage.tsx:**
```typescript
// BEFORE (line 114):
executionMode: step.executionMode,

// AFTER:
executionMode: step.execution,
```

The form type `StepForm.executionMode` stays as-is (prior decision: executionMode renamed to execution only in API payload builder — form type unchanged).

### Pattern 4: Validator Locale Resolution (EMAIL-06 / INFRA-05)

**Root cause:** `notifyValidators()` receives `validatorEmails: string[]` but has no access to User records, so it hardcodes `locale: 'fr'`.

**Fix strategy — batch User lookup before notification loop:**

```typescript
async function notifyValidators(
  stepId: string,
  validatorEmails: string[],
  context: { ... }
) {
  // Resolve validator locales (validators may not be registered users)
  const validatorUsers = await prisma.user.findMany({
    where: { email: { in: validatorEmails } },
    select: { email: true, locale: true },
  });
  const localeByEmail = new Map(validatorUsers.map(u => [u.email, u.locale]));

  const tokens = await tokenService.createTokensForStep(stepId, validatorEmails);
  for (const email of validatorEmails) {
    const { approveToken, refuseToken } = tokens[email];
    await emailService.sendPendingAction({
      to: email,
      locale: localeByEmail.get(email) ?? 'en',  // fallback to 'en'
      ...
    });
  }
}
```

**Same fix pattern for `notifyCurrentStep()`** (line 712): replace `locale: 'fr'` with locale from User record.

**Fix for reminder-worker.ts:** The step is loaded with full context including `workflow`. Need to also load the pending validators' locales:

```typescript
// In reminder-worker.ts, after resolving pendingEmails:
const validatorUsers = await prisma.user.findMany({
  where: { email: { in: pendingEmails } },
  select: { email: true, locale: true },
});
const localeByEmail = new Map(validatorUsers.map(u => [u.email, u.locale]));

// Then use localeByEmail.get(email) ?? 'en' in the loop
```

**Deadline date localization fix:** reminder-worker.ts line 59 hardcodes `'fr-FR'` locale for date formatting:
```typescript
// BEFORE:
step.deadline.toLocaleDateString('fr-FR')

// AFTER:
step.deadline.toLocaleDateString(localeByEmail.get(email) === 'fr' ? 'fr-FR' : 'en-GB')
```

### Pattern 5: Audit Immutability Migration (AUDIT-02)

**Problem:** The SQL for audit immutability exists in `prisma/audit-immutability.sql` but is not in a Prisma migration. The `db:setup` script manually applies it via psql. This means it is NOT applied in CI, staging deployments that use `prisma migrate deploy`, or any fresh environment that doesn't run the manual step.

**Correct approach — Prisma custom migration:**

Prisma supports embedding arbitrary SQL in a migration file. The migration must be created with `--create-only` to prevent automatic execution, then the SQL is appended before running `migrate deploy`.

**Migration creation command:**
```bash
cd backend && npx prisma migrate dev --create-only --name add_audit_immutability_triggers
```

**Migration file content** (copy from existing `audit-immutability.sql`, already correct):
```sql
-- Enforce immutability on audit_events table at database level.

-- Prevent UPDATE
CREATE OR REPLACE FUNCTION prevent_audit_update()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'UPDATE operations are not allowed on audit_events table';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_no_update ON audit_events;
CREATE TRIGGER audit_no_update
  BEFORE UPDATE ON audit_events
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_update();

-- Prevent DELETE
CREATE OR REPLACE FUNCTION prevent_audit_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'DELETE operations are not allowed on audit_events table';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_no_delete ON audit_events;
CREATE TRIGGER audit_no_delete
  BEFORE DELETE ON audit_events
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_delete();
```

**After creating migration:** Run `npx prisma migrate dev` to apply. Then update `db:setup` script to remove the manual psql step (the migration now handles it).

**Idempotency:** The SQL uses `CREATE OR REPLACE FUNCTION` and `DROP TRIGGER IF EXISTS` before `CREATE TRIGGER`, making it safe to re-apply.

### Pattern 6: ARCHIVED Status in Domain Type (WF-02 tech debt)

**Current state:**
- `prisma/schema.prisma`: `WorkflowStatus` enum INCLUDES `ARCHIVED` (added in migration `20260219200000_add_archived_status`)
- `backend/src/domain/workflow-types.ts` line 1: `export type WorkflowStatus = 'DRAFT' | 'IN_PROGRESS' | 'APPROVED' | 'REFUSED' | 'CANCELLED';` — MISSING `'ARCHIVED'`

**Fix:**
```typescript
// workflow-types.ts line 1:
export type WorkflowStatus = 'DRAFT' | 'IN_PROGRESS' | 'APPROVED' | 'REFUSED' | 'CANCELLED' | 'ARCHIVED';
```

**Impact:** The Prisma-generated enum already has `ARCHIVED` so the DB side works. The domain type omission means TypeScript type-checking doesn't catch incorrect status handling at compile time.

### Anti-Patterns to Avoid

- **Changing form type `executionMode`:** The form field is intentionally named `executionMode` — only the API payload builder renames it to `execution`. Do not rename the form field.
- **Using `OR` trigger instead of separate UPDATE/DELETE triggers:** The existing SQL correctly separates UPDATE and DELETE into distinct trigger functions. Do not combine them into a single trigger.
- **Parallel activation based on step-level execution, not phase-level:** The spec says "a workflow with PARALLEL steps activates all steps in the phase simultaneously." The check `steps.some(s => s.execution === 'PARALLEL')` is phase-level — if ANY step in the phase is PARALLEL, all steps activate together.
- **Adding a database query inside the Prisma transaction for locale lookup:** The locale lookup is NOT needed inside the transaction (which is performance-sensitive). Do it after the transaction commits, before the email loop.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Audit immutability | Custom application-level guard | PostgreSQL BEFORE trigger | Application guards can be bypassed by direct DB access; triggers are enforced at DB level |
| Locale resolution | Passing locale through every service call chain | Prisma `findMany` with `email: { in: [...] }` | Single batch query before notification loop, simpler than restructuring call chains |
| Parallel quorum | Custom parallel state tracker | Existing `evaluatePhaseCompletion` | Already handles parallel correctly — returns IN_PROGRESS until all steps APPROVED |

---

## Common Pitfalls

### Pitfall 1: Parallel Launch Missing Email Notifications
**What goes wrong:** Fixing `launch()` to set multiple steps IN_PROGRESS but forgetting to send email to ALL of them — only the `firstStep` notification call is in the current code.
**Why it happens:** The email notification code after the transaction only checks `firstStep`.
**How to avoid:** After fixing launch(), replace the `firstStep` notification block with a loop over ALL IN_PROGRESS steps in phase 0.
**Warning signs:** Parallel validators get no email at launch even though their steps are correctly set to IN_PROGRESS.

### Pitfall 2: PENDING Step Activated in a Parallel Phase After One Approval
**What goes wrong:** Fixing `launch()` for parallel but not fixing `tryAdvance()` — when one parallel step is approved, the engine activates the next PENDING step (which shouldn't happen; all steps were already IN_PROGRESS at launch).
**Why it happens:** The `tryAdvance()` IN_PROGRESS branch blindly finds any PENDING step.
**How to avoid:** Guard the PENDING step activation with a check that the phase has no PARALLEL steps.
**Warning signs:** After first parallel step approval, a previously PENDING step (there shouldn't be any in a parallel phase) gets activated.

### Pitfall 3: Audit Migration Double-Apply
**What goes wrong:** `DROP TRIGGER IF EXISTS` safely handles re-runs, but if the existing database already has the triggers from the manual psql run, the migration may fail if the function is in use.
**Why it happens:** `CREATE OR REPLACE FUNCTION` is safe but the trigger drop/recreate sequence is fine.
**How to avoid:** The existing SQL already uses `DROP TRIGGER IF EXISTS` and `CREATE OR REPLACE FUNCTION` — it is idempotent. No extra guards needed.
**Warning signs:** None expected; the SQL is already idempotent.

### Pitfall 4: Validator Locale Lookup with Unregistered Validators
**What goes wrong:** `prisma.user.findMany({ where: { email: { in: validatorEmails } } })` returns fewer records than emails if some validators are not registered users (external email addresses only).
**Why it happens:** The schema allows any email as `validatorEmails` — not all must be Users.
**How to avoid:** Always use `localeByEmail.get(email) ?? 'en'` with a fallback. This is correct because unregistered validators have no locale preference.
**Warning signs:** Unregistered validator emails produce `undefined` locale, causing the email service to render French content.

### Pitfall 5: Template Type Fix Breaking Form Reset
**What goes wrong:** Renaming `executionMode` to `execution` in the Template type changes what `templateStructureToForm()` reads from the template JSON, but the form state still uses `executionMode` — if the mapping function is not updated to bridge the two, the form field resets to `undefined`.
**Why it happens:** Two separate renames are needed: (1) Template type field name, (2) The property read in templateStructureToForm().
**How to avoid:** Fix both in the same commit: `TemplatePicker.tsx` type + `WorkflowCreatePage.tsx` mapping function.

---

## Code Examples

### WF-02: Parallel Launch — Step Activation

```typescript
// Source: backend/src/services/workflow-service.ts — launch() refactored

for (let pi = 0; pi < structureSnapshot.phases.length; pi++) {
  const phaseDef = structureSnapshot.phases[pi];
  const phase = await tx.phaseInstance.create({
    data: {
      workflowId: wf.id,
      order: pi,
      name: phaseDef.name,
      status: pi === 0 ? 'IN_PROGRESS' : 'PENDING',
    },
  });

  // Determine if this phase uses parallel execution
  const phaseHasParallel = phaseDef.steps.some(
    (s: StepStructure) => s.execution === 'PARALLEL'
  );

  for (let si = 0; si < phaseDef.steps.length; si++) {
    const stepDef = phaseDef.steps[si];
    // In phase 0: activate ALL steps if phase is parallel, else only step 0
    const isActiveStep = pi === 0 && (phaseHasParallel || si === 0);
    await tx.stepInstance.create({
      data: {
        phaseId: phase.id,
        order: si,
        name: stepDef.name,
        status: isActiveStep ? 'IN_PROGRESS' : 'PENDING',
        execution: stepDef.execution,
        quorumRule: stepDef.quorumRule,
        quorumCount: stepDef.quorumCount,
        validatorEmails: stepDef.validatorEmails,
        deadline: stepDef.deadlineHours
          ? new Date(Date.now() + stepDef.deadlineHours * 60 * 60 * 1000)
          : null,
      },
    });
  }
}
```

### WF-02: Parallel tryAdvance — Prevent Sequential Activation

```typescript
// Source: backend/src/services/workflow-service.ts — tryAdvance() refactored

} else if (phaseResult === 'IN_PROGRESS') {
  // For SEQUENTIAL phases: activate next pending step
  // For PARALLEL phases: all steps were activated at launch; nothing to do here
  const phaseHasParallel = steps.some((s: any) => s.execution === 'PARALLEL');
  if (!phaseHasParallel) {
    const nextStep = steps.find((s: any) => s.status === 'PENDING');
    if (nextStep) {
      await tx.stepInstance.update({
        where: { id: nextStep.id },
        data: { status: 'IN_PROGRESS' },
      });
      activatedStep = {
        id: nextStep.id,
        name: nextStep.name,
        validatorEmails: nextStep.validatorEmails,
      };
    }
  }
}
```

### WF-02: Post-Launch Email for All Parallel Steps

```typescript
// Source: backend/src/services/workflow-service.ts — after transaction in launch()

// After transaction: notify all IN_PROGRESS steps in phase 0
const firstPhase = result.phases[0];
if (firstPhase) {
  const activeSteps = firstPhase.steps.filter((s: any) => s.status === 'IN_PROGRESS');
  for (const step of activeSteps) {
    await notifyValidators(step.id, step.validatorEmails, {
      workflowTitle: result.title,
      documentTitle: result.documents[0]?.document?.title ?? result.title,
      stepName: step.name,
      initiatorName: result.initiator.name,
    });
    if (step.deadline) {
      try {
        await scheduleReminder(step.id, step.deadline);
      } catch (err) {
        console.error('Failed to schedule reminder for step:', err);
      }
    }
  }
}
```

### EMAIL-06: Locale-Aware notifyValidators

```typescript
// Source: backend/src/services/workflow-service.ts

async function notifyValidators(
  stepId: string,
  validatorEmails: string[],
  context: {
    workflowTitle: string;
    documentTitle: string;
    stepName: string;
    initiatorName: string;
  }
) {
  try {
    // Resolve validator locales (batch query; fallback 'en' for unregistered validators)
    const validatorUsers = await prisma.user.findMany({
      where: { email: { in: validatorEmails } },
      select: { email: true, locale: true },
    });
    const localeByEmail = new Map(validatorUsers.map(u => [u.email, u.locale]));

    const tokens = await tokenService.createTokensForStep(stepId, validatorEmails);
    for (const email of validatorEmails) {
      const { approveToken, refuseToken } = tokens[email];
      await emailService.sendPendingAction({
        to: email,
        locale: localeByEmail.get(email) ?? 'en',
        workflowTitle: context.workflowTitle,
        documentTitle: context.documentTitle,
        stepName: context.stepName,
        initiatorName: context.initiatorName,
        approveUrl: `${env.API_URL}/api/actions/${approveToken}`,
        refuseUrl: `${env.API_URL}/api/actions/${refuseToken}`,
      });
    }
  } catch (err) {
    console.error('Failed to send validator notifications:', err);
  }
}
```

### INFRA-05: Locale-Aware Reminder Worker

```typescript
// Source: backend/src/jobs/reminder-worker.ts — locale resolution section

// Find validators who haven't acted yet
const pendingEmails = step.validatorEmails.filter((email) => !actedEmails.has(email));

if (pendingEmails.length === 0) {
  console.info(`Reminder job: all validators have acted on step ${stepId}, skipping`);
  return;
}

// Resolve locales for pending validators
const validatorUsers = await prisma.user.findMany({
  where: { email: { in: pendingEmails } },
  select: { email: true, locale: true },
});
const localeByEmail = new Map(validatorUsers.map(u => [u.email, u.locale]));

const tokens = await tokenService.createTokensForStep(stepId, pendingEmails);

for (const email of pendingEmails) {
  const { approveToken, refuseToken } = tokens[email];
  const locale = localeByEmail.get(email) ?? 'en';
  const deadlineDate = step.deadline
    ? step.deadline.toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-GB')
    : '';

  try {
    await emailService.sendReminder({
      to: email,
      locale,
      workflowTitle: workflow.title,
      documentTitle: workflow.documents[0]?.document.title ?? workflow.title,
      stepName: step.name,
      deadlineDate,
      approveUrl: `${env.API_URL}/api/actions/${approveToken}`,
      refuseUrl: `${env.API_URL}/api/actions/${refuseToken}`,
    });
  } catch (err) {
    console.error(`Reminder job: failed to send reminder to ${email}:`, err);
  }
}
```

### AUDIT-02: Prisma Custom Migration

```bash
# Step 1: Create empty migration shell
cd /Users/mmaudet/work/validly/backend
npx prisma migrate dev --create-only --name add_audit_immutability_triggers
```

The created file will be at:
`prisma/migrations/TIMESTAMP_add_audit_immutability_triggers/migration.sql`

Paste the content of `prisma/audit-immutability.sql` into that file, then:

```bash
# Step 2: Apply migration
npx prisma migrate dev
```

```bash
# Step 3: Update db:setup in package.json (remove manual psql step)
# BEFORE: "db:setup": "prisma migrate dev && psql $DATABASE_URL -f prisma/audit-immutability.sql"
# AFTER:  "db:setup": "prisma migrate dev"
```

### WF-08: Template Type Fix

```typescript
// BEFORE — TemplatePicker.tsx lines 16-17:
steps: Array<{
  name: string;
  executionMode: 'SEQUENTIAL' | 'PARALLEL';  // WRONG: backend stores 'execution'

// AFTER:
steps: Array<{
  name: string;
  execution: 'SEQUENTIAL' | 'PARALLEL';      // CORRECT: matches backend JSON field
```

```typescript
// BEFORE — WorkflowCreatePage.tsx templateStructureToForm() line 114:
executionMode: step.executionMode,            // reads undefined

// AFTER:
executionMode: step.execution,               // reads correct value from template JSON
```

### ARCHIVED Domain Type Fix

```typescript
// BEFORE — backend/src/domain/workflow-types.ts line 1:
export type WorkflowStatus = 'DRAFT' | 'IN_PROGRESS' | 'APPROVED' | 'REFUSED' | 'CANCELLED';

// AFTER:
export type WorkflowStatus = 'DRAFT' | 'IN_PROGRESS' | 'APPROVED' | 'REFUSED' | 'CANCELLED' | 'ARCHIVED';
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual psql for audit triggers | Prisma custom migration | Phase 11 | Triggers run automatically with `migrate deploy` in all environments |
| Hardcoded locale: 'fr' | Per-validator locale lookup | Phase 11 | Validators receive emails in their preferred language |
| Only first step activated at launch | All parallel steps activated | Phase 11 | PARALLEL execution mode is actually enforced |

**Existing behavior that is already correct (do not change):**
- `evaluatePhaseCompletion()` in state-machine.ts: correctly returns IN_PROGRESS until all steps are APPROVED — works for parallel without modification
- `buildWorkflowPayload()` in WorkflowCreatePage.tsx: correctly renames `executionMode → execution` for the API — do not change
- Initiator locale handling: already uses `wfWithInitiator.initiator.locale` correctly — this is the reference pattern to follow for validators
- `WorkflowStatus` enum in schema.prisma: ARCHIVED is already present from migration `20260219200000_add_archived_status`

---

## Open Questions

1. **notifyCurrentStep() locale for non-User validators**
   - What we know: `notifyCurrentStep()` loops over `pendingEmails` which are raw strings from `activeStep.validatorEmails`
   - What's unclear: Should non-registered validators default to 'en' or the initiator's locale?
   - Recommendation: Default to 'en' (English is the neutral lingua franca and the system default). This is consistent with the User model's `locale: { default: 'en' }` in Prisma schema.

2. **Parallel phase next-phase activation**
   - What we know: When phase N completes (all parallel steps APPROVED), `tryAdvance()` correctly activates phase N+1's FIRST step
   - What's unclear: Should phase N+1 also check if it's a parallel phase and activate ALL its steps immediately?
   - Recommendation: YES — when `tryAdvance()` activates a next phase, it should also check `phaseHasParallel` for the next phase and activate accordingly. The current `findFirst({ where: { phaseId: nextPhase.id, order: 0 } })` should be replaced with logic similar to launch().

3. **Refusal routing for parallel phases**
   - What we know: `handleRefusal()` reactivates "the last step of the previous phase" — this is sequential-centric
   - What's unclear: For a parallel phase, which step should be reactivated on refusal from a later phase?
   - Recommendation: The audit finding does not mention refusal routing as a gap to fix in this phase. Stay within the stated scope — do not change handleRefusal() in Phase 11.

---

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection — all findings are from reading actual source files
- `backend/src/services/workflow-service.ts` — launch(), tryAdvance(), notifyValidators(), notifyCurrentStep()
- `backend/src/jobs/reminder-worker.ts` — hardcoded locale discovery
- `backend/src/domain/workflow-types.ts` — missing ARCHIVED type
- `backend/prisma/schema.prisma` — existing ARCHIVED enum, User.locale field, AuditEvent model
- `backend/prisma/audit-immutability.sql` — existing trigger SQL
- `frontend/src/components/workflow/TemplatePicker.tsx` — executionMode type mismatch
- `frontend/src/pages/WorkflowCreatePage.tsx` — templateStructureToForm() bug + buildWorkflowPayload() correct behavior

### Secondary (MEDIUM confidence)
- Prisma migration docs (from training knowledge, consistent with observed migration patterns in codebase): `--create-only` flag for custom SQL migrations is standard Prisma 6.x usage

### Tertiary (LOW confidence)
- None needed — all fixes are derived from direct code inspection

---

## Metadata

**Confidence breakdown:**
- Bug identification: HIGH — all bugs confirmed by reading source code directly
- Fix patterns: HIGH — all fixes follow existing patterns already in the codebase (e.g., initiator locale lookup is the reference pattern for validator locale lookup)
- Migration approach: HIGH — audit-immutability.sql already exists and is correct; only needs promotion to Prisma migration
- Open Question 2 (next-phase parallel activation): MEDIUM — logically implied by the fix but not explicitly in the audit finding

**Research date:** 2026-02-19
**Valid until:** 2026-03-19 (stable domain — no external library changes expected)
