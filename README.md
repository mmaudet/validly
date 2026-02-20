<p align="center">
  <img src="frontend/public/logo.png" alt="Validly" width="140" />
</p>

<h1 align="center">Validly</h1>

<p align="center">
  <em>Make your document validation easy</em>
</p>

<p align="center">
  <a href="https://github.com/mmaudet/validly/blob/master/LICENSE"><img src="https://img.shields.io/badge/License-AGPL%20v3-blue.svg" alt="License: AGPL v3" /></a>
  <img src="https://img.shields.io/badge/Node.js-%3E%3D22-339933?logo=node.js&logoColor=white" alt="Node.js >= 22" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black" alt="React 19" />
  <img src="https://img.shields.io/badge/Fastify-5-000000?logo=fastify&logoColor=white" alt="Fastify 5" />
  <img src="https://img.shields.io/badge/PostgreSQL-15-4169E1?logo=postgresql&logoColor=white" alt="PostgreSQL 15" />
  <img src="https://img.shields.io/badge/Redis-7-DC382D?logo=redis&logoColor=white" alt="Redis 7" />
  <img src="https://img.shields.io/badge/Prisma-6-2D3748?logo=prisma&logoColor=white" alt="Prisma 6" />
  <img src="https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white" alt="Docker Ready" />
</p>

<p align="center">
  <a href="#features">Features</a> &bull;
  <a href="#see-it-in-action">See it in Action</a> &bull;
  <a href="#getting-started">Getting Started</a> &bull;
  <a href="#tech-stack">Tech Stack</a> &bull;
  <a href="#api">API</a> &bull;
  <a href="#contributing">Contributing</a> &bull;
  <a href="#license">License</a>
</p>

---

## Overview

Validly is an open-source, self-hosted document validation workflow engine. It allows organizations to define structured approval circuits (phases and steps) with configurable quorum rules, assign validators via email, attach documents, and track decisions through a complete audit log.

## Features

- **Multi-phase approval circuits** — Sequential phases, each with multiple validation steps
- **Flexible execution modes** — Sequential or parallel step execution within a phase
- **Quorum rules** — Unanimity, majority, or any-of-N with configurable thresholds
- **Email notifications** — Action links sent to validators, with configurable deadline reminders
- **Document management** — Upload, attach, and preview documents (PDF viewer included)
- **Workflow templates** — Save and reuse circuit structures across workflows
- **Archiving** — Archive completed workflows to keep the dashboard clean
- **Audit trail** — Immutable event log for every action (with database triggers)
- **User management** — Admin panel for user CRUD and role assignment
- **Internationalization** — Full FR/EN support (backend emails + frontend UI)
- **Role-based access** — Admin, Initiateur (initiator), Validateur (validator)

## See it in Action

### Dashboard

The dashboard gives you a clear overview of all your validation workflows. Filter by status or date, switch between **My requests** (workflows you initiated), **To validate** (pending decisions assigned to you), and **Templates**. Admin users also get access to a **Users** management tab.

<p align="center">
  <img src="docs/screenshots/dashboard.png" alt="Dashboard — workflow list with filters" width="720" />
</p>

### Design your Validation Circuit

Creating a workflow is a guided 3-step process: attach documents, design your approval circuit, and review before launch.

The circuit builder is where the power lives. Each workflow is organized into **phases** that execute sequentially, and each phase contains one or more **steps** that can run in **sequential** or **parallel** mode. For every step, you configure:

- **Quorum rule** — Unanimity (all must approve), majority, or any-of-N with a custom threshold
- **Validator emails** — Invite internal or external reviewers by email; they receive action links directly in their inbox
- **Deadline** — Optional time limit (in hours) after which reminders are sent automatically

<p align="center">
  <img src="docs/screenshots/workflow-circuit.png" alt="Circuit builder — phase and step configuration" width="720" />
</p>

Recurring approval processes? Use **Load template** to pre-fill the circuit from a saved template, then adjust as needed. Templates store the full circuit structure (phases, steps, quorum rules, execution modes) so you never have to rebuild from scratch.

### Track Progress in Real Time

Once launched, each workflow displays its live progression: which phase is active, which steps are pending or completed, and who has yet to respond. Attached documents (PDF, DOCX, XLSX, images...) are available for preview and download directly from the detail page.

<p align="center">
  <img src="docs/screenshots/workflow-detail.png" alt="Workflow detail — progression, steps, and documents" width="720" />
</p>

Every action — approval, rejection, delegation, cancellation — is recorded in an **immutable audit trail**, backed by database triggers that guarantee traceability even in case of application-level bugs.

## Getting Started

### Prerequisites

- **Node.js** >= 22
- **Docker** and **Docker Compose** (for PostgreSQL, Redis, and optional services)

### Development Setup

1. **Clone the repository**

```bash
git clone git@github.com:mmaudet/validly.git
cd validly
```

2. **Install dependencies**

```bash
npm install
```

3. **Configure environment**

Create `backend/.env` from the example below:

```env
DATABASE_URL=postgresql://validly:validly_dev@localhost:5432/validly
REDIS_URL=redis://localhost:6379

JWT_SECRET=<generated-access-token-secret>
JWT_REFRESH_SECRET=<generated-refresh-token-secret>

# SMTP configuration
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_FROM=noreply@validly.local

# Application URLs
API_URL=http://localhost:3000
APP_URL=http://localhost:5173

# File storage
STORAGE_PATH=./storage
```

