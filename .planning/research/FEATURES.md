# Feature Research

**Domain:** Document validation workflow platform (approval circuits)
**Researched:** 2026-02-19
**Confidence:** MEDIUM — Based on competitor analysis via WebSearch and official docs. Core claims verified across multiple sources. French public sector specifics have lower confidence (single source).

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Document upload (PDF, DOCX, images) | Every approval system starts with a document | LOW | Multi-format is industry standard; preview without download is an additional expectation |
| In-browser document preview | Users expect to review without downloading | MEDIUM | PDF.js is standard; DOCX preview requires conversion pipeline |
| Sequential approval routing | Fundamental approval pattern (A → B → C) | MEDIUM | Core of any approval system; must be reliable before adding complexity |
| Parallel approval steps | Multiple reviewers simultaneously | MEDIUM | Standard in all competitors; required for multi-stakeholder decisions |
| Email notifications on pending action | Approvers expect to be notified | LOW | Without this, the system is unusable |
| Approve / Refuse actions with comment | Minimum actionable outcomes | LOW | Comment is mandatory — a bare approve button is insufficient for audit purposes |
| Audit trail (who did what, when) | Compliance baseline; regulators and managers expect it | MEDIUM | Append-only; must be tamper-evident |
| Dashboard showing pending items | Users need a "my to-do" view | MEDIUM | Both initiator view ("my submissions") and validator view ("pending my action") are expected |
| Workflow status visibility | "Where is my document right now?" | MEDIUM | Timeline or step-by-step visualization showing completed, active, pending steps |
| User authentication | Password-protected access | LOW | Email/password minimum; organizations will refuse to use an unauth'd system |
| Role distinction (submitter vs validator) | Different capabilities for different actors | LOW | Submitters initiate; validators act; mixing these creates confusion |
| Deadline/reminder system | Without deadlines, workflows stall indefinitely | MEDIUM | At minimum: deadline per step + automated reminder emails |
| Immutable audit export | Compliance teams need the trail as evidence | LOW | CSV export is the minimum; PDF report is a differentiator |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not expected, but valued.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Approve/refuse directly from email (no login required) | Eliminates the #1 friction point: validators who don't log in | HIGH | Secure one-time token in email link; token invalidation after use; replay-proof. This is Validly's core differentiator — no competitor makes it this frictionless for validators |
| Quorum rules (unanimity, majority, any-of) per step | Real-world approval circuits are not always "everyone must approve" | MEDIUM | Majority and any-of quorums are uncommon in competitors; Kissflow and DocuSign require unanimity by default |
| Workflow templates shared at org level | "Apply our standard 3-step financial approval" in one click | MEDIUM | Competitors have templates but limit sharing to admins; org-level sharing is the differentiator |
| Refusal routes back to previous step (not to initiator) | Matches real bureaucratic validation circuits | MEDIUM | Most competitors return to initiator on refusal; returning to the previous step with context preserves review chain integrity — critical for public admin |
| Self-hostable / sovereign deployment | Organizations with data residency requirements can own their data | MEDIUM | French public sector cannot use US cloud services for sensitive documents; Docker Compose single-command deployment removes the devops barrier |
| Open source (LINAGORA) | Auditable, forkable, community-driven | LOW | Attracts contributors; gives public sector the ability to audit the code |
| i18n from day 1 (EN + FR) | French public organizations expect French UI and French email templates | MEDIUM | Competitors are English-first; French localization is often poor or requires professional services |
| OpenAPI / Swagger documentation | Developer-friendly; integration-ready | LOW | Enables ecosystem of integrations without requiring Validly to build them all |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Drag-and-drop visual workflow editor | Users want "no-code" workflow design | HIGH complexity for v1; visual BPMN-style editors require significant frontend investment and are hard to make accessible | Form-based workflow creation: a structured form with step/phase configuration achieves the same outcomes for 90% of use cases with 20% of the effort |
| eIDAS / qualified electronic signatures | Legal enforceability for contracts | Regulatory compliance overhead (PKI, TSP registration, eIDAS audits); adds months to v1; not needed for internal validation workflows | Timestamped approval record with actor identity is sufficient for internal workflows; eIDAS is post-v1 |
| Document versioning (multiple versions of same doc) | "I updated the document mid-circuit" | Versioning mid-circuit invalidates prior approvals; creates legal ambiguity about what was approved; complex edge cases | Require a new submission for updated documents; simplicity is correctness here |
| Conditional routing in workflows | "Route to legal only if contract value > 10k" | Dramatically complicates the workflow engine state machine; conditional branches require expression evaluation, UI for conditions, and significantly more QA | Fixed routing phases with explicit step skipping by initiator is 80% of the value |
| Automatic escalation on non-response | "Send to manager if validator doesn't respond in 3 days" | Escalation chains are organization-specific, hard to configure, and often misfire; create political friction when managers get escalated-to unexpectedly | Reminder emails at configurable intervals; deadline-based notifications to both validator and initiator; let humans escalate |
| Real-time collaborative annotation on documents | "Mark up the PDF together" | Different product category (co-editing); complex technical implementation; Validly validates finished documents, not drafts | Refusal with comment + resubmission covers the feedback loop |
| Delegation of approval authority | "I'm on vacation, delegate to my colleague" | Audit trail ambiguity (who actually decided?); complex identity management; easy to get wrong | Clear "out of office" notification to submitter; initiator can re-configure the circuit |
| SSO / SAML / OpenID Connect (v1) | Enterprise IT requires SSO | High integration complexity per IdP; each organization has different IdP config; delays v1 significantly | Email/password with strong password requirements for v1; SSO is post-v1 priority #1 |
| Third-party integrations (SharePoint, Google Drive, Slack) | "Pull documents from where they already live" | Each integration has authentication complexity, rate limits, API changes; maintenance burden per integration | API-first design allows third parties to build integrations; webhook support enables push-based integration |
| In-app document editing / annotation | "Let validators annotate directly" | Turns Validly into a document editor — different product focus; high complexity | Validators add comments on refusal; the document is finished when submitted |
| Mobile native app (iOS/Android) | "Approve on my phone" | Building and maintaining a native mobile app doubles the frontend work; app store review delays | Responsive web design + email-based approval from mobile email client covers the use case |

