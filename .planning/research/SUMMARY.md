# Project Research Summary

**Project:** Validly — open-source document validation workflow platform
**Domain:** Document approval circuit automation (self-hosted, API-first, email-driven)
**Researched:** 2026-02-19
**Confidence:** MEDIUM (stack HIGH, features MEDIUM, architecture MEDIUM, pitfalls MEDIUM)

## Executive Summary

Validly is a document validation workflow platform targeting French public-sector organizations and any team that needs sovereign, self-hosted approval circuits. The research confirms this is a well-understood domain with established patterns (template/instance split, explicit state machines, append-only audit trails), but the combination of email-based action tokens as the primary approval channel — not just notifications — differentiates Validly from all surveyed competitors. The recommended architecture is a layered Node.js/Fastify/PostgreSQL backend with a Vite/React/shadcn frontend, deployed via Docker Compose. The workflow engine with its state machine and quorum rules is the critical-path dependency: everything else — email tokens, notifications, dashboard, templates — depends on it being built correctly first.

The two most important architectural decisions to make correctly from day one are: (1) treat the workflow state machine as a pure domain module with explicit transition guards, and (2) ensure i18n is scaffolded before any feature strings are written. Both are prohibitively expensive to retrofit. The email action token system (the core differentiator) introduces meaningful security requirements — CSPRNG tokens, hash-only storage, single-use enforcement, scope binding — that must be built into the initial implementation rather than added as an afterthought. The stack is mature and well-matched to the problem: Prisma 6 over Prisma 7, Fastify 5 over NestJS or Express, BullMQ for async work, and react-email for type-safe multilingual email templates.

The primary product risk is not technical — it is scope creep toward features that look valuable but derail v1: drag-and-drop visual workflow builders, eIDAS signatures, document versioning mid-circuit, and SSO. Research strongly supports deferring all of these. The MVP definition is already ambitious: 18 P1 features including the full email action channel, quorum rules, sequential/parallel phase engine, workflow templates, and i18n. The roadmap should be structured to ship a working, secure approval loop as early as possible and layer in polish features only after the core loop is validated.

---

## Key Findings

### Recommended Stack

The backend is Node.js 22 LTS + TypeScript 5.8 + Fastify 5 + Prisma 6 + PostgreSQL 15. Fastify was chosen over NestJS (too much contributor overhead for an OSS project) and Express (stagnant, no built-in schema validation or OpenAPI). Prisma 6 over Prisma 7: the v7 breaking changes (driver adapters required, ESM-only, removed middleware) are unnecessary risk for a greenfield v1 — revisit after H2 2026. BullMQ 5 + Redis 7 handles async work (email delivery, deadline reminders). The frontend is Vite 7 + React 19 + Tailwind 4 + shadcn/ui, with TanStack Query 5 for server state and react-hook-form 7 + Zod 4 for validated forms. React was chosen over Vue for OSS contributor acquisition (25M vs 4M weekly npm downloads).

**Core technologies:**
- **Node.js 22 LTS + TypeScript 5.8:** Runtime and language — required by Fastify 5, Zod 4, Prisma 6; native strip-types support in Node 22.6+
- **Fastify 5:** HTTP framework — built-in JSON Schema validation, OpenAPI plugin ecosystem, simpler contributor onboarding than NestJS
- **Prisma 6:** ORM + migrations — superior `prisma migrate dev` DX vs Drizzle; avoid Prisma 7 for v1 (too many breaking changes)
- **PostgreSQL 15:** Primary database — identity columns, JSONB for workflow snapshots, append-only audit table with row-level security
- **Zod 4:** Validation — 14x faster than v3; single schema source of truth for API validation + OpenAPI via zod-to-json-schema
- **BullMQ 5 + Redis 7:** Async job queue — email sends and deadline reminders must never block HTTP responses
- **React 19 + Vite 7 + shadcn/ui:** Frontend — largest OSS contributor pool, shadcn components fully owned in-repo (no runtime dep)
- **react-email 3:** Email templates — TypeScript-native, React component model, browser preview, works with nodemailer
- **i18next 24 / react-i18next 15:** i18n — shared translation JSON files between backend (email, errors) and frontend (UI)

