# Stack Research

**Domain:** Document validation workflow platform (open source, API-first)
**Researched:** 2026-02-19
**Confidence:** HIGH (core decisions verified against official docs and current release data)

---

## Recommended Stack

### Core Technologies — Backend

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Node.js | 22 LTS | Runtime | Active LTS until Oct 2025, maintenance until April 2027. Fastify v5 requires Node 20+. Required for native TypeScript strip-types support in Node 22.6+. |
| TypeScript | 5.8+ | Language | Current stable (5.8 released March 2025). Required by Fastify v5, Zod v4, Prisma 7. Compiler rewrite in Go coming but irrelevant for new projects. |
| Fastify | 5.7.x | HTTP framework | Current stable (5.7.4 as of Feb 2026). Built-in JSON Schema validation, OpenAPI plugin ecosystem, plugin architecture keeps code clean. 5-10% faster than v4. OpenJS Foundation project — durable for open source. NestJS considered but rejected (see Alternatives). |
| Prisma | 6.x (not 7) | ORM + migrations | Prisma 6.19.x is current stable recommended. Prisma 7 (Nov 2025) breaks significantly: requires driver adapters, ESM-only, removes middleware, breaks seeding. For a new v1 project, Prisma 6 gives the best migration DX (prisma migrate dev is gold-standard) with full PostgreSQL support, no architectural upheaval. Upgrade to 7 post-launch when the ecosystem stabilizes. |
| PostgreSQL | 15+ | Primary database | Specified constraint. Identity columns (not serial) per 2025 best practices. Append-only audit trail, JSONB for workflow state snapshots. |
| Zod | 4.x | Runtime validation | Stable as of July 2025. 14x faster parsing than v3. Use for request body validation before Fastify's JSON Schema layer, and for config validation. @fastify/swagger + Zod schemas bridge possible via zod-to-json-schema. |

### Core Technologies — Frontend

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| React | 19.2.x | UI framework | Current stable (19.2.4). Largest contributor base of any frontend framework — critical for open source project adoption. Shadcn/ui, TanStack Query, react-i18next all target React first. |
| Vite | 7.x | Build tool | Current stable (7.3.1). Standard for React SPAs in 2026. HMR in milliseconds. TypeScript out of the box. Docker build: compile once, serve statically. |
| Tailwind CSS | 4.x | Styling | v4 released 2025. Shadcn/ui has full v4 support since Feb 2025. Smaller bundle, faster builds than v3. PostCSS-free in v4. |
| shadcn/ui | current (CLI-driven) | Component library | 65k+ GitHub stars, adopted by Vercel and Supabase. Components are copied into your repo — zero runtime dependency, full ownership, contributors can modify directly. Not a package version but a CLI that installs components. |
| TanStack Query | 5.90.x | Server state / data fetching | Current stable (5.90.21 as of Feb 2026). Handles caching, background sync, optimistic updates. Ideal for "My pending actions" and "My submissions" views that poll for state changes. Replaces ad-hoc fetch + useState patterns. |

