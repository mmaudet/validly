# Requirements: Validly

**Defined:** 2026-02-19
**Core Value:** Any validator can approve or refuse a document directly from their email, without ever logging into the platform — making validation as frictionless as possible while maintaining a complete audit trail.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Authentication

- [ ] **AUTH-01**: User can sign up with email and password
- [ ] **AUTH-02**: User can log in and receive a JWT token
- [ ] **AUTH-03**: User session persists across browser refresh (JWT refresh mechanism)
- [ ] **AUTH-04**: User can log out from any page
- [ ] **AUTH-05**: System distinguishes submitter and validator roles per workflow

### Documents

- [ ] **DOC-01**: User can upload documents (PDF, DOCX, images) with title, description, and tags
- [ ] **DOC-02**: Uploaded files are stored via StorageAdapter (local filesystem, swappable to MinIO)
- [ ] **DOC-03**: User can preview PDF documents in-browser without downloading (PDF.js)
- [ ] **DOC-04**: User can view image documents inline in the browser
- [ ] **DOC-05**: Document metadata is stored in the database (title, description, tags, uploader, timestamp)

### Workflow Engine

- [ ] **WF-01**: User can launch a workflow by attaching documents and selecting a circuit (phases with steps)
- [ ] **WF-02**: Workflow engine supports sequential phases containing sequential or parallel steps
- [ ] **WF-03**: Each step has configurable quorum rules: unanimity, majority, or any-of
- [ ] **WF-04**: Validators can approve or refuse with a mandatory comment, immutably timestamped
- [ ] **WF-05**: Refusal sends the workflow back to the previous step with notification and refusal comment
- [ ] **WF-06**: Each step can have an optional deadline
- [ ] **WF-07**: Workflow state machine enforces valid transitions only (explicit transition guards)
- [ ] **WF-08**: Workflow instances are deep-copied from templates at launch (template changes don't affect running workflows)

### Email Action Channel

- [ ] **EMAIL-01**: Validators receive email notification when an action is pending on them
- [ ] **EMAIL-02**: Email contains secure one-time token links to approve or refuse directly (no login required)
- [ ] **EMAIL-03**: Token is CSPRNG-generated, hash-stored, scoped to step+action+validator, single-use, time-limited
- [ ] **EMAIL-04**: Expired or already-used token shows a clear error page with guidance
- [ ] **EMAIL-05**: Automated reminder emails are sent before step deadline expires
- [ ] **EMAIL-06**: Email templates are localized (EN + FR)

### Dashboard

- [ ] **DASH-01**: Initiator can see "My submissions" view listing all their submitted documents with status
- [ ] **DASH-02**: Validator can see "My pending actions" view listing all workflows awaiting their action
- [ ] **DASH-03**: User can view workflow visualization showing step progress, pending validators, and action history
- [ ] **DASH-04**: All list views are paginated

### Audit & Compliance

- [ ] **AUDIT-01**: All workflow actions are logged in an immutable, append-only audit trail (actor identity + timestamp)
- [ ] **AUDIT-02**: Audit trail table enforces INSERT-only at database level (no UPDATE or DELETE)
- [ ] **AUDIT-03**: User can export audit trail to CSV

### Workflow Templates

- [ ] **TMPL-01**: User can create workflow templates defining phases, steps, validators, and quorum rules
- [ ] **TMPL-02**: Templates are created via a structured form (not drag-and-drop)
- [ ] **TMPL-03**: Templates can be shared at organization level
- [ ] **TMPL-04**: Launching a workflow from a template deep-copies the template structure

### Infrastructure & i18n

- [ ] **INFRA-01**: Application deploys via single `docker-compose up` command (PostgreSQL, Redis, backend, frontend)
- [ ] **INFRA-02**: REST API is documented via auto-generated OpenAPI/Swagger spec
- [ ] **INFRA-03**: Swagger UI is served by the backend
- [ ] **INFRA-04**: UI is fully localized in English and French
- [ ] **INFRA-05**: Email templates are fully localized in English and French
- [ ] **INFRA-06**: i18n is scaffolded from project start (no hardcoded user-facing strings)

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Authentication v2

- **AUTH-V2-01**: SSO / SAML / OpenID Connect authentication
- **AUTH-V2-02**: OAuth login (Google, GitHub)

### Documents v2

- **DOC-V2-01**: DOCX in-browser preview (requires conversion pipeline)
- **DOC-V2-02**: Document versioning (resubmission with version tracking)

### Workflow Engine v2

- **WF-V2-01**: Conditional routing in workflows (route based on document properties or step outcomes)
- **WF-V2-02**: Automatic escalation on non-response (beyond reminders)
- **WF-V2-03**: Delegation of approval authority (vacation coverage)

### Integration v2

- **INT-V2-01**: Webhook support for external integrations
- **INT-V2-02**: Third-party connectors (SharePoint, Google Drive, Slack)

### Reporting v2

- **RPT-V2-01**: Audit trail PDF export (signed report)
- **RPT-V2-02**: Dashboard analytics (bottleneck identification, average approval time)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| eIDAS / qualified electronic signatures | Regulatory overhead, PKI complexity; internal workflows don't need it |
| Native mobile app (iOS/Android) | Email-based approval from mobile email client covers the use case |
| Drag-and-drop visual workflow editor | HIGH complexity for v1; form-based creation covers 90% of use cases |
| Document annotation / co-editing | Different product category; Validly handles finished documents |
| Structured forms (leave requests, purchase orders) | Different product concern; out of Validly's core mission |
| Real-time collaborative editing | Not the product focus; validators review, not co-author |
| WCAG 2.1 AA full compliance | Aim for good practices but not formal audit in v1 |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | — | Pending |
| AUTH-02 | — | Pending |
| AUTH-03 | — | Pending |
| AUTH-04 | — | Pending |
| AUTH-05 | — | Pending |
| DOC-01 | — | Pending |
| DOC-02 | — | Pending |
| DOC-03 | — | Pending |
| DOC-04 | — | Pending |
| DOC-05 | — | Pending |
| WF-01 | — | Pending |
| WF-02 | — | Pending |
| WF-03 | — | Pending |
| WF-04 | — | Pending |
| WF-05 | — | Pending |
| WF-06 | — | Pending |
| WF-07 | — | Pending |
| WF-08 | — | Pending |
| EMAIL-01 | — | Pending |
| EMAIL-02 | — | Pending |
| EMAIL-03 | — | Pending |
| EMAIL-04 | — | Pending |
| EMAIL-05 | — | Pending |
| EMAIL-06 | — | Pending |
| DASH-01 | — | Pending |
| DASH-02 | — | Pending |
| DASH-03 | — | Pending |
| DASH-04 | — | Pending |
| AUDIT-01 | — | Pending |
| AUDIT-02 | — | Pending |
| AUDIT-03 | — | Pending |
| TMPL-01 | — | Pending |
| TMPL-02 | — | Pending |
| TMPL-03 | — | Pending |
| TMPL-04 | — | Pending |
| INFRA-01 | — | Pending |
| INFRA-02 | — | Pending |
| INFRA-03 | — | Pending |
| INFRA-04 | — | Pending |
| INFRA-05 | — | Pending |
| INFRA-06 | — | Pending |

**Coverage:**
- v1 requirements: 41 total
- Mapped to phases: 0
- Unmapped: 41 (pending roadmap creation)

---
*Requirements defined: 2026-02-19*
*Last updated: 2026-02-19 after initial definition*