See `.planning/research/STACK.md` for full version matrix and alternatives considered.

### Expected Features

The MVP scope is larger than typical for v1 because the core differentiators (email-action tokens, quorum rules, refusal routing to previous step) are tightly coupled to the workflow engine and cannot be added after launch without significant rework. All 18 P1 features should be treated as launch requirements.

**Must have (table stakes):**
- Document upload (PDF, DOCX, images) with in-browser preview — expected by all approval system users
- Sequential and parallel approval routing — fundamental to the domain
- Email notifications on pending action — system is unusable without this
- Approve/Refuse with mandatory comment — bare approval buttons are insufficient for audit
- Immutable audit trail with CSV export — compliance baseline for target market
- Dashboard: "my submissions" + "my pending actions" views
- Workflow status visualization (timeline, pending validators, action history)
- User authentication (email/password + JWT) and submitter/validator role distinction
- Deadlines with automated reminder emails — workflows stall without them
- Docker Compose single-command deployment — self-hosted requirement

**Should have (Validly differentiators — all in v1):**
- Email-based Approve/Refuse without login (secure one-time tokens) — the core differentiator; no competitor does this
- Quorum rules per step (unanimity, majority, any-of) — real circuits are not always "everyone must approve"
- Refusal routes back to previous step, not to initiator — matches public-sector validation patterns
- Workflow templates shared at org level — repetitive workflows are the primary use case
- i18n EN + FR (UI and email templates) — target market is primarily French-speaking
- OpenAPI / Swagger documentation — enables ecosystem integrations without Validly building them

**Defer (v2+):**
- SSO / SAML / OIDC — highest-priority post-v1, but high per-IdP complexity
- Delegation of approval authority — audit trail ambiguity; let initiators reconfigure instead
- Document versioning mid-circuit — invalidates prior approvals; require new submission
- Conditional routing — dramatically complicates the state machine; validate demand first
- eIDAS / qualified electronic signatures — regulatory overhead; internal workflows don't need it
- Native mobile app — email-based approval from mobile email client covers the use case
- Third-party integrations (SharePoint, Google Drive, Slack) — API-first enables community-built connectors

See `.planning/research/FEATURES.md` for full prioritization matrix and competitor analysis.

### Architecture Approach

The architecture is a layered monolith: API layer (Fastify routes) → Service layer (use-case orchestration) → Domain layer (pure state machine + business rules) → Repository layer (all SQL) → Infrastructure adapters (file storage, SMTP mailer). The domain layer has zero infrastructure dependencies, making the state machine fast to unit test and safe to reason about in isolation. All file content goes to a `StorageAdapter` interface (local FS in dev, MinIO in production) — never to the database. The workflow state machine is a pure TypeScript finite automaton; XState is explicitly rejected (50kb+ overhead, actor model complexity not warranted for a simple FSM).

**Major components:**
1. **State Machine Engine** — Core domain; evaluates phase/step completion rules (unanimity/majority/any-of), enforces valid transitions, rejects illegal ones; pure logic, no infrastructure dependencies
2. **Workflow Service** — Orchestrates WorkflowInstance lifecycle: creates from template snapshot, advances phases, delegates to state machine; owns the critical template→instance deep-copy pattern
3. **Token Resolver** — Dedicated handler for `GET /actions/:token`; resolves secure one-time tokens to workflow actions without requiring a session; the email-action channel entry point
4. **Notification Service** — Composes and dispatches localized emails; issues tokens for email action links; email send happens outside DB transactions (commit state first, then send)
5. **Repository Layer** — All SQL isolated here; services never write raw queries; schema changes only touch this layer
6. **StorageAdapter** — Local FS (dev) / MinIO (production) behind a single interface; swap is a config change, zero route changes required

Build order (dependency-driven): DB schema + migrations → Domain models + State Machine → Repositories → File Store Adapter → SMTP Mailer + Token system → Services → API Layer → i18n threading.

See `.planning/research/ARCHITECTURE.md` for full data flow diagrams and anti-pattern catalog.

### Critical Pitfalls

