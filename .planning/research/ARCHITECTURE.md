# Architecture Research

**Domain:** Document validation workflow platform (open-source, self-hosted)
**Researched:** 2026-02-19
**Confidence:** MEDIUM — Core patterns drawn from multiple converging sources; Validly-specific design choices (no BPMN, email-as-action, secure token links) informed by first-principles derivation from verified ecosystem patterns.

---

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Clients                                  │
│   HTTP API Consumers (curl, SDKs, future UI, webhook senders)   │
└────────────────────────────────┬────────────────────────────────┘
                                 │  REST / JSON (OpenAPI)
┌────────────────────────────────▼────────────────────────────────┐
│                          API Layer                               │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │  Auth/Token │  │  Controllers │  │   Token Resolver     │   │
│  │  Middleware │  │  (Routes)    │  │  (email link entry)  │   │
│  └──────┬──────┘  └──────┬───────┘  └──────────┬───────────┘   │
└─────────┼────────────────┼──────────────────────┼───────────────┘
          │                │                      │
┌─────────▼────────────────▼──────────────────────▼───────────────┐
│                       Service Layer                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │  Workflow    │  │  Document    │  │   Notification       │   │
│  │  Service     │  │  Service     │  │   Service (email)    │   │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘   │
│         │                 │                      │               │
│  ┌──────▼───────────────────────────────────────▼───────────┐   │
│  │              State Machine Engine                         │   │
│  │  (phase/step transitions, validator logic, token issue)  │   │
│  └──────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
          │                │                      │
┌─────────▼────────────────▼──────────────────────▼───────────────┐
│                     Infrastructure Layer                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │  PostgreSQL  │  │  File Store  │  │   SMTP Mailer        │   │
│  │  (primary DB)│  │  Adapter     │  │   (+ retry queue)    │   │
│  └──────────────┘  └──────────────┘  └──────────────────────┘   │
│       ┌──────────────────────────────────────────────┐           │
│       │  File Store: local FS → MinIO (S3-compat.)   │           │
│       └──────────────────────────────────────────────┘           │
└─────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Communicates With |
|-----------|----------------|-------------------|
| API Layer (Controllers) | Parse HTTP requests, validate input shape, map to service calls, serialize responses | Service Layer |
| Auth/Token Middleware | Validate JWT session tokens; also resolve one-time action tokens from email links | Service Layer, DB |
| Token Resolver | Dedicated handler for `GET /actions/:token` — resolves secure one-time tokens to workflow actions | State Machine Engine |
| Workflow Service | Orchestrates WorkflowInstance lifecycle: create from template, advance phases, track status | State Machine, DB, Notification Service |
| Document Service | Attach/detach/retrieve files, delegate to File Store adapter | File Store Adapter, DB |
| Notification Service | Compose and dispatch emails (invitations, reminders, decisions); issue tokens for email links | SMTP Mailer, DB (token store) |
| State Machine Engine | Core domain: evaluate phase/step completion rules, enforce valid transitions, reject illegal ones | PostgreSQL (read/write state) |
| PostgreSQL | Source of truth for all relational data (users, templates, instances, phases, steps, actions) | All service-layer components |
| File Store Adapter | Abstraction over local FS or MinIO; exposes put/get/delete by key | Local FS or MinIO |
| SMTP Mailer | Send transactional emails with retry on failure; no message broker required at MVP scale | External SMTP relay |

---

## Recommended Project Structure

```
validly/
├── src/
│   ├── api/                   # HTTP layer only — routes, middleware, request parsing
│   │   ├── middleware/        # auth, i18n locale, error handling
│   │   ├── routes/            # one file per resource (workflows, documents, users, tokens)
│   │   └── validators/        # input schema validation (Zod/Joi) — no business logic
│   │
│   ├── services/              # Use-case orchestration — thin, delegates to domain
│   │   ├── workflow.service.ts
│   │   ├── document.service.ts
│   │   └── notification.service.ts
│   │
│   ├── domain/                # Core domain: state machine, transition rules, business invariants
│   │   ├── state-machine/     # Phase/step FSM implementation
│   │   ├── models/            # Domain entity types (not ORM models)
│   │   └── rules/             # Completion rules (all validators must act, majority, etc.)
│   │
│   ├── repositories/          # All DB access — no SQL outside this folder
│   │   ├── workflow-instance.repo.ts
│   │   ├── workflow-template.repo.ts
│   │   ├── document.repo.ts
│   │   ├── user.repo.ts
│   │   └── action-token.repo.ts
│   │
│   ├── infrastructure/        # Adapters to external systems
│   │   ├── mailer/            # SMTP adapter + retry logic
│   │   ├── storage/           # File store abstraction (local + MinIO implementations)
│   │   └── db/                # DB client, migration runner, connection pool
│   │
│   ├── i18n/                  # Translation files and locale resolver
│   │   ├── en/
│   │   └── fr/
│   │
│   └── config/                # Environment loading, validated at startup
│
├── migrations/                # SQL migration files (numbered, up-only)
├── openapi/                   # OpenAPI spec (source of truth or generated)
├── docker-compose.yml
├── docker-compose.dev.yml
└── tests/
    ├── unit/                  # Domain/state machine tests — no DB required
    ├── integration/           # Service tests against real DB (test containers)
    └── e2e/                   # Full HTTP-level tests
```

