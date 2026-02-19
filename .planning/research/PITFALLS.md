# Pitfalls Research

**Domain:** Document validation workflow platform (open-source, email-driven, state machine engine)
**Researched:** 2026-02-19
**Confidence:** MEDIUM — WebSearch findings cross-referenced with multiple sources; no single authoritative post-mortem available for this exact domain combination.

---

## Critical Pitfalls

### Pitfall 1: Non-Atomic State Transitions Break Audit Integrity

**What goes wrong:**
When a workflow step changes state (e.g., "pending" → "approved"), the engine writes the new state to the database AND sends an email notification as two separate operations. If the email send succeeds but the DB write fails (or vice versa), the system is inconsistent: the approver received an email saying "approved" but the record says "pending." The audit trail captures a ghost event — or worse, misses the real one.

**Why it happens:**
Developers treat state mutation and side effects (email, notifications, audit log entries) as sequential calls in the same code path, without wrapping them in a transactional outbox or saga pattern. Works fine in dev, fails silently under load or transient network issues.

**How to avoid:**
Implement the Outbox Pattern: commit the state transition and the pending side-effect record in a single DB transaction, then deliver the email from a background worker reading the outbox table. The audit log entry must be written inside the same transaction as the state change — never after. Use database-level constraints to enforce append-only behavior on the audit table.

**Warning signs:**
- "Resend notification" feature requires re-reading state and reconstructing what happened
- Email send is called directly from a controller action, not a background job
- Audit log entries use a separate DB connection from state transitions
- Any "retry email" logic that re-evaluates workflow state

**Phase to address:** Core workflow engine phase (state machine implementation). Must be a foundational design decision, not a retrofit.

---

### Pitfall 2: Email Approval Tokens Without Expiry, Single-Use Enforcement, or CSRF Protection

**What goes wrong:**
Approval tokens embedded in email links are long-lived, reusable, and unauthenticated beyond the token itself. An approver forwards an email, a link is scraped from a mail archive, or an attacker with access to the mailbox replays an old "approve" link months later. Worse: if tokens are predictable (sequential IDs, weak random), an attacker can enumerate them.

**Why it happens:**
Developers focus on the happy path (approver clicks link, action succeeds) and underestimate email as a security channel. Token generation often reuses UUIDs without expiry logic. Single-use invalidation requires a stateful check developers skip to "keep it simple."

**How to avoid:**
- Generate tokens with a cryptographically secure random source (128+ bits of entropy), not UUIDs
- Store a hashed version of the token, never the plaintext, to prevent DB-level exposure
- Enforce strict token expiry (24-48 hours maximum, configurable per workflow)
- Mark tokens as consumed on first use; reject subsequent requests with a clear "already actioned" message
- Scope tokens to the specific workflow step ID and expected action (approve/refuse) — a token for step 2 approval cannot be used for step 3
- Log all token use attempts (valid, expired, already-used) to the immutable audit trail

**Warning signs:**
- Token is a raw UUID stored in plaintext in the DB
- No `expires_at` column on the token table
- Token validation only checks existence, not consumed status
- Email links work indefinitely in dev/test

**Phase to address:** Email action channel implementation phase. Cannot be added later without invalidating existing tokens.

---

### Pitfall 3: Mutable or Patchable Audit Trail

**What goes wrong:**
The audit trail can be altered after the fact — through SQL UPDATE statements, ORM soft deletes, or simple admin backdoors. In regulated environments (French public administration, RGPD compliance), a mutable audit trail is worthless for legal defense. Even unintentional schema migrations that add nullable columns or backfill operations can undermine integrity.

**Why it happens:**
Audit logging is treated as a feature added on top of the domain model, not as an architectural constraint. Standard ORM usage (update, delete) applies to audit records without restriction. Developers prioritize developer convenience over immutability guarantees.

**How to avoid:**
- Create a dedicated `audit_events` table with no UPDATE or DELETE grants — application DB user must only have INSERT + SELECT on this table
- Store a SHA-256 hash chain where each entry includes the hash of the previous entry, making post-hoc tampering detectable
- For public-sector compliance, consider append-only log storage (e.g., PostgreSQL table with row security policies and no UPDATE/DELETE)
- Document the immutability guarantees explicitly in the API contract and contribution guide