---

## Feature Dependencies

```
[User Authentication]
    └──requires──> [Dashboard views] (need identity to scope views)
    └──requires──> [Audit trail] (need actor identity for log entries)

[Document Upload]
    └──requires──> [User Authentication] (authenticated submissions only)
    └──enables──>  [Document Preview] (need stored document to preview)

[Workflow Engine (Sequential/Parallel)]
    └──requires──> [Document Upload] (engine acts on submitted documents)
    └──requires──> [User Authentication] (validators must be identified)
    └──enables──>  [Quorum Rules] (quorum is a per-step engine feature)
    └──enables──>  [Deadlines + Reminders] (engine drives reminder scheduling)
    └──enables──>  [Audit Trail] (engine generates all state-change events)

[Email Notification System]
    └──requires──> [Workflow Engine] (engine triggers notifications)
    └──enables──>  [Email-based Approve/Refuse] (action tokens sent via email)

[Email-based Approve/Refuse]
    └──requires──> [Email Notification System] (tokens delivered by email)
    └──requires──> [Secure Token System] (one-time use, time-limited tokens)
    └──requires──> [Workflow Engine] (token action drives state transition)

[Workflow Templates]
    └──requires──> [Workflow Engine] (templates instantiate as circuits)
    └──enhances──> [Dashboard] (template list is discoverable from dashboard)

[Audit Trail]
    └──requires──> [Workflow Engine] (all events are engine-generated)
    └──enables──>  [Audit Export] (CSV/PDF is a view over the trail)

[Workflow Visualization]
    └──requires──> [Workflow Engine] (visualization reflects engine state)
    └──requires──> [Dashboard] (visualization is surfaced in dashboard)

[i18n (EN+FR)]
    └──affects──>  [Email Notification System] (email templates must be localized)
    └──affects──>  [Dashboard] (UI must be translated)
    └──must be built first] — retrofitting i18n is extremely painful
```

### Dependency Notes

- **Email-based Approve/Refuse requires Secure Token System:** Each email action link carries a one-time token tied to a specific pending action. Token must expire after use and after deadline. This is the most security-sensitive piece of the system.
- **i18n must be foundational, not retrofitted:** Adding i18n after the fact requires touching every string in the codebase. Build with i18n hooks from day 1, even if only EN is complete initially.
- **Workflow Engine is the critical path:** Almost every other feature depends on it. Rushing the engine design creates technical debt that is expensive to undo.
- **Quorum Rules enhance Workflow Engine:** Quorum (majority, any-of) is a per-step configuration property of the engine; it is not a separate system. Build it into the engine's step model from the start to avoid a rewrite.