### Structure Rationale

- **`domain/` is the most important folder.** The state machine and transition rules live here with zero infrastructure dependencies. This makes them fast to test and safe to reason about.
- **`repositories/` isolates all SQL.** If the DB schema changes, only repository files change — services never write raw SQL.
- **`infrastructure/`** adapters own the `storage/` interface, letting you swap local FS → MinIO with one line in a factory.
- **`api/` does no work.** It parses, delegates, and serializes. No business logic leaks into controllers.

---

## Architectural Patterns

### Pattern 1: Template / Instance Split

**What:** WorkflowTemplate defines the blueprint (phases, steps, validators, rules). WorkflowInstance is a live execution created by copying/snapshotting the template at launch time.

**When to use:** Always — this is non-negotiable for document workflows. Templates change over time; live instances must be frozen to the structure they started with.

**Trade-offs:** Slightly more DB complexity (two parallel hierarchies: template and instance). But avoids the catastrophic bug where editing a template retroactively breaks running instances.

**Example:**
```typescript
// Launching a workflow creates a snapshot, not a reference
async function launchWorkflow(templateId: string, initiatorId: string): Promise<WorkflowInstance> {
  const template = await templateRepo.findWithPhasesAndSteps(templateId);
  const instance = snapshotTemplate(template); // deep copy with new IDs
  instance.status = 'in_progress';
  instance.initiatedBy = initiatorId;
  instance.launchedAt = new Date();
  return await instanceRepo.create(instance);
}
```

**Confidence:** HIGH — Validated by multiple sources (Vertabelo, ExceptionNotFound workflow series, pg-workflow schema separation of "type" vs "request").

### Pattern 2: Explicit State Machine with Valid Transition Guards

**What:** Every status change (draft → in_progress, step pending → completed, etc.) goes through a central transition function that enforces allowed transitions. Illegal transitions throw, they do not silently no-op.

**When to use:** Always for workflow state. This is the architecture choice that prevents corrupted workflow state in production.

**Trade-offs:** More explicit code than field updates, but eliminates an entire class of bugs.

**Example:**
```typescript
type InstanceStatus = 'draft' | 'in_progress' | 'approved' | 'refused';

const ALLOWED_INSTANCE_TRANSITIONS: Record<InstanceStatus, InstanceStatus[]> = {
  draft:       ['in_progress'],
  in_progress: ['approved', 'refused'],
  approved:    [],   // terminal
  refused:     [],   // terminal
};

function transitionInstance(instance: WorkflowInstance, to: InstanceStatus): WorkflowInstance {
  const allowed = ALLOWED_INSTANCE_TRANSITIONS[instance.status];
  if (!allowed.includes(to)) {
    throw new InvalidTransitionError(`Cannot transition from ${instance.status} to ${to}`);
  }
  return { ...instance, status: to, updatedAt: new Date() };
}
```

**Confidence:** HIGH — Corroborated by Windmill FSM docs, pg-workflow state/resolution separation, Nordic APIs REST state machine article.

### Pattern 3: Secure One-Time Token for Email Actions

**What:** When a validator must approve/refuse a step, the system generates a short-lived, single-use opaque token stored in the DB. The token is embedded in an email link. On click, the API resolves the token → action → user → step, then executes the decision.

**When to use:** Any time an external actor (who may not have an account session) needs to perform a workflow action via email. This is Validly's primary action channel.

**Trade-offs:** Requires a token store table. Tokens must expire (15–30 min for action links) and be invalidated after use. Replay attacks are prevented by single-use guarantee.

**Implementation notes:**
- Token = 32+ byte CSPRNG hex string (not JWT — no information leakage)
- Store: `action_tokens(token_hash, action_type, step_id, validator_id, expires_at, used_at)`
- Hash the token before storing (store hash, email the plain value)
- The `GET /actions/:token` endpoint is the sole entry point — it requires no session