1. **Non-atomic state transitions + email** — Commit DB state change first (including audit log entry) inside a single transaction, then send email outside the transaction with retry. Never send email inside a DB transaction. SMTP failure must not roll back state. Address in: workflow engine core (Phase 3).

2. **Insecure email approval tokens** — Use 32+ byte CSPRNG hex (not UUIDs), store only the hash, enforce expiry (24-48h configurable), mark single-use on first consumption, scope tokens to specific step + action + validator identity. This is the highest-security surface in the system. Address in: email action channel phase (Phase 4).

3. **Mutable audit trail** — Create a dedicated `audit_events` table with DB-level INSERT-only grant for the application user (no UPDATE or DELETE). Consider SHA-256 hash chain for tamper detection. Test at DB layer: an attempted UPDATE must fail, not just be rejected by the application. Address in: data model phase (Phase 1).

4. **Quorum race condition** — Use `UPDATE steps SET decision_count = decision_count + 1 WHERE id = ? RETURNING decision_count` atomically; wrap "record decision + check quorum + trigger transition" in a serializable transaction with row-level lock. Test with 10 concurrent approval requests to the same step. Address in: workflow engine core (Phase 3).

5. **Hardcoded strings outside i18n** — Configure zero-tolerance linter rule before the first feature commit; create full `en/` and `fr/` key structure before writing any user-facing strings; treat FR placeholder keys as acceptable, untranslated literal strings as never acceptable. Address in: project scaffold (Phase 0/1).

6. **Deadline timer loss/duplication** — Persist timers in DB with `scheduled_for` + `fired_at`; use `SELECT FOR UPDATE SKIP LOCKED` to prevent duplicate processing; `fired_at` is set atomically when the escalation fires. In-memory timers and naive cron jobs are unacceptable. Address in: deadline subsystem (Phase 3).

See `.planning/research/PITFALLS.md` for full pitfall catalog, recovery strategies, and "looks done but isn't" checklist.

---

## Implications for Roadmap

Based on the dependency graph from ARCHITECTURE.md, the feature dependency tree from FEATURES.md, and the phase-to-pitfall mapping from PITFALLS.md, the following phase structure is recommended. The ordering is driven by one principle: build the workflow engine correctly before building anything that depends on it.

### Phase 0: Project Foundation
**Rationale:** i18n and project structure cannot be retrofitted. Every string, every error message, every email template must be i18n-aware from commit 1. Establish Docker Compose environment so all contributors develop against the same infrastructure from the start.
**Delivers:** Monorepo structure (backend/frontend), Docker Compose (PostgreSQL 15 + Redis 7 + MinIO), TypeScript configs, ESLint + Prettier with i18n enforcement rule, i18next skeleton (en/ + fr/ key structure), Vitest + Playwright setup, Fastify app scaffold with OpenAPI plugin registered.
**Avoids:** Hardcoded string pitfall (Pitfall 5) — zero-tolerance from day 1.
**Research flag:** Standard patterns — skip `/gsd:research-phase`.

### Phase 1: Data Model + Authentication
**Rationale:** All other phases depend on the DB schema and user identity. The audit trail immutability constraint must be baked into the schema — retrofitting PostgreSQL row-level security after rows exist is painful.
**Delivers:** Full PostgreSQL schema with migrations (users, workflow_templates, workflow_instances, phases, steps, action_tokens, workflow_actions/audit_events, documents metadata); JWT auth (signup, login, refresh via @fastify/jwt); submitter/validator role distinction; DB-level INSERT-only grant on audit_events table.
**Addresses:** User authentication (table stakes), role distinction (table stakes).
**Avoids:** Mutable audit trail (Pitfall 3) — enforce at schema level, not application level.
**Research flag:** Standard patterns — skip `/gsd:research-phase`.

### Phase 2: Document Upload + Preview
**Rationale:** The workflow engine needs documents to act on. Building upload before the engine gives a testable surface and validates the StorageAdapter abstraction before it's depended on by workflow launch.
**Delivers:** `@fastify/multipart` streaming upload, StorageAdapter interface with LocalAdapter (streams to disk, no DB blobs), document metadata in DB, PDF.js in-browser preview for validators.
**Addresses:** Document upload + in-browser preview (table stakes).
**Avoids:** Files stored in DB (Architecture Anti-Pattern 4).
**Research flag:** PDF preview needs light research — PDF.js integration patterns in Vite/React SPA. Consider `/gsd:research-phase` if team is unfamiliar.

