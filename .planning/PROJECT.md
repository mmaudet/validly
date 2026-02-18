# Validly

## What This Is

Validly is an open-source document validation workflow platform. It lets organizations submit documents to configurable approval circuits — combining sequential and parallel phases — with full traceability. It replaces informal validation processes (emails, oral approvals, paper signatures sitting on someone's desk) with a structured, auditable, sovereign workflow.

## Core Value

Any validator can approve or refuse a document directly from their email, without ever logging into the platform — making validation as frictionless as possible while maintaining a complete audit trail.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Upload documents (PDF, DOCX, images) with metadata (title, description, tags)
- [ ] Document preview without download
- [ ] Workflow engine: sequential phases containing sequential or parallel steps
- [ ] Quorum rules per step: unanimity, majority, any-of
- [ ] Optional deadlines with automatic email reminders
- [ ] Approve/refuse actions with optional comments, immutably timestamped
- [ ] Email as primary action channel: approve/refuse directly from email via secure token links
- [ ] Web dashboard: "My submissions" view (initiator) and "My pending actions" view (validator)
- [ ] Workflow visualization: current step, pending validators, action history
- [ ] Reusable workflow templates shared at organization level
- [ ] Immutable audit trail: all actions logged with actor identity and timestamp
- [ ] Audit trail exportable to CSV
- [ ] User management: signup, email/password authentication, JWT tokens
- [ ] Refusal sends workflow back to previous step with notification and refusal comment
- [ ] Internationalization: English default + French from v1 (UI and email templates)
- [ ] Docker Compose deployment (single command spins up everything)
- [ ] API-first: REST API documented via OpenAPI/Swagger, auto-generated

### Out of Scope

- eIDAS electronic signatures — high complexity, regulatory overhead, defer post-v1
- Structured forms (leave requests, purchase orders) — different product concern
- Document annotation/co-editing — Validly handles finished documents
- Conditional routing in workflows — adds workflow engine complexity, defer post-v1
- Automatic escalation on non-response — v1 uses reminders only
- Document versioning — defer post-v1
- Validation delegation — defer post-v1
- SSO/SAML/OpenID Connect — v1 uses email/password, SSO is post-v1 priority #1
- Third-party integrations (GED, office suites) — defer post-v1
- Drag-and-drop visual workflow editor — v1 uses form-based workflow creation
- WCAG 2.1 AA full compliance — aim for good accessibility practices but not formal audit in v1

## Context

- **Open source project** by LINAGORA, designed to attract contributors with modern stack choices
- **Sovereign approach**: self-hostable, no dependency on proprietary cloud services
- **Target market**: French public administrations, enterprises, associations — and international organizations
- **Competitors**: DocuSign Workflow, Adobe Sign, Kissflow, ProcessMaker, Bonita — all proprietary, complex, or expensive
- **Development context**: built with Claude Code + GSD framework, serving as a productivity demonstrator (but product quality comes first)
- **File storage**: start with abstracted local storage, migrate to MinIO (S3-compatible) when Docker deployment is added
- **Workflow engine**: internal state machine (finite automaton), no external BPMN engine dependency

## Constraints

- **Tech stack**: To be determined by research — TypeScript backend likely, frontend framework TBD. PostgreSQL for data.
- **Email delivery**: SMTP-based, configurable. Email action links use secure single-use tokens.
- **Deployment**: Must work via `docker-compose up` for demo/production
- **i18n**: English + French from day 1 — both UI and email templates must be localized
- **API**: OpenAPI 3.x spec auto-generated, Swagger UI served by backend
- **Security**: JWT auth, HTTPS, encrypted storage at rest, append-only audit trail

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Email as primary action channel (not just notification) | The core problem is validators not acting — email removes friction | — Pending |
| Internal state machine for workflow engine | Avoid BPMN engine complexity, keep it simple | — Pending |
| Start with local file storage, abstract for later MinIO | Ship faster, Docker Compose will include MinIO | — Pending |
| Refusal goes back to previous step (not initiator) | Matches real-world validation circuits | — Pending |
| English + French from v1 | Target market is primarily French organizations | — Pending |
| Stack decided by research | Let domain analysis inform best choices | — Pending |

---
*Last updated: 2026-02-19 after initialization*