**Confidence:** MEDIUM — Magic link pattern is well-documented (Auth0, Postmark, SuperTokens); Validly's use for workflow actions (not auth) is a direct application of the same pattern.

### Pattern 4: Append-Only Action Log for Audit Trail

**What:** Every workflow event (step decision, status change, document upload, email sent) is recorded as an immutable append-only row in an `actions` (or `audit_log`) table. The table is never updated, only inserted into.

**When to use:** Document validation workflows have legal/compliance implications. An audit trail is not optional.

**Trade-offs:** More storage, but critical for debugging and user trust. Querying history requires joining on audit table rather than reading current state.

**Example table:**
```sql
CREATE TABLE workflow_actions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES workflow_instances(id),
  step_id     UUID REFERENCES steps(id),
  actor_id    UUID REFERENCES users(id),
  action_type TEXT NOT NULL,  -- 'step_approved', 'step_refused', 'doc_uploaded', etc.
  payload     JSONB,           -- action-specific context
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
  -- NO updated_at — this row never changes
);
```

**Confidence:** MEDIUM — Event sourcing / audit trail pattern is extensively documented (Azure Architecture Center, Kurrent.io, Arkency). Document-specific requirement corroborated by multiple workflow platform case studies.

### Pattern 5: Storage Adapter Interface

**What:** A thin interface (`StorageAdapter`) hides whether files go to local disk or MinIO. Both implementations satisfy the same interface. The factory selects the implementation based on config.

**When to use:** From day one — retrofitting this later requires touching every document upload path.

**Example:**
```typescript
interface StorageAdapter {
  put(key: string, data: Buffer, mimeType: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  url(key: string): string; // signed URL for MinIO, local path for dev
}

// config.ts selects implementation
const storage: StorageAdapter = config.storage.driver === 'minio'
  ? new MinioAdapter(config.storage.minio)
  : new LocalAdapter(config.storage.localPath);
```

**Confidence:** MEDIUM — MinIO's ObjectLayer interface pattern and S3-compatible abstraction is well-documented in MinIO's own architecture docs.

---

## Data Flow

### Workflow Launch Flow

```
POST /api/workflows
    │
    ▼
Auth Middleware (validate JWT)
    │
    ▼
WorkflowController.create()
  └─ validate input shape (templateId, title, documents)
    │
    ▼
WorkflowService.launch(templateId, initiatorId)
  ├─ templateRepo.findWithPhasesAndSteps(templateId)
  ├─ snapshotTemplate() → create WorkflowInstance tree
  ├─ instanceRepo.create(snapshot)  [PostgreSQL tx]
  ├─ documentService.attach(files)  [File Store + DB]
  └─ notificationService.notifyFirstPhaseValidators()
       ├─ generate action tokens for each validator
       ├─ store token hashes in action_tokens table
       └─ mailer.send(validatorEmail, { token, context })
    │
    ▼
201 Created { instanceId, status: 'in_progress' }
```

### Email Action Resolution Flow (validator clicks link)

```
GET /api/actions/:token
    │
    ▼
TokenResolver Middleware
  ├─ lookup hash(token) in action_tokens
  ├─ check expiry, check used_at = NULL
  └─ resolve → { stepId, validatorId, actionType }
    │
    ▼
WorkflowService.applyValidatorDecision(stepId, validatorId, decision)
  ├─ load step + parent phase + instance
  ├─ stateMachine.transitionStep(step, decision)
  ├─ stepRepo.update(step)
  ├─ auditLog.append(action_type, context)
  ├─ tokenRepo.markUsed(tokenHash)
  │
  ├─ [if phase completion rule met]
  │   ├─ stateMachine.transitionPhase(phase, 'completed')
  │   ├─ [if last phase] stateMachine.transitionInstance(instance, 'approved')
  │   └─ notificationService.notifyNextPhase() OR notifyCompletion()
    │
    ▼
200 OK (or redirect to confirmation page)
```

### State Management

```
WorkflowInstance
  status: draft → in_progress → approved
                             ↘ refused

  contains PhaseInstances (ordered)
    status: pending → in_progress → completed
                                  ↘ refused

    contains StepInstances (one per validator)
      status: pending → in_progress → completed
                                    ↘ refused
```

Phase completion is rule-evaluated: "all steps completed", "majority completed", or custom rule per template. The state machine evaluates the rule after each step transition.

### Key Data Flows