### Phase 3: Workflow Engine Core
**Rationale:** This is the critical-path phase. Every other feature (email tokens, notifications, dashboard, templates, deadlines) depends on a correct state machine. Rushing this creates technical debt that is expensive to undo. Quorum rules belong in this phase — they are a property of the engine's step model, not a separate feature.
**Delivers:** Pure TypeScript FSM (WorkflowInstance → PhaseInstance → StepInstance state transitions with explicit guards); quorum evaluation (unanimity, majority, any-of per step); template→instance deep-copy (snapshot pattern); workflow launch flow (POST /api/workflows); refusal routing to previous step; deadline scheduling (persisted in DB, not in-memory); repository layer for all workflow entities.
**Addresses:** Sequential + parallel routing (table stakes), quorum rules (differentiator), refusal routing (differentiator), deadlines (table stakes).
**Avoids:** Non-atomic transitions (Pitfall 1), quorum race condition (Pitfall 4), deadline timer loss (Pitfall 6), live template references from running instances (Architecture Anti-Pattern 2), business logic in controllers (Architecture Anti-Pattern 3).
**Research flag:** High complexity — strongly recommend `/gsd:research-phase` for quorum atomicity patterns and the template/instance snapshot schema before planning this phase.

### Phase 4: Email Action Channel
**Rationale:** With the workflow engine complete, the email action system can be built as a pure consumer of engine state transitions. This is Validly's core differentiator and the most security-sensitive surface. Building it after Phase 3 means tokens can be validated against real workflow state.
**Delivers:** react-email templates (EN + FR) with approval/refusal context and document summary; nodemailer SMTP integration with BullMQ async queue; secure token generation (CSPRNG, hash-stored, scoped to step+action+validator); `GET /actions/:token` resolver with expiry, single-use, scope validation; "already actioned" and "expired link" UX pages; rate limiting on token endpoint (@fastify/rate-limit); BullMQ deadline reminder jobs.
**Addresses:** Email notifications (table stakes), email-based Approve/Refuse without login (differentiator), reminders (table stakes).
**Avoids:** Insecure tokens (Pitfall 2), email send inside DB transaction (Pitfall 1), SMTP Basic Auth (Integration Gotcha).
**Research flag:** Token security patterns are well-documented (Auth0 magic links, OWASP). Standard patterns — skip `/gsd:research-phase` if team follows PITFALLS.md guidance precisely.

### Phase 5: Dashboard + Workflow Visualization
**Rationale:** With engine + email channel working, the web dashboard is a read layer over already-correct state. TanStack Query's polling and caching make the "my pending actions" view straightforward to build.
**Delivers:** Dashboard ("my submissions" initiator view + "my pending actions" validator view); workflow status timeline visualization (completed/active/pending steps, pending validators, action history); TanStack Query data fetching with background refresh; audit trail view with CSV export; pagination on all list views (cursor-based from first endpoint).
**Addresses:** Dashboard (table stakes), workflow visualization (table stakes), audit export (table stakes).
**Avoids:** No pagination on list views (Performance Trap), loading entire workflow history for current state (Performance Trap).
**Research flag:** Standard patterns — skip `/gsd:research-phase`.

### Phase 6: Workflow Templates
**Rationale:** Templates are a configuration layer on top of the engine. They must be built after the engine (Phase 3) to know exactly what the template schema needs to capture. Org-level sharing is the differentiator; the form-based creation UI is the v1 approach (visual drag-and-drop is explicitly deferred).
**Delivers:** Workflow template CRUD (create, list, share at org level, use as launch basis); form-based template creation (phases, steps, validators, quorum rules, deadlines per step); template instantiation (uses Phase 3 snapshot pattern); "My Templates" section in dashboard.
**Addresses:** Workflow templates (differentiator).
**Avoids:** Drag-and-drop visual builder (Anti-Feature — deferred to v2+).
**Research flag:** Standard patterns — skip `/gsd:research-phase`.

