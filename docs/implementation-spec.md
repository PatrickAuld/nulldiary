# Implementation Specification

This document expands the system plan into detailed, actionable implementation steps for the ingestion pipeline, moderation interface, and public static site.

## 0) Goals & Non-Goals

### Goals
- Accept inbound messages from AI/agent clients via a flexible HTTP endpoint that supports every verb and can receive content from path, query, headers, or body.
- Persist raw ingestion data and normalized messages in Postgres.
- Provide a human moderation UI with filtering and review workflows.
- Build a public static site from approved messages.

### Non-Goals (initial release)
- Real-time streaming or websockets.
- Agent authentication beyond basic API key/IP filtering (can be added later).
- Complex ranking or personalization.

## 1) Repository Layout & Tooling

### 1.1 Monorepo Structure
- `apps/admin` — Admin moderation UI (Next.js + TypeScript + Astro).
- `apps/public` — Public static site (Next.js + TypeScript + Astro).
- `packages/db` — Postgres schema, migrations, and DB client.
- `packages/shared` — Shared types, validation schemas, and parsing utilities.
- `packages/ingestion` — Ingestion service logic and parsers.

### 1.2 Build & Runtime
- Use a workspace manager (pnpm or yarn workspaces) for shared dependency resolution.
- Centralized TS config (`tsconfig.base.json`).
- Linting/formatting: eslint + prettier shared configs.

### 1.3 Deployment Targets
- Admin app on its own domain.
- Public app on its own domain.
- Ingestion endpoint hosted under admin app or a dedicated API deployment (recommended: separate API route namespace or standalone service).

## 2) Database Design (Postgres)

### 2.1 Schema Overview

#### `ingestion_events`
Stores raw inbound request details.
- `id` (UUIDv7, PK)
- `received_at` (timestamp with time zone, default now())
- `method` (text)
- `path` (text)
- `query` (jsonb)
- `headers` (jsonb)
- `body` (text)
- `source_ip` (inet)
- `user_agent` (text)
- `raw_payload` (jsonb) — optional combined representation
- `parsed_message` (text)
- `parse_status` (enum: `success`, `partial`, `failed`)
- `message_id` (UUIDv7, FK -> messages.id, nullable)

#### `messages`
Stores normalized messages for moderation.
- `id` (UUIDv7, PK)
- `content` (text)
- `metadata` (jsonb)
- `created_at` (timestamp with time zone)
- `approved_at` (timestamp with time zone, nullable)
- `denied_at` (timestamp with time zone, nullable)
- `moderation_status` (enum: `pending`, `approved`, `denied`)
- `moderated_by` (text, nullable)
- `tags` (text[])

#### `moderation_actions`
Audit trail for approvals/denials.
- `id` (UUIDv7, PK)
- `message_id` (UUIDv7, FK -> messages.id)
- `action` (enum: `approved`, `denied`)
- `actor` (text)
- `reason` (text, nullable)
- `created_at` (timestamp with time zone)

### 2.2 Indexes
- `ingestion_events(received_at)` for ingestion audit queries.
- `messages(moderation_status, created_at)` for moderation list performance.
- Full-text index on `messages.content` for search.

### 2.3 Migration Strategy
- Use a migration tool (Prisma migrations or Drizzle migrations).
- Versioned migrations in `packages/db/migrations`.
- Local dev uses dockerized Postgres.
- Configure UUIDv7 generation for primary keys (application-side or database extension).

### 2.4 UUIDv7 Generation Options
Choose one of the following approaches and standardize it across services:
- **Application-side**: Generate UUIDv7 in the app layer (e.g., with a UUIDv7 library) and pass it into insert statements.
- **Database-side**: Use a Postgres extension or function that supports UUIDv7 generation, and set column defaults accordingly.

## 3) Ingestion Pipeline

### 3.1 Endpoint Design
- **Endpoint**: `/s/*` route.
- **Methods**: Accept all HTTP verbs.
- **Payload sources**:
  - Path: `/s/<message>`
  - Query: `/s?message=...`
  - Headers: `x-message`, `x-secret`, or `x-prompt`.
  - Body: JSON, text/plain, or form-encoded.

### 3.2 Parsing & Normalization
Implement a deterministic priority order for extraction:
1. Explicit header keys (`x-message`, `x-secret`, `x-prompt`).
2. Body JSON fields (`message`, `secret`, `prompt`).
3. Query parameter `message` or `secret`.
4. Path segment after `/s/`.