### Supporting Libraries — Backend

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @fastify/swagger | 9.x | OpenAPI 3.x spec generation | Register before routes. Auto-generates spec from JSON Schema route definitions. |
| @fastify/swagger-ui | 5.x | Swagger UI endpoint | Serves /documentation. Register after @fastify/swagger. |
| @fastify/jwt | 9.x | JWT auth middleware | Decorates request with jwtVerify, uses fast-jwt internally. Integrates cleanly with Fastify plugin lifecycle. |
| @fastify/multipart | 8.x | File upload handling | Streams multipart uploads. Use with storage abstraction layer (local disk → MinIO swap). |
| @fastify/cors | 9.x | CORS headers | Needed for React SPA on separate origin during dev. |
| @fastify/rate-limit | 9.x | Rate limiting email actions | Prevent token replay attacks on email action endpoints. |
| nodemailer | 6.x | SMTP email delivery | De-facto Node.js standard, 13M+ weekly downloads, TypeScript types built-in. Configurable SMTP transport matches self-hosted, sovereign deployment. |
| react-email | 3.x | HTML email templates | React components compiled to email-safe HTML. Works with nodemailer via render(). TypeScript-native. Avoids MJML's separate templating language. Previews in browser during dev. |
| BullMQ | 5.x | Background job queue | Current stable (5.69.3 as of Feb 2026). Email sends, deadline reminders, audit log writes must be async — never block HTTP response. Requires Redis. |
| Redis | 7.x | BullMQ backend | Use via Docker Compose. Redis 7 in Docker: sub-5ms latency, persistent AOF mode. |
| i18next | 24.x | Backend i18n (email, error messages) | Server-side translation for email templates and API error messages. i18next-fs-backend loads JSON files. Shared translation keys with frontend. |
| zod-to-json-schema | 3.x | Bridge Zod schemas to Fastify | Converts Zod v4 schemas to JSON Schema for Fastify route schema + OpenAPI generation. Single source of truth for validation + docs. |
| crypto (Node.js built-in) | — | Secure token generation | Use `crypto.randomBytes(32).toString('hex')` for email action tokens. No library needed — Node 22 built-in is sufficient. |
| pino | 9.x | Structured logging | Fastify's native logger. JSON output, minimal overhead. Use with pino-pretty for development. |

### Supporting Libraries — Frontend

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-i18next | 15.x | UI internationalization | Hooks-based, TypeScript type-safe translation keys. Shares translation JSON files with backend. |
| react-router | 7.x | Client-side routing | Data loaders in v7 reduce TanStack Query boilerplate for initial page loads. Standard SPA routing. |
| react-hook-form | 7.x | Form state management | Zero-dependency, performant forms. Use with Zod resolver (@hookform/resolvers/zod) for type-safe validation mirroring backend schemas. |
| @hookform/resolvers | 4.x | Zod adapter for react-hook-form | Connects Zod schemas to react-hook-form validation. |
| date-fns | 4.x | Date formatting | Lightweight, tree-shakable. Replaces moment.js. Format deadlines, timestamps in audit trail. |
| lucide-react | current | Icons | Default icon set for shadcn/ui. SVG icons, tree-shakable. |
| sonner | 1.x | Toast notifications | shadcn/ui's recommended replacement for the toast component as of 2025. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| tsx | TypeScript execution in dev | `tsx watch src/index.ts` for backend hot reload. Faster than ts-node. No compilation step during development. |
| vitest | Unit and integration testing | Vite-native test runner. Shares config with Vite frontend. Replaces Jest — no transform setup needed. |
| @playwright/test | E2E testing | Browser automation. Test email action flows end-to-end. |
| drizzle-kit (not used) | — | Not chosen — see Alternatives. |
| eslint + @typescript-eslint | Linting | Standard for TypeScript projects. Use flat config (eslint.config.ts) format for ESLint 9+. |
| prettier | Formatting | No debates on style. Integrate as eslint plugin. |
| docker compose | Local dev environment | Backend + PostgreSQL + Redis + MinIO all in one `docker compose up`. |
| openapi-typescript | OpenAPI → TS types | Generate TypeScript types from the auto-generated OpenAPI spec for frontend fetch calls. Eliminates duplicate type definitions. |

---

## Installation

