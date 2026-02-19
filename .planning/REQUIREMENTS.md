# Requirements: Validly v1.1 UX Polish

**Defined:** 2026-02-20
**Core Value:** Any validator can approve or refuse a document directly from their email, without ever logging into the platform — making validation as frictionless as possible while maintaining a complete audit trail.

## v1.1 Requirements

Requirements for v1.1 UX Polish milestone. Each maps to roadmap phases.

### Authentication & Security

- [ ] **AUTH-01**: User can request a password reset link by entering their email on a "Forgot password?" page
- [ ] **AUTH-02**: User receives a password reset email with a secure single-use token link (1h expiry)
- [ ] **AUTH-03**: User can set a new password via the reset link, with all existing sessions invalidated
- [ ] **AUTH-04**: Password reset endpoint prevents user enumeration (same response regardless of email existence)
- [ ] **AUTH-05**: Password reset token consumption is atomic (TOCTOU-safe)
- [x] **AUTH-06**: `apiFetch` only sets `Content-Type: application/json` when body is non-null (fix recurring Fastify empty-body bug)

### User Profile & Settings

- [ ] **PROF-01**: User can view and edit their display name from a profile page
- [ ] **PROF-02**: User can change their password (requires current password verification) from the profile page
- [ ] **PROF-03**: User can switch language (EN/FR) from the profile page, persisted to database
- [ ] **PROF-04**: Profile page accessible from navigation on all authenticated pages

### Document Preview

- [ ] **DOCX-01**: DOCX files render in-browser via client-side conversion (no download required)
- [ ] **DOCX-02**: DOCX preview HTML is sanitized through DOMPurify before rendering (XSS prevention)
- [ ] **DOCX-03**: DOCX conversion library is loaded via dynamic import (not in main bundle)

### Notifications

- [ ] **NOTIF-01**: Bell icon in navigation bar shows unread notification count badge
- [ ] **NOTIF-02**: Clicking bell opens a notification panel listing recent notifications with workflow links
- [ ] **NOTIF-03**: User can mark notifications as read (individually and bulk "mark all read")
- [ ] **NOTIF-04**: Notifications created for workflow events: step approved, step refused, workflow completed, workflow refused
- [ ] **NOTIF-05**: Notifications created when a comment is added to a workflow the user participates in
- [ ] **NOTIF-06**: Notification list polls via REST every 30 seconds (no WebSocket)
- [ ] **NOTIF-07**: User can configure per-type notification preferences (enable/disable) on the profile page

### Workflow Comments

- [ ] **COMM-01**: Authenticated users can post plain-text comments on workflow detail pages
- [ ] **COMM-02**: Comments displayed as a chronological thread below the workflow stepper
- [ ] **COMM-03**: Comments are append-only (no edit, no delete) — consistent with audit trail philosophy
- [ ] **COMM-04**: Comment input disabled on terminal-state workflows (approved, refused, cancelled, archived)
- [ ] **COMM-05**: Access restricted to workflow initiator and registered validators

### Error Handling & Form Validation

- [ ] **ERR-01**: Dedicated 404 Not Found page with navigation back to dashboard
- [ ] **ERR-02**: Dedicated 500 Server Error page with recovery guidance
- [ ] **ERR-03**: React Router error boundary catches unhandled navigation errors
- [ ] **ERR-04**: All forms use Zod schema validation with inline per-field error messages
- [ ] **ERR-05**: Form validation applied to existing forms (login, signup) and all new v1.1 forms
- [ ] **ERR-06**: API error responses mapped to user-readable messages

### Responsive Layout

- [ ] **RESP-01**: ActionConfirmPage (email action link target) fully usable on mobile (375px+)
- [ ] **RESP-02**: Login and signup pages fully usable on mobile
- [ ] **RESP-03**: Dashboard list views readable and navigable on mobile
- [ ] **RESP-04**: Workflow detail page (stepper, comments, actions) usable on mobile
- [ ] **RESP-05**: Touch targets minimum 44x44px on all interactive elements
- [ ] **RESP-06**: Mobile-friendly navigation (hamburger menu or equivalent)

