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
- [x] **WF-02**: Workflow engine supports sequential phases containing sequential or parallel steps
- [ ] **WF-03**: Each step has configurable quorum rules: unanimity, majority, or any-of
- [ ] **WF-04**: Validators can approve or refuse with a mandatory comment, immutably timestamped
- [ ] **WF-05**: Refusal sends the workflow back to the previous step with notification and refusal comment
- [ ] **WF-06**: Each step can have an optional deadline
- [ ] **WF-07**: Workflow state machine enforces valid transitions only (explicit transition guards)
- [x] **WF-08**: Workflow instances are deep-copied from templates at launch (template changes don't affect running workflows)

### Email Action Channel

- [ ] **EMAIL-01**: Validators receive email notification when an action is pending on them
- [ ] **EMAIL-02**: Email contains secure one-time token links to approve or refuse directly (no login required)
- [ ] **EMAIL-03**: Token is CSPRNG-generated, hash-stored, scoped to step+action+validator, single-use, time-limited
- [ ] **EMAIL-04**: Expired or already-used token shows a clear error page with guidance
- [ ] **EMAIL-05**: Automated reminder emails are sent before step deadline expires
- [x] **EMAIL-06**: Email templates are localized (EN + FR)

### Dashboard

- [ ] **DASH-01**: Initiator can see "My submissions" view listing all their submitted documents with status
- [ ] **DASH-02**: Validator can see "My pending actions" view listing all workflows awaiting their action
- [ ] **DASH-03**: User can view workflow visualization showing step progress, pending validators, and action history
- [ ] **DASH-04**: All list views are paginated

### Audit & Compliance

- [ ] **AUDIT-01**: All workflow actions are logged in an immutable, append-only audit trail (actor identity + timestamp)
- [x] **AUDIT-02**: Audit trail table enforces INSERT-only at database level (no UPDATE or DELETE)
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
- [x] **INFRA-05**: Email templates are fully localized in English and French
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
| AUTH-01 | Phase 2 | Complete |
| AUTH-02 | Phase 2 | Complete |
| AUTH-03 | Phase 2 | Complete |
| AUTH-04 | Phase 2 | Complete |
| AUTH-05 | Phase 2 | Complete |
| DOC-01 | Phase 3 | Complete |
| DOC-02 | Phase 3 | Complete |
| DOC-03 | Phase 3 | Complete |
| DOC-04 | Phase 3 | Complete |
| DOC-05 | Phase 3 | Complete |
| WF-01 | Phase 4 | Complete |
| WF-02 | Phase 11 | Complete |
| WF-03 | Phase 4 | Complete |
| WF-04 | Phase 4 | Complete |
| WF-05 | Phase 4 | Complete |
| WF-06 | Phase 4 | Complete |
| WF-07 | Phase 4 | Complete |
| WF-08 | Phase 11 | Complete |
| EMAIL-01 | Phase 5 | Complete |
| EMAIL-02 | Phase 5 | Complete |
| EMAIL-03 | Phase 5 | Complete |
| EMAIL-04 | Phase 5 | Complete |
| EMAIL-05 | Phase 5 | Complete |
| EMAIL-06 | Phase 11 | Complete |
| DASH-01 | Phase 6 | Complete |
| DASH-02 | Phase 6 | Complete |
| DASH-03 | Phase 6 | Complete |
| DASH-04 | Phase 6 | Complete |
| AUDIT-01 | Phase 2 | Complete |
| AUDIT-02 | Phase 11 | Complete |
| AUDIT-03 | Phase 6 | Complete |
| TMPL-01 | Phase 12 | Pending |
| TMPL-02 | Phase 12 | Pending |
| TMPL-03 | Phase 7 | Complete |
| TMPL-04 | Phase 7 | Complete |
| INFRA-01 | Phase 1 | Complete |
| INFRA-02 | Phase 1 | Complete |
| INFRA-03 | Phase 1 | Complete |
| INFRA-04 | Phase 8 | Complete |
| INFRA-05 | Phase 11 | Complete |
| INFRA-06 | Phase 1 | Complete |

**Coverage:**
- v1 requirements: 41 total
- Satisfied: 34
- Pending (gap closure): 7 (WF-02, WF-08, EMAIL-06, AUDIT-02, INFRA-05 → Phase 11; TMPL-01, TMPL-02 → Phase 12)
- Unmapped: 0

---
*Requirements defined: 2026-02-19*
*Last updated: 2026-02-19 after v1.0 audit gap closure planning*
*Last updated: 2026-02-19 after roadmap creation*