---

## MVP Definition

### Launch With (v1)

Minimum viable product — what's needed to validate the concept and serve the target market.

- [x] **Document upload** (PDF, DOCX, images) with title/description/tags — why essential: the system has nothing to validate without documents
- [x] **In-browser document preview** — why essential: validators need to read what they're approving
- [x] **Workflow engine: sequential phases with sequential or parallel steps** — why essential: the core product
- [x] **Quorum rules per step** (unanimity, majority, any-of) — why essential: differentiator that real-world circuits require; easier to build into engine now than retrofit
- [x] **Email notification on pending action** — why essential: validators don't log in proactively
- [x] **Email-based Approve/Refuse with secure tokens** — why essential: core differentiator; the reason Validly exists
- [x] **Approve/Refuse with mandatory comment field** — why essential: audit trail requires decision rationale
- [x] **Refusal routes back to previous step** with notification + comment — why essential: matches target market's workflow pattern
- [x] **Immutable audit trail** (all actions timestamped, actor-identified) — why essential: public admin and compliance requirements
- [x] **Audit trail export to CSV** — why essential: compliance teams need evidence extraction
- [x] **Web dashboard**: "My submissions" (initiator) + "My pending actions" (validator) — why essential: primary web interface
- [x] **Workflow visualization**: step progress, pending validators, action history — why essential: without this, the system is a black box
- [x] **Workflow templates** shared at org level — why essential: repetitive workflows are the primary use case in target market
- [x] **Deadlines with reminder emails** — why essential: workflows must not stall silently
- [x] **User management**: signup, email/password auth, JWT — why essential: must know who is acting
- [x] **i18n: EN + FR** (UI and email templates) — why essential: target market is primarily French
- [x] **Docker Compose deployment** — why essential: self-hosted requirement; one-command setup is the accessibility bar
- [x] **OpenAPI / Swagger** — why essential: API-first enables ecosystem integrations

### Add After Validation (v1.x)

Features to add once core workflow is working and users are validated.

- [ ] **SSO / SAML / OpenID Connect** — trigger: first enterprise customer requests it; this is the #1 post-v1 priority
- [ ] **Approval delegation** — trigger: users report vacation blocking as a recurring pain point
- [ ] **Document versioning** — trigger: users request ability to update doc mid-circuit with clear reapproval semantics
- [ ] **Webhook support** — trigger: integrations requested; implement before building specific connectors
- [ ] **Audit trail PDF export** — trigger: legal teams need signed export; more formal than CSV
- [ ] **Advanced dashboard analytics** (bottleneck identification, avg. approval time) — trigger: admin users want operational insights

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] **Conditional routing** — defer: significantly complicates engine; validate demand with v1 users first
- [ ] **Automatic escalation on non-response** — defer: reminder + deadline covers 90% of cases; escalation is politically sensitive
- [ ] **eIDAS / qualified electronic signatures** — defer: high regulatory overhead; different compliance regime
- [ ] **Native mobile app** — defer: email-from-mobile covers the use case; native app is investment for established user base
- [ ] **Third-party integrations** (SharePoint, Google Drive, Slack) — defer: API-first enables community-built integrations

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Document upload + preview | HIGH | MEDIUM | P1 |
| Workflow engine (sequential/parallel) | HIGH | HIGH | P1 |
| Email-based Approve/Refuse (tokens) | HIGH | HIGH | P1 |
| Email notifications | HIGH | LOW | P1 |
| Immutable audit trail | HIGH | MEDIUM | P1 |
| Dashboard (submissions + pending) | HIGH | MEDIUM | P1 |
| i18n (EN + FR) | HIGH (for target market) | MEDIUM | P1 |
| Quorum rules | HIGH (for target market) | MEDIUM | P1 |
| Workflow templates | MEDIUM | MEDIUM | P1 |
| Deadlines + reminders | HIGH | LOW | P1 |
| Workflow visualization | MEDIUM | MEDIUM | P1 |
| Audit export CSV | MEDIUM | LOW | P1 |
| Docker Compose deployment | HIGH (for target market) | LOW | P1 |
| OpenAPI / Swagger | MEDIUM | LOW | P1 |
| SSO / SAML | HIGH (enterprise) | HIGH | P2 |
| Delegation | MEDIUM | HIGH | P2 |
| Document versioning | MEDIUM | HIGH | P2 |
| Webhooks | MEDIUM | MEDIUM | P2 |
| Audit PDF export | MEDIUM | LOW | P2 |
| Conditional routing | MEDIUM | VERY HIGH | P3 |
| Auto-escalation | LOW | HIGH | P3 |
| Native mobile app | LOW | VERY HIGH | P3 |
| eIDAS signatures | LOW (v1) | VERY HIGH | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

