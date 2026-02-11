# Deployment (Vercel)

This repo is a pnpm monorepo with two Next.js apps:

- `apps/public` (public site + ingestion endpoint)
- `apps/admin` (moderation UI)

## Recommended setup

Create **two** Vercel projects connected to the same GitHub repo:

### 1) Public app

- Root Directory: `apps/public`
- Install Command: `pnpm install`
- Build Command: `pnpm --filter @nulldiary/public build`
- Output: Next.js default

### 2) Admin app

- Root Directory: `apps/admin`
- Install Command: `pnpm install`
- Build Command: `pnpm --filter @nulldiary/admin build`

## Environment variables

Set these (per project as appropriate):

- `DATABASE_URL` (Postgres connection string)

Admin auth (admin project):

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

Optional (local/dev only):

- `SUPABASE_AUTH_BYPASS=true`

## Domains

- Public: `nulldiary.io`
- Admin: `admin.nulldiary.io`

## Notes

- PR previews should be enabled for both projects.
- If you want a single PR comment that includes both preview URLs, add a GitHub Action that posts a comment linking both Vercel preview URLs.