### 3.3 Ingestion Flow
1. Accept request, capture method/path/query/headers/body.
2. Parse message from request sources.
3. Insert into `ingestion_events` with raw payload and parse status.
4. If parsing succeeded, insert into `messages` with `pending` status.
5. Update `ingestion_events.message_id` to relate record.

### 3.4 Abuse Controls
- IP rate limiting (e.g., 10 req/sec per IP).
- Payload size limits (e.g., 64 KB).
- Optional API key support via header (future).

## 4) Admin Moderation UI

### 4.1 Authentication
- Basic admin authentication (NextAuth or custom auth).
- Restrict to internal/team accounts.

### 4.2 List View
- Default filter: `pending` messages.
- Filters:
  - Status: pending/approved/denied.
  - Date range.
  - Keyword search.
- Sort: newest first.

### 4.3 Detail View
- Display parsed message content.
- Show raw ingestion event:
  - path, query, headers, body.
- Action buttons: Approve / Deny with optional reason.

### 4.4 Actions & API
- `POST /api/moderation/approve`: updates `messages` + creates `moderation_actions`.
- `POST /api/moderation/deny`: updates `messages` + creates `moderation_actions`.
- `GET /api/messages`: list with filters.
- `GET /api/ingestion-events`: raw events filtered by message ID.

## 5) Public Static Site

### 5.1 Content Generation
- Fetch approved messages from DB during build.
- Generate:
  - Index page (paginated or infinite list).
  - Detail pages (optional per message).

### 5.2 Filtering
- Client-side filtering for tags or search.
- Optional pre-generated pages for tag views.

### 5.3 CI/CD
- Build triggered on:
  - New approval event (webhook).
  - Or scheduled nightly rebuild.
- Publish static assets to CDN or static hosting.

## 6) Shared Types & Validation

### 6.1 Shared Schemas
- Zod schemas for:
  - Incoming ingestion payload.
  - Moderation actions.
  - Message records.

### 6.2 API Contracts
- Shared type definitions in `packages/shared`.
- API responses strictly typed.

## 7) Observability & Logging

### 7.1 Logging
- Request logs for ingestion endpoint.
- Moderation action logs.

### 7.2 Metrics (Optional)
- Ingestion rate, approval rate, denial rate.
- Median approval latency.

## 8) Security Considerations

- Sanitize and encode messages before displaying in UI or public site.
- Escape HTML in public rendering.
- Optional secret redaction for headers.

## 9) Step-by-Step Implementation Checklist

1. **Repo scaffolding**
   - Create monorepo structure and package manager config.
   - Add shared lint/format configs.

## 10) TODOs & Checkpoints

Use this as an iterative tracker for implementation progress. Each checkpoint should be completed before the next begins.

### Checkpoint 1: Repo scaffolding
- [x] Decide on workspace manager (pnpm preferred) and add workspace config.
- [x] Add base `package.json`, `tsconfig.base.json`, and root `.gitignore`.
- [x] Create initial app/package directories (`apps/admin`, `apps/public`, `packages/db`, `packages/shared`, `packages/ingestion`).

### Checkpoint 2: Database
- [ ] Choose migration tool (Prisma or Drizzle).
- [ ] Define schema with UUIDv7 PKs.
- [ ] Add migrations and local dev Docker Compose.

### Checkpoint 3: Ingestion pipeline
- [ ] Implement `/s/*` endpoint accepting all verbs.
- [ ] Build parsing priority and validation logic.
- [ ] Persist raw events and pending messages.

### Checkpoint 4: Admin moderation UI
- [ ] Scaffold admin app pages.
- [ ] Implement list/detail views with filters.
- [ ] Add approve/deny actions with audit trail.

### Checkpoint 5: Public static site
- [ ] Scaffold public app pages.
- [ ] Implement static generation from approved messages.
- [ ] Add basic search/filter UI.

### Checkpoint 6: CI/CD
- [ ] Add build pipeline for public site.
- [ ] Trigger builds on approvals or schedule.

### Checkpoint 7: Security & hardening
- [ ] Rate limiting and payload limits.
- [ ] Sanitize and encode message rendering.
- [ ] Add audit logging to moderation actions.