**Warning signs:**
- Audit events are columns on the same table as the entity they describe
- ORM model for audit events includes standard update/delete methods
- No DB-level write restriction on the audit table
- Admin interface allows "correcting" historical records

**Phase to address:** Data model / database schema phase (Phase 1). Retrofitting is expensive because all existing FK references and tooling will need updates.

---

### Pitfall 4: Quorum Logic Implemented as Application Code Without Idempotency

**What goes wrong:**
Parallel approval steps with quorum rules (e.g., "3 of 5 reviewers must approve") require counting decisions and transitioning when the threshold is met. If two reviewers submit their approval at the exact same time, the application reads the current count (both see count=2, threshold=3), both increment to 3, and both trigger the "threshold reached" transition — resulting in duplicate downstream actions (two emails sent, step transitioned twice, audit log shows two completions).

**Why it happens:**
Quorum checks are implemented with a "read count, compare, maybe transition" sequence without a database-level lock or atomic compare-and-set. In single-threaded dev environments, this never manifests. Under concurrent load with email webhooks or concurrent user actions, it surfaces as a race condition.

**How to avoid:**
- Use a database-level atomic operation for quorum counting: `UPDATE steps SET decision_count = decision_count + 1 WHERE id = ? RETURNING decision_count` — check if the returned count equals the quorum threshold in the same transaction
- Wrap the "record decision + check quorum + maybe trigger transition" in a serializable DB transaction with a row-level lock on the workflow step
- Make all downstream actions idempotent with a unique constraint on the triggering event (cannot transition from state X to Y more than once per step instance)
- Test explicitly with concurrent requests against the same workflow step

**Warning signs:**
- Quorum check code reads the count in one query and writes a transition in a separate query
- No database unique constraint on "step instance + action type" for audit events
- "Duplicate email" bug reports in test environments under load
- Step transition logic lives in application code without a lock

**Phase to address:** Workflow engine core, specifically the parallel/quorum execution model. Must be built correctly from the start.

---

### Pitfall 5: Hardcoded Strings Outside i18n from Day One

**What goes wrong:**
The project commits to EN + FR from v1 but developers hardcode English strings in model validations, email templates, error responses, and notification copy. Adding French requires tracking down hundreds of scattered strings across the codebase. Worse: some strings end up in i18n files, others don't, making the translation layer inconsistently applied. Email subjects, workflow step labels, and error messages are particularly prone to this.

**Why it happens:**
i18n feels like overhead when building the first working version. Developers write `raise "Document not found"` instead of `raise I18n.t("errors.document.not_found")` because it's faster. Email templates are built as HTML with hardcoded English copy.

**How to avoid:**
- Establish a zero-tolerance policy: no literal user-facing strings in code from the first commit — configure a linter rule enforcing this
- Create the full i18n key structure (en.yml, fr.yml) before writing any feature code, even if French translations are placeholder strings initially
- For email templates: use template files that reference i18n keys, not inline HTML with English copy
- Test every user-facing surface with the French locale in CI from week 1

**Warning signs:**
- `en.yml` has 80 keys, `fr.yml` has 60 keys
- Email templates contain hardcoded English text
- Error messages returned by the API are English strings, not translated
- Model validation messages use string literals

**Phase to address:** Project scaffold / foundation phase (Phase 0). Cannot be effectively retrofitted without touching every string in the codebase.

---

### Pitfall 6: Deadline/Escalation Timer Logic That Fires Repeatedly or Is Lost on Restart

**What goes wrong:**
Workflow deadlines (e.g., "approver must respond within 48 hours or workflow escalates") are implemented with naive cron jobs or in-memory scheduled tasks. Under two failure modes: (a) the app restarts and pending timers are lost — deadlines never fire; (b) the cron job runs on every interval and fires the escalation multiple times if the condition check isn't idempotent.

**Why it happens:**
Deadline handling looks like a cron problem but is actually a durable timer problem. Developers add `whenever` gem or a basic cron expression without considering crash recovery, duplicate execution, or clock skew across restarts.

