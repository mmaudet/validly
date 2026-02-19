# Roadmap: Validly

## Overview

Validly is built in eight phases, ordered by dependency: project foundation and i18n scaffolding must precede all feature work, the data model must precede the workflow engine, and the workflow engine must precede every feature that consumes it (email channel, dashboard, templates). The result is a sovereign, self-hosted document approval platform where validators can approve or refuse directly from email — without ever logging in — backed by a full immutable audit trail.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation** - Project scaffold, Docker Compose environment, i18n skeleton, and tooling enforced from day one
- [x] **Phase 2: Data Model + Auth** - Full database schema, JWT authentication, and audit trail immutability baked into the schema
- [x] **Phase 3: Document Upload + Preview** - Secure document upload with StorageAdapter abstraction and in-browser PDF/image preview
- [x] **Phase 4: Workflow Engine** - Pure state machine, quorum rules, refusal routing, deadline scheduling — the critical-path dependency for everything else
- [x] **Phase 5: Email Action Channel** - Secure token-based approve/refuse directly from email, BullMQ async queue, deadline reminders
- [x] **Phase 6: Dashboard + Audit** - Initiator and validator dashboard views, workflow visualization, audit trail with CSV export
- [x] **Phase 7: Workflow Templates** - Template CRUD, org-level sharing, form-based creation, template-to-instance deep copy
- [x] **Phase 8: i18n Completion + Docker Polish** - Complete FR translations, CI locale validation, Docker Compose production hardening
- [x] **Phase 9: Workflow Creation UI** - Multi-step wizard for creating workflows from the dashboard: document upload, validation circuit builder, template loading, and launch

## Phase Details

### Phase 1: Foundation
**Goal**: Developers can run the full infrastructure locally with a single command, and every file written from this point forward is i18n-compliant by construction
**Depends on**: Nothing (first phase)
**Requirements**: INFRA-01, INFRA-02, INFRA-03, INFRA-06
**Success Criteria** (what must be TRUE):
  1. `docker-compose up` starts PostgreSQL, Redis, and the backend service with no manual steps
  2. The backend serves a Swagger UI at `/api/docs` with the OpenAPI spec loaded
  3. A linter rule enforces zero hardcoded user-facing strings — any violation fails the CI check
  4. The i18n key structure exists for both `en/` and `fr/` locales before any feature code is written
  5. TypeScript, ESLint, and Vitest are configured and a passing test suite can be run with one command
**Plans**: TBD

### Phase 2: Data Model + Auth
**Goal**: Users can create accounts, log in securely, and the database schema enforces audit trail immutability at the storage level — not the application level
**Depends on**: Phase 1
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUDIT-01, AUDIT-02
**Success Criteria** (what must be TRUE):
  1. A new user can sign up with email and password and receive a JWT token
  2. A logged-in user stays logged in across browser refresh (JWT refresh works)
  3. A user can log out from any page and the session is invalidated
  4. The database distinguishes submitter and validator roles (schema + JWT claims)
  5. An attempted UPDATE or DELETE on the `audit_events` table fails at the database level, not the application level
**Plans**: TBD

### Phase 3: Document Upload + Preview
**Goal**: Users can upload documents and preview them in-browser without downloading — with file storage abstracted behind an adapter that can be swapped to MinIO without touching routes
**Depends on**: Phase 2
**Requirements**: DOC-01, DOC-02, DOC-03, DOC-04, DOC-05
**Success Criteria** (what must be TRUE):
  1. A user can upload a PDF, DOCX, or image file with title, description, and tags and see it listed in their documents
  2. A PDF document renders in-browser via PDF.js without prompting a file download
  3. An image document displays inline in the browser without prompting a download
  4. Document metadata (title, description, tags, uploader, timestamp) is retrievable via the API
  5. Swapping from local filesystem storage to a different adapter requires only a configuration change, not route changes
**Plans**: TBD

### Phase 4: Workflow Engine
**Goal**: A workflow can be launched, progress through sequential and parallel steps with configurable quorum rules, route back on refusal, enforce valid state transitions, and handle deadlines — all correctly and atomically
**Depends on**: Phase 3
**Requirements**: WF-01, WF-02, WF-03, WF-04, WF-05, WF-06, WF-07, WF-08
**Success Criteria** (what must be TRUE):
  1. A user can launch a workflow by attaching documents and selecting a circuit, and the workflow advances to its first step
  2. A step configured for parallel validators reaches completion only when its quorum rule (unanimity, majority, or any-of) is satisfied — concurrent approvals are handled atomically
  3. A refusal on a step sends the workflow back to the previous step with the refusal comment visible, not to the initiator
  4. An invalid state transition (e.g., approving an already-decided step) is rejected by the engine with a clear error
  5. A workflow instance launched from a template retains the template's structure even if the template is later modified
**Plans**: TBD