1. **Template → Instance:** Template is deep-copied at launch. All phase/step structure is snapshot. Instance never references template FK chains — it owns its own full tree.
2. **Action Token lifecycle:** Issue (insert hash) → email (plain token in link) → resolve (hash lookup) → invalidate (set used_at). Token plain value never persists in DB.
3. **File storage:** File is streamed directly to File Store adapter (not buffered in API). DB stores only metadata (key, mime, size, uploader). Files are never stored in the DB blob.
4. **Email queue at MVP scale:** Synchronous send within the request/service call, with 2–3 retry attempts on transient SMTP failure. No message broker needed until scale demands it.

---

## Component Boundaries (Build Order Implications)

The following dependency graph implies a bottom-up build order:

```
PostgreSQL schema + migrations          ← Build first (everything depends on this)
    │
    ▼
Domain models + State Machine           ← No dependencies; pure logic; unit-testable immediately
    │
    ▼
Repositories                            ← Depend on DB schema + domain models
    │
    ├──▶ File Store Adapter             ← Independent; can be built in parallel with repos
    │
    ├──▶ SMTP Mailer + Token system     ← Depends on repos (for token storage)
    │
    ▼
Services (Workflow, Document, Notification)  ← Depend on repos + adapters + state machine
    │
    ▼
API Layer (routes, middleware, OpenAPI)  ← Depends on services
    │
    ▼
i18n Layer                              ← Threads through API + email templates; can be layered in after core routes exist
```

**Recommended build sequence for phases:**
1. DB schema + migrations + core domain models
2. State machine (pure logic, unit tested)
3. Repositories (DB access, integration tested)
4. Storage adapter (local FS first)
5. Workflow service + launch flow (end-to-end integration test)
6. Token system + SMTP mailer + notification service
7. Full action resolution flow (validator email → decision → state advance)
8. API layer with OpenAPI spec
9. i18n (EN + FR) threaded through all outputs

---

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0–500 users | Single Docker Compose stack: API + DB + SMTP relay. Synchronous email send. Local file storage. This is the target for MVP. |
| 500–10K users | Add MinIO for object storage. Move email to async queue (pg-based queue or Redis). Add read replica for DB. |
| 10K+ users | Horizontal API scaling (stateless by design). Separate worker process consuming email queue. CDN for file downloads. Consider schema partitioning for audit log. |

### Scaling Priorities

1. **First bottleneck:** Email delivery — SMTP synchronous calls will time out under load. Fix: move to async queue backed by PostgreSQL (pg-boss or similar) before adding more features.
2. **Second bottleneck:** File storage — local FS does not work across multiple API instances. Fix: MinIO (already planned). Switch is a config + adapter swap if the abstraction layer is built correctly from day 1.

---

## Anti-Patterns

### Anti-Pattern 1: Storing State as a Flag Field Without Transition Guards

**What people do:** `UPDATE workflow_instances SET status = 'approved' WHERE id = $1` directly from service or controller code.

**Why it's wrong:** Any code path can set any status. A bug routes `refused` directly to `approved`. There is no enforcement of the transition graph. Impossible states appear in production.

**Do this instead:** Route ALL status changes through the state machine's `transition()` function. Let the FSM throw on illegal transitions. Database constraints can back-stop this (check constraints on status values + trigger-based transition validation), but the application-level guard is mandatory.

### Anti-Pattern 2: Live Template References from Running Instances

**What people do:** WorkflowInstance references the current WorkflowTemplate via FK and reads phase/step definitions dynamically on each request.

**Why it's wrong:** When an admin edits the template mid-execution, all running instances see the changed structure. Steps disappear or appear. This is catastrophic for document workflows.

**Do this instead:** At launch time, deep-copy the template's full phase/step structure into the instance's own rows. The instance owns its structure. Template FK on the instance is for lineage/reporting only, not structural reads.

### Anti-Pattern 3: Business Logic in API Controllers

**What people do:** Put state transition decisions, completion rule evaluation, or file processing directly in route handlers.

**Why it's wrong:** Logic becomes untestable without HTTP infrastructure. It leaks across routes. It makes the domain impossible to reason about independently.

**Do this instead:** Controllers only parse, validate shape, delegate to service, and serialize response. Domain logic is in `domain/`, orchestration is in `services/`.

### Anti-Pattern 4: Storing File Content in the Database

**What people do:** Store uploaded documents as `BYTEA` columns in PostgreSQL for simplicity.