**How to avoid:**
- Persist scheduled events in the database with `scheduled_for` timestamp and `fired_at` nullable timestamp — the background job queries for unfired events where `scheduled_for <= NOW() AND fired_at IS NULL`
- Use a row-level lock (`SELECT FOR UPDATE SKIP LOCKED`) to prevent duplicate processing across multiple worker instances
- Record `fired_at` atomically when the escalation action is taken — never re-fire if `fired_at` is set
- Ensure timers survive application restart since they live in the DB, not in memory

**Warning signs:**
- Deadline logic is in a cron job that calls `workflow.check_deadlines` without per-deadline tracking
- Escalation emails sent multiple times for the same deadline
- Timers defined in application memory (e.g., `Thread.new { sleep 48.hours; escalate }`)
- No `scheduled_events` or equivalent table in the schema

**Phase to address:** Workflow engine core, deadline subsystem. Should be designed alongside state transitions, not added as a later enhancement.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Soft-delete workflow steps instead of append-only events | Easier CRUD admin | Audit trail gaps; "deleted" steps invisible | Never — use append-only events |
| Single background job for all async work | Simpler setup | Email sends blocked by slow DB jobs; no priority | MVP only if volume is <100 workflows/day |
| Store token plaintext in DB | Simpler token lookup | DB compromise exposes all pending approval links | Never |
| Skip email deliverability setup (SPF/DKIM/DMARC) | Faster to ship | Approval emails land in spam; users never see them | Never — must be day-1 |
| Inline SQL for quorum counting instead of ORM | "Just this once" | Bypasses ORM-level audit hooks; untestable | Acceptable if documented and tested |
| Hardcode locale to `en` during initial dev | Faster development | All strings need extraction, missing French translations | Never — configure i18n skeleton from commit 1 |

---

## Integration Gotchas

Common mistakes when connecting to external services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| SMTP / transactional email | Using dev SMTP credentials in production; missing SPF/DKIM/DMARC setup | Configure a dedicated transactional email provider (Postmark, Mailjet, SES) with full authentication from day 1; separate subdomain for sends |
| SMTP auth in 2025+ | Using Basic Auth SMTP (deprecated by Google March 2025, Microsoft enforcement 2025-2026) | OAuth 2.0 or API-key-based sending via transactional email provider — never raw SMTP AUTH |
| Email open/click tracking | Tracking pixels interfering with approval token URLs | Strip tracking from approval action links; only track non-action notification emails |
| Docker Compose in production | Using `latest` image tags; no health checks; no persistent volume names | Pin image versions, define named volumes, add healthcheck directives, use `compose.prod.yml` override |
| PostgreSQL from Docker Compose | Anonymous volume for data dir gets orphaned on redeploy | Name all volumes explicitly; document backup procedure before any `docker compose down` |

---

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Loading entire workflow history to render current state | Slow step-view pages; high DB load | Store current state explicitly in a `current_state` column; events are append-only history, not the source of truth for queries | ~500 workflow instances with long histories |
| Sending emails synchronously in HTTP request | Approval submissions time out; duplicate sends on browser retry | Always enqueue email sends to a background job; return 202 Accepted immediately | First time an SMTP server has transient latency |
| Querying audit events without index on `(workflow_id, created_at)` | Audit trail page load grows with log volume | Add composite index from schema v1 | ~10,000 audit events total |
| Single-column JSON blob for workflow step configuration | Hard to query, migrate, or validate | Normalize step configuration into typed columns from the start | When you need to query "all workflows with step type X" |
| No pagination on workflow list views | Admin dashboard OOM or 30s+ load | Add cursor-based pagination from the first list endpoint | ~1,000 workflow instances |

