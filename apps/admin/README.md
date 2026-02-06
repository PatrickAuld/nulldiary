# Admin App

Admin moderation interface built with Next.js.

## Authentication

The admin app uses Supabase Auth. Configure the following environment variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only; optional unless privileged server-side role checks are needed)

Protected routes are enforced in `src/middleware.ts`.