**Why it's wrong:** PostgreSQL is not an object store. Large BLOBs balloon the DB size, degrade vacuum performance, and create backup nightmares. Even the ExceptionNotFound workflow engine series calls this out explicitly as a design shortcoming.

**Do this instead:** Store files in the File Store adapter (local FS → MinIO). Store only metadata in DB (key, filename, size, MIME type, uploader, upload time).

### Anti-Pattern 5: Synchronous Email as the Critical Path for State Transitions

**What people do:** Send email inside a DB transaction: commit state change AND send email atomically.

**Why it's wrong:** SMTP failure rolls back the DB transaction. The workflow hangs because the state wasn't persisted. Or email is sent but DB commit fails, leaving emails with broken token links.

**Do this instead:** Commit DB state change first (including token issuance). Then attempt email send outside the transaction with retry. If email fails, the state is still correct — a retry job or manual resend can recover without state inconsistency.

---

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| SMTP relay (Postfix, SendGrid, etc.) | Nodemailer/equivalent with connection pool + retry | Abstract behind `MailerAdapter` interface for easy swap |
| MinIO (object storage) | AWS SDK v3 (`@aws-sdk/client-s3`) — MinIO is S3-compatible | Use same SDK for local MinIO and cloud S3; configure endpoint URL |
| PostgreSQL | Direct driver (pg/postgres.js) with connection pool | No ORM — raw SQL in repositories for full control over queries |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| API → Service | Direct function call (same process) | No message passing — services are synchronous |
| Service → State Machine | Direct function call — pass entity, receive new state | State machine is pure function, no side effects |
| Service → Repository | Direct function call — repositories return domain types | Repositories own DB cursor lifecycle |
| Service → Notification | Direct function call — notification queues if async needed | Start synchronous, add queue adapter later |
| Notification → Mailer | Adapter interface call | Decoupled from SMTP implementation |
| Document Service → File Store | Adapter interface call | Local FS or MinIO swap is transparent to service |

---

## Sources

- [Architecture Pattern: Orchestration via Workflows — Kislay Verma](https://kislayverma.com/software-architecture/architecture-pattern-orchestration-via-workflows/) — MEDIUM confidence (single source, credible author)
- [Designing a True REST State Machine — Nordic APIs](https://nordicapis.com/designing-a-true-rest-state-machine/) — MEDIUM confidence (verified via fetch)
- [Workflow Engine vs State Machine — workflowengine.io](https://workflowengine.io/blog/workflow-engine-vs-state-machine/) — MEDIUM confidence
- [PostgreSQL Workflow Engine (pg-workflow) — chuckstack/GitHub](https://github.com/chuckstack/pg-workflow) — MEDIUM confidence (live open-source reference)
- [Design Patterns for Approval Processes — ACM Digital Library](https://dl.acm.org/doi/fullHtml/10.1145/3628034.3628035) — LOW confidence (403 on fetch, citation found via search)
- [Workflow Pattern — Vertabelo / Red Gate](https://www.red-gate.com/blog/the-workflow-pattern-part-1-using-workflow-patterns-to-manage-the-state-of-any-entity/) — MEDIUM confidence (fetched successfully)
- [Designing a Workflow Engine Database (8-part series) — ExceptionNotFound](https://exceptionnotfound.net/designing-a-workflow-engine-database-part-1-introduction-and-purpose/) — MEDIUM confidence (structure confirmed; schema limited to intro)
- [Magic Links / Secure Tokens — Auth0 Docs](https://auth0.com/docs/authenticate/passwordless/authentication-methods/email-magic-link) — HIGH confidence (official documentation)
- [Magic Link Security Best Practices — Deepak Gupta](https://guptadeepak.com/mastering-magic-link-security-a-deep-dive-for-developers/) — MEDIUM confidence
- [MinIO ObjectLayer Architecture — MinIO GitHub](https://github.com/minio/minio) — MEDIUM confidence
- [Event Sourcing Pattern — Azure Architecture Center](https://learn.microsoft.com/en-us/azure/architecture/patterns/event-sourcing) — HIGH confidence (official Microsoft docs)
- [Designing Scalable Notification Systems — Medium/Anshul Kahar](https://medium.com/@anshulkahar2211/designing-a-scalable-notification-system-email-sms-push-from-hld-to-lld-reliability-to-d5b883d936d8) — LOW confidence (single blog source)
- [Hexagonal Architecture — AWS Prescriptive Guidance](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/hexagonal-architecture.html) — HIGH confidence (official AWS docs)

---
*Architecture research for: Document validation workflow platform (Validly)*
*Researched: 2026-02-19*