> **About JWT secrets** — Validly uses [JSON Web Tokens](https://jwt.io/introduction) for stateless authentication. When a user logs in, the server returns two signed tokens instead of creating a server-side session:
>
> - **`JWT_SECRET`** signs short-lived **access tokens** (~15 min). The frontend sends this token with every API request so the server can identify the caller without hitting the database.
> - **`JWT_REFRESH_SECRET`** signs long-lived **refresh tokens** (~7 days). When the access token expires, the frontend silently uses the refresh token to obtain a new one — no password prompt needed.
>
> Two separate secrets ensure that compromising one does not allow forging the other token type. Both must be **random** and **kept confidential**: anyone who knows a secret can forge valid tokens for any user.
>
> Generate each secret with:
> ```bash
> node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
> # or
> openssl rand -hex 64
> ```

4. **Start infrastructure services**

```bash
docker compose up -d postgres redis mailpit
```

This starts:
- **PostgreSQL** on port 5432
- **Redis** on port 6379
- **Mailpit** (email testing) — UI on port 8025, SMTP on port 1025

5. **Run database migrations**

```bash
npm run db:setup -w backend
```

6. **Start development servers**

```bash
npm run dev
```

This runs the backend (port 3000) and frontend (port 5173) concurrently.

7. **Open the app**

| Service | URL | Description |
|---------|-----|-------------|
| Frontend | http://localhost:5173 | Application UI |
| API docs | http://localhost:3000/docs | Swagger UI |
| Mailpit | http://localhost:8025 | Email testing inbox |

### Docker Compose (Production-like)

To run the full stack via Docker:

```bash
docker compose up -d
```

| Service | Port | Description |
|---------|------|-------------|
| frontend | 8080 | Nginx-served SPA |
| backend | 3000 | Fastify API |
| postgres | 5432 | PostgreSQL database |
| redis | 6379 | Redis (BullMQ queues) |
| mailpit | 8025 / 1025 | Email testing (UI / SMTP) |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Runtime** | Node.js >= 22 |
| **Backend** | Fastify 5, TypeScript, Zod validation |
| **ORM** | Prisma 6 |
| **Database** | PostgreSQL 15 |
| **Queue** | BullMQ 5 + Redis 7 |
| **Frontend** | React 19, Vite 6, TypeScript |
| **Styling** | Tailwind CSS v4 |
| **State** | TanStack Query 5 |
| **Forms** | react-hook-form 7 |
| **Routing** | react-router 7 |
| **i18n** | i18next (backend + frontend) |
| **Email** | Nodemailer (SMTP) |
| **API docs** | Swagger UI (@fastify/swagger) |

## Project Structure

```
validly/
├── backend/
│   ├── prisma/           # Schema & migrations
│   ├── src/
│   │   ├── api/routes/   # Fastify route handlers
│   │   ├── domain/       # Business logic (state machine, types)
│   │   ├── services/     # Core services (workflow, email, document, audit)
│   │   ├── jobs/         # BullMQ workers (deadline, reminder)
│   │   └── i18n/locales/ # Backend translations (en, fr)
│   └── Dockerfile
├── frontend/
│   ├── public/           # Static assets (logos)
│   ├── src/
│   │   ├── components/   # Reusable UI components
│   │   ├── pages/        # Route pages
│   │   ├── hooks/        # Custom React hooks
│   │   ├── lib/          # API client, utilities
│   │   └── i18n/locales/ # Frontend translations (en, fr)
│   └── Dockerfile
├── docker-compose.yml    # Full-stack deployment
└── package.json          # Monorepo root (npm workspaces)
```

## API

The API is documented via Swagger UI at `/docs` when the backend is running.

### Main Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/register` | Create account |
| POST | `/auth/login` | Login (JWT) |
| POST | `/auth/refresh` | Refresh token |
| GET | `/workflows` | List workflows |
| POST | `/workflows` | Create workflow |
| GET | `/workflows/:id` | Workflow detail |
| POST | `/workflows/:id/launch` | Launch workflow |
| PATCH | `/workflows/:id/cancel` | Cancel workflow |
| PATCH | `/workflows/:id/archive` | Archive workflow |
| PATCH | `/workflows/archive-bulk` | Bulk archive |
| POST | `/actions/execute` | Submit validation decision |
| GET | `/actions/info` | Token info (from email link) |
| GET/POST | `/documents` | Document CRUD |
| GET/POST/PUT/DELETE | `/templates` | Template CRUD |
| GET/POST/DELETE | `/users` | User management (admin) |
| GET | `/audit` | Audit log |

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start backend + frontend in dev mode |
| `npm run build` | Build both packages |
| `npm run lint` | Lint both packages |
| `npm run test` | Run all tests |
| `npm run db:migrate -w backend` | Run Prisma migrations |
| `npm run db:studio -w backend` | Open Prisma Studio |

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes
4. Push to the branch (`git push origin feature/my-feature`)
5. Open a Pull Request

## License

This project is licensed under the **GNU Affero General Public License v3.0** — see the [LICENSE](LICENSE) file for details.

```
SPDX-License-Identifier: AGPL-3.0-only
```