### Phase 5: Email Action Channel
**Goal**: Validators receive an email when action is needed and can approve or refuse directly from that email via a secure one-time link — without ever logging into the platform
**Depends on**: Phase 4
**Requirements**: EMAIL-01, EMAIL-02, EMAIL-03, EMAIL-04, EMAIL-05, EMAIL-06
**Success Criteria** (what must be TRUE):
  1. A validator receives an email when a step reaches them, containing approve and refuse links they can click without logging in
  2. Clicking an approve or refuse link in the email records the decision, advances the workflow, and shows a confirmation page — no login required
  3. Clicking an expired or already-used token link shows a clear error page explaining what happened and what to do next
  4. An automated reminder email is sent to pending validators before a step deadline expires
  5. Email content is correctly rendered in both English and French based on the user's locale
**Plans**: TBD

### Phase 6: Dashboard + Audit
**Goal**: Initiators can track their submissions and validators can see their pending actions, with full workflow visualization and an exportable audit trail
**Depends on**: Phase 5
**Requirements**: DASH-01, DASH-02, DASH-03, DASH-04, AUDIT-03
**Success Criteria** (what must be TRUE):
  1. An initiator sees all their submitted workflows with current status on a paginated "My submissions" view
  2. A validator sees all workflows awaiting their action on a paginated "My pending actions" view
  3. A workflow detail page shows which steps are complete, which are active, who has acted, and the full action history
  4. A user can export the audit trail for a workflow to a CSV file that includes actor identity and timestamp for every action
**Plans**: TBD

### Phase 7: Workflow Templates
**Goal**: Users can create reusable workflow templates, share them at the organization level, and launch workflows from them — with the instance structure frozen at launch time
**Depends on**: Phase 4
**Requirements**: TMPL-01, TMPL-02, TMPL-03, TMPL-04
**Success Criteria** (what must be TRUE):
  1. A user can create a workflow template defining phases, steps, validators, quorum rules, and optional deadlines via a structured form
  2. A template created by one organization member is visible and usable by all members of the same organization
  3. Launching a workflow from a template creates an independent instance — subsequent template changes do not affect running workflows
  4. A "My Templates" section in the dashboard lists all organization-level templates with create and edit actions
**Plans**: TBD

### Phase 8: i18n Completion + Docker Polish
**Goal**: The application is fully localized in English and French on every surface, and the Docker Compose deployment is production-hardened for self-hosted organizations
**Depends on**: Phase 7
**Requirements**: INFRA-04, INFRA-05
**Success Criteria** (what must be TRUE):
  1. Every user-facing string in the UI is translated in both English and French, with no untranslated literal strings reachable in either locale
  2. Every email template renders correctly in both English and French, including all workflow-specific variables
  3. The CI pipeline runs a full test pass with the FR locale active and fails if any string is missing a translation
  4. `docker-compose up` on a fresh machine starts a production-ready instance with pinned image versions, named volumes, and health checks passing
**Plans**: TBD

### Phase 9: Workflow Creation UI
**Goal**: Users can create and launch validation workflows directly from the dashboard, with document upload, a dynamic circuit builder (phases/steps/validators/quorum rules), optional template loading, and a review step before launch
**Depends on**: Phase 8
**Success Criteria** (what must be TRUE):
  1. A "New Workflow" button is visible on the dashboard and navigates to the creation wizard
  2. A user can upload one or more documents and see them listed before proceeding
  3. A user can define a validation circuit with multiple phases, each containing steps with configurable quorum rules and validator emails
  4. A user can optionally load a saved template to pre-fill the circuit builder
  5. A review step shows the full configuration before launch, and clicking "Launch" creates the workflow and redirects to the detail page
**Plans**:
  - [x] 09-01: Wizard scaffold, document upload step, route, New Workflow button, i18n keys
  - [ ] 09-02: Circuit builder step
  - [ ] 09-03: Review & launch step

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9

| Phase | Status | Completed |
|-------|--------|-----------|
| 1. Foundation | Complete | 2026-02-19 |
| 2. Data Model + Auth | Complete | 2026-02-19 |
| 3. Document Upload + Preview | Complete | 2026-02-19 |
| 4. Workflow Engine | Complete | 2026-02-19 |
| 5. Email Action Channel | Complete | 2026-02-19 |
| 6. Dashboard + Audit | Complete | 2026-02-19 |
| 7. Workflow Templates | Complete | 2026-02-19 |
| 8. i18n Completion + Docker Polish | Complete | 2026-02-19 |
| 9. Workflow Creation UI | Complete (3/3) | 2026-02-19 |

### Phase 10: Améliorer gestion demandes et UX

**Goal:** Improve the workflow management experience and UX: enriched action confirmation with workflow summary, horizontal stepper on workflow detail page, dashboard with table/filters/badges, initiator email notifications, BullMQ deadline reminders, workflow cancellation/re-notification, and admin user CRUD with 3-role RBAC
**Depends on:** Phase 9
**Plans:** 5 plans

Plans:
- [ ] 10-01-PLAN.md — Backend: Schema migration (3-role RBAC) + BullMQ reminder pipeline + initiator email notifications
- [ ] 10-02-PLAN.md — Backend: Workflow cancel/notify endpoints + action token info + admin user CRUD API
- [ ] 10-03-PLAN.md — Frontend: Enriched action confirmation page + dashboard table/filters/badges
- [ ] 10-04-PLAN.md — Frontend: Workflow detail stepper + step details + PDF preview + cancel/notify actions
- [ ] 10-05-PLAN.md — Frontend: Admin users page + end-to-end verification checkpoint