---

## Competitor Feature Analysis

| Feature | DocuSign / Adobe Sign | Kissflow | ProcessMaker / Bonita | Validly Approach |
|---------|----------------------|----------|-----------------------|-----------------|
| Approval routing | Sequential + parallel, but signature-centric | Sequential + parallel, no-code | BPMN-based, complex | Sequential + parallel phases; no signature requirement for internal validation |
| Quorum rules | Unanimity or any (limited) | Unanimity default | Configurable in BPMN | Unanimity, majority, any-of — configurable per step |
| Email action | Notification only; must click through to portal | Notification only | Notification only | Approve/Refuse directly from email via secure token |
| Refusal behavior | Returns to initiator | Returns to initiator | Returns to initiator | Returns to previous step — preserves review chain |
| Audit trail | YES (compliance-grade) | YES (basic) | YES (BPMN process log) | YES (immutable, append-only, exportable) |
| Self-hosted | No (cloud-only) | No (cloud-only) | YES (ProcessMaker) / YES (Bonita) | YES — Docker Compose, sovereign |
| Open source | No | No | Partial (community edition) | YES — full open source |
| French i18n | Poor / professional services | English-first | Partial | Day 1: FR + EN, UI and emails |
| Workflow templates | YES | YES | YES (BPMN templates) | YES — org-level shared templates |
| Visual workflow builder | YES (drag-and-drop) | YES (no-code) | YES (BPMN studio) | Form-based (v1); drag-and-drop deferred |
| eIDAS signatures | YES | No | Partial | Deferred post-v1 |
| Pricing model | Expensive per-user SaaS | Per-user SaaS | Per-user SaaS / on-prem license | Free (open source) |

---

## Sources

- Digital Project Manager — "32 Best Approval Workflow Software Solutions In 2026": https://thedigitalprojectmanager.com/tools/best-approval-workflow-software/
- Productive.io — "Top 10 Workflow Approval Software (Paid & Free) 2026 Review": https://productive.io/blog/workflow-approval-software/
- Cflow — "Document Approval Software": https://www.cflowapps.com/document-approval-software-system/
- Kissflow vs ProcessMaker comparison: https://kissflow.com/compare/kissflow-vs-processmaker/
- fynk — "How to create an automated document approval workflow": https://fynk.com/en/blog/document-approval-workflow/
- AgileSoftLabs — "Approval Process Template & Workflow Features 2025": https://www.agilesoftlabs.com/products/human-resources/approval-management/features
- DocuSign community — "Automate Approval Workflows with Docusign Conditional Routing (2025 Update)": https://community.docusign.com/general-74/automate-approval-workflows-with-docusign-conditional-routing-2025-update-23405
- Microsoft Learn — "Create parallel approval workflows": https://learn.microsoft.com/en-us/power-automate/parallel-modern-approvals
- DocuSign review 2026: https://oneflow.com/blog/docusign-review/
- Bonita BPM: https://www.bonitasoft.com/platform/process-automation-engine
- DINUM / LaSuite sovereign document platform: https://lasuite.numerique.gouv.fr/produits/docs
- Cflow — Parallel Pathways and Multi-Level Approvals: https://www.cflowapps.com/parallel-pathways-multi-level-approvals-workflow/
- WWU — "Choosing Best Practice: e-Approval or e-Signature": https://its.wwu.edu/pro-320001-choosing-best-practice-e-approval-or-e-signature

---
*Feature research for: Document validation workflow platform (Validly)*
*Researched: 2026-02-19*