---

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Token scope not bound to specific workflow step and action | Approver of step 2 can approve step 3 using the same token | Embed `step_id` + `expected_action` in token payload or as separate DB fields; validate both on use |
| Approval action accessible without any authentication layer | Anyone who guesses a token URL can approve documents | Require tokens to match a specific workflow instance, step, and approver identity (email) — reject if the clicking user's email doesn't match the token's assigned approver |
| Audit log accessible to all authenticated users | Sensitive business decisions exposed to unauthorized staff | Enforce RBAC on audit log reads; separate read permissions from write permissions |
| Workflow configuration stored in code, not DB | Workflow template changes require code deployment; no tenant customization | Store workflow templates in DB; validate against schema on save |
| No rate limiting on email approval endpoints | Brute-force token enumeration via approval endpoint | Rate limit approval endpoints by IP and by workflow instance; log all invalid token attempts |
| Storing document content in workflow engine DB | Scope creep; security review complexity; GDPR complications with audit data | Workflow engine stores only document metadata (ID, title, type); actual content lives in a separate document store |

---

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Approver clicks email link after token expired with no recovery path | Frustration; contact support; workflow stalls | Show clear "this link has expired — request a new one" page with a single-click re-send option for the workflow initiator |
| Approval email contains no document summary | Approver must log in to see what they're approving; email-first workflow defeated | Include document title, initiator, key metadata, and a secure preview link in every approval email |
| Refusal sends workflow back to step 1 with no explanation shown to initiator | Initiator doesn't know what to fix | Require refusal reason (free text, minimum 10 characters); display prominently in the initiator's dashboard and re-notification email |
| No "already actioned" page for duplicate token use | Confusing 404 or generic error | Show "You already approved this document on [date]. Current status: [state]" — reassuring, not alarming |
| Workflow status only visible to admin | Regular users don't know if their submission is stuck | Provide a per-submission status page accessible to the initiator with timeline visualization |
| French locale only covers UI; emails remain in English | French public admin users receive English administrative communications | All email templates must have FR variants; locale selection must be stored per user and applied to outgoing emails |

---

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Email approval flow:** Token expiry, single-use enforcement, and scope validation all implemented — not just "token exists in DB"
- [ ] **Audit trail:** DB-level INSERT-only enforcement tested (attempt an UPDATE — it must fail at DB layer, not just application layer)
- [ ] **Quorum logic:** Concurrent request test run against the same step — no duplicate transitions, no duplicate emails
- [ ] **i18n:** Every user-facing string renders correctly in FR locale, including email subjects, bodies, error messages, and validation failures
- [ ] **Deadline timers:** App crash + restart test confirms pending deadlines fire correctly after restart, not re-fired if already fired
- [ ] **Email deliverability:** SPF, DKIM, DMARC records configured; test send from production domain passes mail-tester.com ≥9/10
- [ ] **Refusal flow:** Refusal reason is stored in audit log, visible to initiator, and workflow returns to correct prior step (not always step 1)
- [ ] **Docker Compose:** `docker compose down && docker compose up` retains all data; no anonymous volumes that silently reset DB
- [ ] **Token security:** Attempted replay of used token returns "already actioned" response, not a 500 or a duplicate action
- [ ] **French public admin compliance:** Workflow produces an exportable audit trail suitable for legal evidence (timestamped, signed, tamper-detectable)

---

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Non-atomic state + email | HIGH | Audit which state transitions lack corresponding email sends; replay from event log; add compensating events; rebuild outbox infrastructure before next release |
| Token security gap discovered in production | HIGH | Immediately expire all outstanding tokens; force re-notification; patch token generation; communicate to affected users; assess whether any invalid approvals were made |
| Mutable audit trail discovered | HIGH | Depending on regulatory context: legal review required; rebuild immutable log from source data if available; implement hash-chain going forward |
| Duplicate quorum transitions | MEDIUM | Identify duplicate transitions via audit log (two `step.completed` events for same step); add compensating "duplicate-voided" events; fix DB constraint; patch affected workflows manually |
| Missing i18n strings in production | LOW | Add missing keys to FR locale file; redeploy; no data migration needed |
| Lost deadline timers after restart | MEDIUM | Query for workflows in pending state past their deadline; manually trigger escalations; implement persistent timer table going forward |
| Emails in spam due to missing SPF/DKIM | MEDIUM | Add DNS records immediately; request users check spam folders; consider resending critical missed notifications; no code change required |

