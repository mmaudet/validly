# Validly

## What This Is

Validly is an open-source document validation workflow platform. It lets organizations submit documents to configurable approval circuits — combining sequential and parallel phases — with full traceability. Validators can approve or refuse directly from email without ever logging in. It replaces informal validation processes (emails, oral approvals, paper signatures) with a structured, auditable, sovereign workflow.

## Core Value

Any validator can approve or refuse a document directly from their email, without ever logging into the platform — making validation as frictionless as possible while maintaining a complete audit trail.

## Requirements

### Validated

- Upload documents (PDF, DOCX, XLSX, PPTX, OD*, images) with metadata (title, description, tags) — v1.0
- Document preview without download (PDF.js, inline images) — v1.0
- Workflow engine: sequential phases containing sequential or parallel steps — v1.0
- Quorum rules per step: unanimity, majority, any-of — v1.0
- Optional deadlines with automatic email reminders (BullMQ) — v1.0
- Approve/refuse actions with mandatory comments, immutably timestamped — v1.0
- Email as primary action channel: approve/refuse directly from email via secure token links — v1.0
- Web dashboard: "My submissions" view (initiator) and "My pending actions" view (validator) — v1.0
- Workflow visualization: stepper, step details, pending validators, action history — v1.0
- Reusable workflow templates with create/edit/delete UI — v1.0
- Immutable audit trail: all actions logged with actor identity and timestamp, INSERT-only DB triggers — v1.0
- Audit trail exportable to CSV — v1.0
- User management: signup, email/password authentication, JWT with refresh — v1.0
- Refusal sends workflow back to previous step with notification and refusal comment — v1.0
- Internationalization: English + French (UI and email templates, locale-aware) — v1.0
- Docker Compose deployment (single command spins up everything) — v1.0
- API-first: REST API documented via OpenAPI/Swagger — v1.0
- 3-role RBAC: Admin, Initiateur, Validateur — v1.0
- Workflow archiving (single + bulk) — v1.0
- Multi-step creation wizard with document upload, circuit builder, template loading — v1.0
- Password reset via secure single-use email link (TOCTOU-safe, anti-enumeration) — v1.1
- User profile page: edit name, change password (session invalidation), switch language — v1.1
- In-app notification center: bell badge, panel, mark-read, 30s polling — v1.1
- Notification preferences: per-type toggle (step approved/refused, workflow completed/refused, comment added) — v1.1
- Workflow comment thread: chronological, append-only, disabled on terminal states — v1.1
- DOCX in-browser preview via client-side conversion (DOMPurify sanitized) — v1.1
- Mobile-responsive layout: hamburger nav, 375px+ support, 44px touch targets — v1.1
- Error pages (404, 500) + React error boundary + Zod form validation + mapApiError — v1.1
- Complete FR/EN i18n on all v1.1 surfaces and email templates — v1.1

### Active

(None — next milestone not yet defined)

### Out of Scope

- eIDAS electronic signatures — regulatory overhead, PKI complexity
- Structured forms (leave requests, purchase orders) — different product concern
- Document annotation/co-editing — Validly handles finished documents
- Conditional routing in workflows — adds complexity, defer post-v1
- Automatic escalation on non-response — v1 uses reminders only
- Document versioning — defer post-v1
- Validation delegation — defer post-v1
- SSO/SAML/OpenID Connect — post-v1 priority #1
- Third-party integrations (GED, office suites) — defer post-v1
- Drag-and-drop visual workflow editor — form-based creation covers use cases
- WCAG 2.1 AA full compliance — good practices but no formal audit in v1
- Rich text comments — XSS complexity, plain text sufficient
- @mentions in threads — typeahead + routing complexity not justified yet
- WebSocket/SSE notifications — 30s polling adequate for async workflows
- Browser push notifications — service worker overhead not warranted
- Avatar uploads — image resize pipeline disproportionate for internal tool
- 2FA/TOTP — separate security hardening milestone

## Context

- **Open source project** by LINAGORA, designed to attract contributors with modern stack choices
- **Sovereign approach**: self-hostable, no dependency on proprietary cloud services
- **Target market**: French public administrations, enterprises, associations — and international organizations
- **Competitors**: DocuSign Workflow, Adobe Sign, Kissflow, ProcessMaker, Bonita — all proprietary, complex, or expensive
- **Shipped v1.1** with 11,432 LOC TypeScript across ~170 files
- **Tech stack**: Node.js 22, Fastify 5, Prisma 6, PostgreSQL 15, BullMQ 5, Redis 7, React 19, Vite 6, Tailwind v4, TanStack Query 5
- **File storage**: abstracted local filesystem via StorageAdapter (swappable to MinIO)
- **Workflow engine**: internal state machine (finite automaton), no external BPMN engine dependency
- **Repository**: github.com/mmaudet/validly
- **Known tech debt**: `reply.status(400 as any)` cast in auth routes (Fastify type limitation), TemplateFormPage circuit builder tablet-minimum by design

## Constraints

- **Tech stack**: Node.js 22 + TypeScript 5.7, Fastify 5, Prisma 6, PostgreSQL 15, React 19, Vite 6, Tailwind v4
- **Email delivery**: SMTP-based via Nodemailer, configurable. Email action links use CSPRNG + SHA-256 hash-stored single-use tokens.
- **Deployment**: `docker-compose up` (PostgreSQL, Redis, Mailpit, backend, frontend)
- **i18n**: English + French on all surfaces (UI + email templates), i18next on both ends
- **API**: OpenAPI 3.x spec auto-generated, Swagger UI at `/docs`
- **Security**: JWT auth with refresh tokens, append-only audit trail with DB triggers

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Email as primary action channel | The core problem is validators not acting — email removes friction | Good — core differentiator |
| Internal state machine for workflow engine | Avoid BPMN engine complexity, keep it simple | Good — clean, maintainable |
| Local file storage with StorageAdapter | Ship faster, swap to MinIO later | Good — abstraction works |
| Refusal goes back to previous step | Matches real-world validation circuits | Good |
| English + French from v1 | Target market is primarily French organizations | Good — 100% coverage |
| Node.js + Fastify + React stack | Research showed best fit for the domain | Good — productive stack |
| Form-based circuit builder (not drag-drop) | 90% of use cases covered with lower complexity | Good — shipped faster |
| executionMode (form) vs execution (API) | react-hook-form naming vs backend schema | Good — clear boundary |
| PostgreSQL triggers for audit immutability | DB-level enforcement, not application-level | Good — tamper-proof |
| BullMQ for deadline/reminder scheduling | Reliable job processing with Redis | Good — async, idempotent |
| Notification.type as String (not Prisma enum) | Avoid enum migration pitfalls in future phases | Good — flexible |
| Atomic token consumption via updateMany | Prevents TOCTOU race conditions on password reset | Good — secure |
| REST polling 30s for notifications | Async workflow timescales make WebSocket unnecessary | Good — simple |
| mapApiError wired into apiFetch | All API errors auto-translate, single integration point | Good — DRY |
| MobileNav as stateless component with props | DashboardPage stays single source of truth for auth state | Good — clean separation |
| Zod error messages as i18n keys | Components call t() at render time, supports language switching | Good — i18n-native |

---
*Last updated: 2026-02-20 after v1.1 UX Polish milestone*
