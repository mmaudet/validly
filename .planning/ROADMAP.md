# Roadmap: Validly

## Milestones

- **v1.0 MVP** — Phases 1-12 (shipped 2026-02-20) — [Archive](milestones/v1.0-ROADMAP.md)
- **v1.1 UX Polish** — Phases 13-15 (in progress)

## Phases

<details>
<summary>v1.0 MVP (Phases 1-12) — SHIPPED 2026-02-20</summary>

- [x] Phase 1: Foundation — 2026-02-19
- [x] Phase 2: Data Model + Auth — 2026-02-19
- [x] Phase 3: Document Upload + Preview — 2026-02-19
- [x] Phase 4: Workflow Engine — 2026-02-19
- [x] Phase 5: Email Action Channel — 2026-02-19
- [x] Phase 6: Dashboard + Audit — 2026-02-19
- [x] Phase 7: Workflow Templates — 2026-02-19
- [x] Phase 8: i18n Completion + Docker Polish — 2026-02-19
- [x] Phase 9: Workflow Creation UI (3 plans) — 2026-02-19
- [x] Phase 10: UX Improvements (5 plans) — 2026-02-19
- [x] Phase 11: Engine & Wiring Fixes (2 plans) — 2026-02-19
- [x] Phase 12: Template Management UI (2 plans) — 2026-02-20

</details>

### v1.1 UX Polish (In Progress)

**Milestone Goal:** Ship password reset, user profiles, in-app notifications, workflow comments, DOCX preview, mobile-responsive layout, and hardened error handling — making Validly comfortable for daily use.

- [x] **Phase 13: Foundation** — Schema migrations, apiFetch fix, password reset, user profile, DOCX preview, error pages, responsive critical paths (completed 2026-02-20)
- [x] **Phase 14: Social Features** — Workflow comments thread and in-app notification center (completed 2026-02-20)
- [ ] **Phase 15: Polish Completion** — Full responsive layout, i18n on all new surfaces

## Phase Details

### Phase 13: Foundation
**Goal**: Users can reset their password, manage their profile, preview DOCX files in-browser, and encounter proper error pages — with all infrastructure (schema, apiFetch fix) in place to support it
**Depends on**: Phase 12
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06, PROF-01, PROF-02, PROF-03, PROF-04, DOCX-01, DOCX-02, DOCX-03, ERR-01, ERR-02, ERR-03, ERR-04, ERR-05, ERR-06, RESP-01, RESP-02
**Success Criteria** (what must be TRUE):
  1. User can request a password reset email from the login page and set a new password via the link, with all existing sessions invalidated
  2. User can view and edit their display name, change their password, and switch UI language from a profile page reachable from all authenticated pages
  3. DOCX files open as rendered HTML in the browser without triggering a download, with no XSS risk
  4. Navigating to a non-existent route shows a 404 page with a dashboard link; server errors show a 500 page with recovery guidance
  5. All forms (login, signup, password reset, profile) show inline per-field validation errors before submission reaches the server
**Plans**: 6 plans

Plans:
- [ ] 13-01-PLAN.md — Infrastructure: Prisma migration (3 models), apiFetch fix, npm packages
- [ ] 13-02-PLAN.md — DOCX preview in DocumentPreview component
- [ ] 13-03-PLAN.md — Password reset full stack (backend service + email + frontend pages)
- [ ] 13-04-PLAN.md — User profile full stack (backend endpoints + ProfilePage + nav link)
- [ ] 13-05-PLAN.md — Error pages (404, 500) + error boundary + API error mapping
- [ ] 13-06-PLAN.md — Zod form validation on all forms + mobile responsive (login, signup, action)

### Phase 14: Social Features
**Goal**: Users can discuss workflows via a comment thread and receive in-app notifications for validation events they participate in
**Depends on**: Phase 13
**Requirements**: COMM-01, COMM-02, COMM-03, COMM-04, COMM-05, NOTIF-01, NOTIF-02, NOTIF-03, NOTIF-04, NOTIF-05, NOTIF-06, NOTIF-07
**Success Criteria** (what must be TRUE):
  1. User can post a plain-text comment on a workflow detail page; the comment appears in a chronological thread below the stepper and cannot be edited or deleted
  2. Comment input is visibly disabled on terminal-state workflows (approved, refused, cancelled, archived)
  3. Bell icon in the navigation bar shows an unread count badge that updates every 30 seconds without a page reload
  4. Clicking the bell opens a panel listing recent notifications with links to the relevant workflows; user can mark individual notifications or all as read
  5. User can enable or disable per-type notification categories from the profile page, and the system respects those preferences when creating notifications
**Plans**: 2 plans

Plans:
- [ ] 14-01-PLAN.md — Backend: Prisma models, comment & notification services, REST routes, workflow engine hooks
- [ ] 14-02-PLAN.md — Frontend: CommentThread, NotificationCenter panel, bell icon, notification preferences, i18n

### Phase 15: Polish Completion
**Goal**: All authenticated pages are fully usable on mobile devices (375px+) and all new v1.1 UI surfaces and email templates are translated in both English and French
**Depends on**: Phase 14
**Requirements**: RESP-03, RESP-04, RESP-05, RESP-06, I18N-01, I18N-02
**Success Criteria** (what must be TRUE):
  1. Dashboard list views and workflow detail pages (stepper, comments, actions) are readable and navigable on a 375px-wide screen
  2. Navigation collapses to a mobile-friendly menu (hamburger or equivalent) and all interactive elements meet the 44x44px minimum touch target
  3. All new v1.1 UI surfaces display correct translations in both English and French, with no missing keys
  4. Password reset email arrives with correct subject and body in the recipient's configured language
**Plans**: 3 plans

Plans:
- [ ] 15-01-PLAN.md — Mobile navigation + DashboardPage responsive layout
- [ ] 15-02-PLAN.md — WorkflowDetailPage + remaining pages responsive layout
- [ ] 15-03-PLAN.md — i18n completion for all v1.1 surfaces and email templates

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1-12 | v1.0 | — | Complete | 2026-02-20 |
| 13. Foundation | 6/6 | Complete   | 2026-02-20 | - |
| 14. Social Features | 2/2 | Complete   | 2026-02-20 | - |
| 15. Polish Completion | v1.1 | 0/3 | Planned | - |