```bash
# Backend — core
npm install fastify @fastify/swagger @fastify/swagger-ui @fastify/jwt @fastify/multipart @fastify/cors @fastify/rate-limit
npm install @prisma/client prisma
npm install nodemailer react-email @react-email/components
npm install bullmq
npm install zod zod-to-json-schema
npm install i18next i18next-fs-backend
npm install pino

# Backend — dev
npm install -D typescript tsx vitest @types/node @types/nodemailer
npm install -D eslint @typescript-eslint/eslint-plugin @typescript-eslint/parser prettier

# Frontend — core
npm create vite@latest frontend -- --template react-ts
npm install @tanstack/react-query
npm install react-router
npm install react-hook-form @hookform/resolvers
npm install react-i18next i18next i18next-http-backend
npm install date-fns lucide-react sonner
npx shadcn@latest init  # interactive setup for Tailwind v4 + shadcn/ui

# Frontend — dev
npm install -D @playwright/test vitest @testing-library/react openapi-typescript
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative Instead |
|-------------|-------------|----------------------------------|
| Fastify 5 | NestJS | NestJS makes sense if team size is 10+ and you want enforced module/DI structure. For a lean open-source project targeting contributors, NestJS decorator magic and Angular-style architecture raises the bar to contribute. Fastify's plugin system is simpler to explain. |
| Fastify 5 | Hono | Hono excels at edge/multi-runtime deployments. Validly is Node.js + Docker Compose — no edge deployment, so Hono's main advantage doesn't apply. Fastify has a larger plugin ecosystem (swagger, multipart, jwt). |
| Prisma 6 | Prisma 7 | Prisma 7 is the future but breaking changes (driver adapters required, ESM-only, removed middleware) make it risky for greenfield v1. Revisit after stable ecosystem catch-up (H2 2026). |
| Prisma 6 | Drizzle ORM | Drizzle is excellent for edge/serverless where bundle size matters. For a Docker Compose PostgreSQL project, Prisma's migration DX (`prisma migrate dev`) is superior — Drizzle migrations require manual SQL review. Prisma wins on team onboarding. |
| BullMQ + Redis | pg-boss | pg-boss uses PostgreSQL as the queue backend (no Redis dependency). Valid alternative for simpler deployments. Choose pg-boss if Redis in Docker Compose feels like too much overhead — it eliminates one service. BullMQ has better DX, monitoring, and retry logic. |
| react-email | MJML | MJML has its own template language (XML-like) — contributors need to learn it. react-email uses React + TypeScript that developers already know. MJML can be used as a compilation target by react-email internally. |
| Vite SPA | Next.js | Next.js adds SSR complexity for a dashboard app that requires authentication anyway. Vite SPA with TanStack Query for data fetching is simpler, faster to build, and easier to deploy (static files + API). |
| TanStack Query | SWR | SWR is a solid alternative. TanStack Query wins on feature depth (prefetching, optimistic updates, devtools) and shadcn/ui tutorials consistently use it. |
| React | Vue 3 | Vue 3 has excellent TypeScript support but half the contributor potential (4M vs 25M weekly npm downloads). For open-source contributor acquisition, React's larger community is the deciding factor. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Express.js | Maintained but stagnant. No built-in TypeScript, no schema validation, no OpenAPI generation out of the box. Plugin ecosystem requires manual assembly. Fastify solves all of these natively. | Fastify 5 |
| jsonwebtoken (direct) | Uses synchronous sign/verify which blocks the event loop. No longer maintained at the same pace. @fastify/jwt wraps fast-jwt (async, faster). | @fastify/jwt |
| TypeORM | Decorator-based, deeply coupled to class syntax. Migration tooling is unreliable — known data loss bugs. Large-scale TypeScript projects abandoned it for Prisma/Drizzle 2023-2024. | Prisma 6 |
| Sequelize | JavaScript-era ORM. TypeScript support bolted on, not native. Awkward for complex queries. | Prisma 6 |
| Moment.js | 67kb bundle, deprecated by its own maintainers. | date-fns 4 |
| Webpack | Slow cold starts, complex config for TypeScript. No reason to use over Vite 7 for a new project. | Vite 7 |
| Agenda / node-schedule | Agenda requires MongoDB. node-schedule is in-memory only (lost on restart). Neither has the retry/dead-letter queue semantics needed for email delivery reliability. | BullMQ 5 |
| Prisma 7 (for v1) | Driver adapters required, ESM-only module format, removed middleware, changed seeding — too many unknowns for a v1 launch. Ecosystem adapters (ioredis, etc.) need time to catch up. | Prisma 6 |
| Handlebars / EJS for emails | Static template strings without type safety. No component reuse. No browser preview. | react-email |
| axios (frontend) | Larger bundle than native fetch. TanStack Query uses fetch internally. No reason to add axios in 2026 for a new project. | native fetch + TanStack Query |

---

## Stack Patterns by Variant

**For local development:**
- `docker compose up` starts PostgreSQL 15, Redis 7, MinIO
- `tsx watch` runs backend with hot reload
- `vite dev` runs frontend with HMR
- `react-email` preview server shows email templates in browser

**For file storage (v1 → v2 migration path):**
- v1: `@fastify/multipart` streams to local disk. Abstraction: `StorageService` interface with `LocalDiskAdapter`.
- v2: Swap in `MinIOAdapter` implementing same `StorageService` interface. MinIO's S3-compatible API means `@aws-sdk/client-s3` works for both.
- No code changes to upload routes — only config.

**For workflow state machine:**
- Implement as pure TypeScript state machine (not XState). XState v5 adds 50kb+ and actor model complexity for what is a simple finite automaton (draft → in_review → approved/refused/cancelled).
- Store current state in PostgreSQL `workflow_instances.state` column (enum). Transitions are recorded in `audit_log` (append-only). PostgreSQL transactions guarantee atomicity of state transition + audit entry.

**For email action tokens:**
- Generate with `crypto.randomBytes(32).toString('hex')` → store hash in `email_tokens` table with `expires_at` and `used_at`.
- Token endpoint: verify token, mark used (single-use), execute workflow transition, redirect to web dashboard with confirmation.
- @fastify/rate-limit on token endpoint prevents brute force.

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| Fastify 5.7.x | Node.js 20+, 22 LTS | Node 18 dropped in Fastify v5 |
| Prisma 6.19.x | Node.js 18+, TypeScript 5.x | Prisma 7 is ESM-only — avoid for now |
| Zod 4.x | TypeScript 5.5+ | Zod 4 released July 2025, stable |
| React 19.2.x | Node.js 18+ (build), any browser | React 19 requires React DOM 19 — install together |
| Tailwind v4 | Vite 5+/7, React 18+ | PostCSS-free in v4; shadcn/ui supports since Feb 2025 |
| BullMQ 5.x | Redis 7.x, Node.js 18+ | Valkey and DragonflyDB also compatible |
| @fastify/swagger 9.x | Fastify 5.x | Must register before routes |
| react-email 3.x | React 18+/19 | Server-side render via render() from @react-email/components |
| react-router 7.x | React 19 | v7 introduced "framework mode" (like Next.js) — use library mode (SPA) not framework mode |

---

## Sources

- Fastify v5 official docs (fastify.dev) — version 5.7.x confirmed current stable, Node 20+ requirement
- Fastify v5 migration guide (fastify.dev/docs/v5.1.x/Guides/Migration-Guide-V5/) — breaking changes verified
- Prisma changelog (prisma.io/changelog) — Prisma 7.3.0 confirmed Jan 2026; Prisma 6.19.x is last v6 stable
- Prisma 7 upgrade guide (prisma.io/docs/orm/more/upgrade-guides) — driver adapter requirement confirmed HIGH confidence
- Zod official site (zod.dev) — v4 stable confirmed ("Zod 4 is now stable!")
- BullMQ npm (npmjs.com/package/bullmq) — version 5.69.3 confirmed Feb 2026
- React versions (react.dev/versions) — 19.2.4 current stable
- Vite releases (vite.dev/releases) — 7.3.1 current stable
- shadcn/ui changelog (ui.shadcn.com/docs/changelog) — Tailwind v4 + React 19 support confirmed Feb 2025
- TanStack Query npm — 5.90.21 current stable Feb 2026
- Node.js releases (nodejs.org) — Node 22 LTS active, recommended for production
- WebSearch (multiple sources) — Prisma vs Drizzle 2026 comparison, Fastify vs NestJS DX, React vs Vue contributor ecosystem
- WebSearch (multiple sources) — BullMQ vs pg-boss, react-email vs MJML, i18next current state

---
*Stack research for: Validly — open-source document validation workflow platform*
*Researched: 2026-02-19*
