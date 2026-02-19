# Validly

<p align="center">
  <img src="frontend/public/logo.png" alt="Validly" width="120" />
</p>

<p align="center">
  <strong>Open-source document validation workflow platform</strong>
</p>

<p align="center">
  Multi-phase, multi-step approval circuits with email notifications, quorum rules, and full audit trail.
</p>

---

## Overview

Validly is a self-hosted validation workflow engine. It allows organizations to define structured approval circuits (phases and steps) with configurable quorum rules (unanimity, majority, any-of), assign validators via email, attach documents, and track decisions through a complete audit log.

### Key Features

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

## Getting Started

### Prerequisites

- **Node.js** >= 22
- **Docker** and **Docker Compose** (for PostgreSQL, Redis, and optional services)

### Development Setup

1. **Clone the repository**

```bash
git clone <repository-url>
cd validly
```

2. **Install dependencies**

```bash
npm install
```

3. **Configure environment**

Create `backend/.env` from the example values:

```env
DATABASE_URL=postgresql://validly:validly_dev@localhost:5432/validly
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret-key
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_FROM=noreply@validly.local
API_URL=http://localhost:3000
APP_URL=http://localhost:5173
STORAGE_PATH=./storage
```

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

- Frontend: http://localhost:5173
- API docs (Swagger): http://localhost:3000/docs
- Mailpit (email preview): http://localhost:8025

### Docker Compose (Production-like)

To run the full stack via Docker:

```bash
docker compose up -d
```

Services:
| Service | Port | Description |
|---------|------|-------------|
| frontend | 8080 | Nginx-served SPA |
| backend | 3000 | Fastify API |
| postgres | 5432 | PostgreSQL database |
| redis | 6379 | Redis (BullMQ queues) |
| mailpit | 8025 / 1025 | Email testing (UI / SMTP) |

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

This project is not yet licensed. A license will be added soon.