### Phase 7: i18n Completion + Polish
**Rationale:** The i18n skeleton was set up in Phase 0 and keys added throughout development. This phase completes all French translations, validates every user-facing surface in FR locale in CI, and addresses email deliverability setup (SPF/DKIM/DMARC) before any public release.
**Delivers:** Complete FR translations (UI strings, error messages, email templates, validation messages); CI test run with FR locale for all surfaces; SPF/DKIM/DMARC configuration documentation for self-hosted deployments; mail-tester.com ≥9/10 score on test domain; Docker Compose production hardening (pinned image versions, named volumes, health checks).
**Addresses:** i18n EN + FR (differentiator), Docker Compose deployment (table stakes).
**Avoids:** Email deliverability failures (Integration Gotcha), Docker Compose data loss (Integration Gotcha), partial i18n coverage (Pitfall 5).
**Research flag:** Email deliverability setup (SPF/DKIM/DMARC) is well-documented but transactional email provider selection may warrant brief research if undecided. Light `/gsd:research-phase` optional.

### Phase Ordering Rationale

- **Foundation before features:** Phase 0 (i18n skeleton, tooling) must precede all feature work because retrofitting i18n is codebase-wide surgery.
- **Schema before services:** Phase 1 (data model) must precede Phase 3 (engine) because the FSM transitions write to schema tables. Getting audit immutability right at schema time avoids a migration nightmare.
- **Engine before consumers:** Phase 3 (workflow engine) must precede Phases 4, 5, and 6 because the email channel, dashboard, and templates all consume engine state. A correct engine means no correctness bugs propagate into the consuming layers.
- **Upload before engine:** Phase 2 (document upload) precedes the engine launch flow because launching a workflow requires attaching documents. The StorageAdapter abstraction is also validated early.
- **Email channel before dashboard:** Phase 4 before Phase 5 ensures the primary action channel works before building the secondary (web) channel. Validators who use email-first should be functional before the dashboard is complete.
- **Templates after engine:** Phase 6 after Phase 3 ensures template schema is designed against a fully-known engine model, not a hypothetical one.

### Research Flags

Phases likely needing `/gsd:research-phase` before planning:
- **Phase 3 (Workflow Engine Core):** High complexity. Quorum atomicity (PostgreSQL serializable transactions + `RETURNING` pattern), template/instance snapshot schema (what gets deep-copied vs referenced), and deadline persistence pattern all warrant deeper research before committing to a plan. This is the highest-risk phase.
- **Phase 2 (Document Upload) — optional:** PDF.js integration in Vite/React SPA is straightforward but DOCX preview (requires conversion pipeline) may need research if included in v1 scope.

Phases with well-documented standard patterns (skip research-phase):
- **Phase 0:** Docker Compose + TypeScript scaffold + ESLint are fully standardized.
- **Phase 1:** JWT auth with Fastify and PostgreSQL schema migration with Prisma are extensively documented.
- **Phase 4:** Magic link / secure token pattern is well-documented; follow PITFALLS.md checklist exactly.
- **Phase 5:** Dashboard + TanStack Query patterns are well-documented via shadcn/ui examples.
- **Phase 6:** Template CRUD is standard Fastify/Prisma CRUD work once engine is known.
- **Phase 7:** i18next completion and Docker hardening are configuration, not architecture.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Core technologies verified against official docs and current release data. Version compatibility matrix cross-checked. Alternatives analysis is opinionated but well-reasoned (Prisma 6 vs 7, Fastify vs NestJS, BullMQ vs pg-boss). |
| Features | MEDIUM | Competitor analysis via WebSearch is credible but single-source for some claims. French public sector specifics (DINUM, LaSuite patterns) have lower confidence — one primary source. MVP feature set is well-reasoned from first principles. |
| Architecture | MEDIUM | Core patterns (template/instance split, explicit FSM, append-only audit, storage adapter) are corroborated by multiple converging sources. Validly-specific choices (email-as-action-channel, no BPMN) are first-principles derivations — sound but not battle-tested references available. |
| Pitfalls | MEDIUM | Cross-referenced via WebSearch across multiple sources. No single authoritative post-mortem for this exact domain combination exists. Security pitfalls (OWASP, Auth0) have HIGH-confidence backing. Email deliverability pitfalls (SPF/DKIM Google enforcement) are HIGH confidence. |