---

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Non-atomic state transitions | Phase: Workflow engine core — state machine + outbox | Integration test: kill process mid-transition; verify no ghost audit events |
| Insecure email approval tokens | Phase: Email action channel implementation | Security test: replay attack, expired token, wrong-scope token all rejected |
| Mutable audit trail | Phase: Data model / schema design (Phase 0) | DB test: attempt UPDATE on audit table as app user — must fail |
| Quorum race condition | Phase: Parallel step / quorum engine | Concurrent load test: 10 simultaneous approval requests to same step |
| Hardcoded strings / i18n bypass | Phase: Project scaffold (before first feature) | CI lint rule: zero literal user-facing strings in non-i18n files |
| Deadline timer loss/duplication | Phase: Deadline/escalation subsystem | Chaos test: restart app while timer is pending; verify exactly-once firing |
| Email deliverability | Phase: Infrastructure / deployment | Pre-launch: mail-tester.com score ≥9, confirm SPF/DKIM/DMARC all pass |
| Docker Compose data loss | Phase: Docker Compose deployment spec | Test: full down+up cycle retains all DB data and audit log |
| Contributor bus factor | Phase: Open source foundation (CONTRIBUTING.md, architecture docs) | Metric: at least 2 contributors able to review and merge a PR independently |
| eIDAS / French admin compliance | Phase: Compliance hardening (pre-v1 public sector release) | Checklist: audit export passes legal review; timestamps are ISO 8601 UTC |

---

## Sources

- [OWASP CSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html) — token security, replay prevention (HIGH confidence)
- [AWS Step Functions Quorum Pattern](https://github.com/aws-samples/step-functions-workflows-collection/tree/main/quorum-with-parallel-pattern) — quorum with parallel state gotchas (MEDIUM confidence)
- [Immutable Audit Trail Best Practices — HubiFi](https://www.hubifi.com/blog/immutable-audit-log-basics) — audit log integrity (MEDIUM confidence)
- [Audit Trail Best Practices 2026 — OpsHub Signal](https://signal.opshub.me/audit-trail-best-practices/) — timestamp, access control, centralization requirements (MEDIUM confidence)
- [Stop Misusing Docker Compose in Production — dFlow](https://dflow.sh/blog/stop-misusing-docker-compose-in-production-what-most-teams-get-wrong) — Docker Compose single-host limitations (MEDIUM confidence)
- [Common i18n Mistakes — shipglobal.dev](https://www.shipglobal.dev/en/guides/common-i18n-mistakes) — pluralization, date formatting, string concatenation pitfalls (MEDIUM confidence)
- [Email Deliverability 2026 — Mailtrap](https://mailtrap.io/blog/how-to-improve-email-deliverability/) — SPF/DKIM/DMARC enforcement (HIGH confidence — multiple official sources confirm 2025 enforcement)
- [Google DMARC Enforcement — Proofpoint](https://www.proofpoint.com/us/blog/email-and-cloud-threats/clock-ticking-stricter-email-authentication-enforcements-google-start) — Google November 2025 enforcement timeline (HIGH confidence)
- [Workflow Engine vs State Machine — workflowengine.io](https://workflowengine.io/blog/workflow-engine-vs-state-machine/) — state machine parallel execution constraints (MEDIUM confidence)
- [Database-Backed Workflow QCon Talk — InfoQ](https://www.infoq.com/news/2025/11/database-backed-workflow/) — outbox pattern, atomic state+queue writes (MEDIUM confidence)
- [Open Source Maintainer Burnout — RoamingPigs](https://roamingpigs.com/field-manual/open-source-maintainer-burnout/) — bus factor risks for OSS projects (MEDIUM confidence)
- [eIDAS 2.0 Changes for QES 2025-2026](https://www.qualified-electronic-signature.com/eidas-2-0-changes-qes-2025-2026/) — French public admin compliance timeline (MEDIUM confidence)
- [MicroFocus Email Approval Token Troubleshooting](https://www.microfocus.com/documentation/identity-governance-and-administration/igaas/workflow-admin-console/troubleshooting_email_based_approval.html) — email token failure modes in production systems (MEDIUM confidence)

---
*Pitfalls research for: Document validation workflow platform (Validly)*
*Researched: 2026-02-19*