### Internationalization

- [ ] **I18N-01**: All new v1.1 UI surfaces have complete FR and EN translations
- [ ] **I18N-02**: All new v1.1 email templates (password reset) have FR and EN versions

## v2+ Requirements

Deferred to future releases. Tracked but not in current roadmap.

### Security

- **SEC-01**: Two-factor authentication (TOTP) for admin accounts
- **SEC-02**: SSO/SAML/OpenID Connect integration

### Communication

- **COM-01**: Rich text comments (markdown formatting)
- **COM-02**: @mentions in comment threads with notification routing
- **COM-03**: Email digest / batched notification summary

### UX

- **UX-01**: Avatar / profile photo uploads
- **UX-02**: Browser push notifications (service worker)
- **UX-03**: WebSocket real-time notification delivery
- **UX-04**: File type icons in document lists
- **UX-05**: Drag-and-drop visual workflow editor

## Out of Scope

| Feature | Reason |
|---------|--------|
| Rich text comments | XSS complexity, mobile keyboard friction — plain text with newlines sufficient for v1.1 |
| @mentions in threads | Typeahead + notification routing complexity not justified |
| WebSocket/SSE notifications | Async workflow timescales make 30s polling adequate |
| Email digest | Scheduled job complexity; per-type opt-out is better UX |
| 2FA | Separate security hardening milestone |
| Avatar uploads | Image resize pipeline disproportionate for internal tool; initials sufficient |
| Browser push | Service worker + VAPID overhead not warranted |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 13 | Pending |
| AUTH-02 | Phase 13 | Pending |
| AUTH-03 | Phase 13 | Pending |
| AUTH-04 | Phase 13 | Pending |
| AUTH-05 | Phase 13 | Pending |
| AUTH-06 | Phase 13 | Complete |
| PROF-01 | Phase 13 | Pending |
| PROF-02 | Phase 13 | Pending |
| PROF-03 | Phase 13 | Pending |
| PROF-04 | Phase 13 | Pending |
| DOCX-01 | Phase 13 | Pending |
| DOCX-02 | Phase 13 | Pending |
| DOCX-03 | Phase 13 | Pending |
| ERR-01 | Phase 13 | Pending |
| ERR-02 | Phase 13 | Pending |
| ERR-03 | Phase 13 | Pending |
| ERR-04 | Phase 13 | Pending |
| ERR-05 | Phase 13 | Pending |
| ERR-06 | Phase 13 | Pending |
| RESP-01 | Phase 13 | Pending |
| RESP-02 | Phase 13 | Pending |
| COMM-01 | Phase 14 | Pending |
| COMM-02 | Phase 14 | Pending |
| COMM-03 | Phase 14 | Pending |
| COMM-04 | Phase 14 | Pending |
| COMM-05 | Phase 14 | Pending |
| NOTIF-01 | Phase 14 | Pending |
| NOTIF-02 | Phase 14 | Pending |
| NOTIF-03 | Phase 14 | Pending |
| NOTIF-04 | Phase 14 | Pending |
| NOTIF-05 | Phase 14 | Pending |
| NOTIF-06 | Phase 14 | Pending |
| NOTIF-07 | Phase 14 | Pending |
| RESP-03 | Phase 15 | Pending |
| RESP-04 | Phase 15 | Pending |
| RESP-05 | Phase 15 | Pending |
| RESP-06 | Phase 15 | Pending |
| I18N-01 | Phase 15 | Pending |
| I18N-02 | Phase 15 | Pending |

**Coverage:**
- v1.1 requirements: 39 total
- Mapped to phases: 39/39
- Unmapped: 0

---
*Requirements defined: 2026-02-20*
*Last updated: 2026-02-20 — traceability filled after roadmap creation*