**Overall confidence:** MEDIUM — sufficient to plan all phases with the standard pattern phases at HIGH confidence. Phase 3 (engine core) carries the most uncertainty and warrants deeper pre-planning research.

### Gaps to Address

- **Transactional email provider choice:** PITFALLS.md flags that SMTP Basic Auth is deprecated (Google 2025, Microsoft 2025-2026). The self-hosted deployment model means organizations will configure their own SMTP relay. The Docker Compose setup needs clear documentation on how to configure a compatible provider (Postmark, Mailjet, SES) vs self-hosted Postfix. Resolve during Phase 0 or Phase 4 planning.
- **DOCX preview scope:** FEATURES.md lists "PDF, DOCX, images" for document upload. PDF.js handles PDF. DOCX preview requires a conversion pipeline (e.g., LibreOffice headless → PDF → PDF.js, or a cloud API). If DOCX preview is in-scope for v1, Phase 2 needs a research spike. If only PDF + images are required for v1 preview, the gap closes.
- **pg-boss vs BullMQ decision for small deployments:** STACK.md notes pg-boss (PostgreSQL-backed queue, no Redis) as a valid alternative for simpler deployments. For an OSS project targeting resource-constrained self-hosters, eliminating the Redis service has appeal. The Phase 4 plan should make a final call and document the rationale.
- **MinIO in v1 Docker Compose:** STACK.md describes the v1→v2 storage migration path (local FS → MinIO). The question of whether MinIO should be included in the v1 Docker Compose (for consistency with the production path) vs excluded (simpler dev environment) should be resolved before Phase 2 starts.

---

## Sources

### Primary (HIGH confidence)
- Fastify v5 official docs (fastify.dev) — version 5.7.x, Node 20+ requirement, plugin system
- Prisma changelog (prisma.io) — Prisma 6.19.x stable, Prisma 7 breaking changes confirmed
- Zod official site (zod.dev) — v4 stable, 14x perf improvement confirmed
- React versions (react.dev) — 19.2.4 current stable
- Node.js releases (nodejs.org) — Node 22 LTS active
- Auth0 Magic Links docs — token security pattern, single-use enforcement
- Event Sourcing — Azure Architecture Center (official Microsoft docs)
- Hexagonal Architecture — AWS Prescriptive Guidance
- OWASP CSRF Prevention Cheat Sheet — token security, replay prevention
- Google DMARC Enforcement (Proofpoint) — enforcement timeline confirmed

### Secondary (MEDIUM confidence)
- BullMQ npm (5.69.3 as of Feb 2026), TanStack Query npm (5.90.21), Vite releases (7.3.1)
- shadcn/ui changelog — Tailwind v4 + React 19 support since Feb 2025
- WebSearch: Prisma vs Drizzle 2026, Fastify vs NestJS DX, React vs Vue contributor ecosystem
- WebSearch: competitor analysis (DocuSign, Kissflow, ProcessMaker, Bonita) feature comparison
- Vertabelo / Red Gate — workflow pattern (template/instance split)
- ExceptionNotFound workflow engine series — project structure rationale
- Nordic APIs REST state machine article — FSM transition guard patterns
- pg-workflow (chuckstack/GitHub) — open-source workflow engine schema reference
- HubiFi, OpsHub Signal — immutable audit trail best practices
- Mailtrap — email deliverability 2026 (SPF/DKIM/DMARC)
- AWS Step Functions quorum pattern — parallel state race condition

### Tertiary (LOW confidence)
- DINUM / LaSuite sovereign document platform — French public sector deployment patterns (single source, limited detail)
- ACM Digital Library — Design Patterns for Approval Processes (403 on fetch, citation only)

---
*Research completed: 2026-02-19*
*Ready for roadmap: yes*
