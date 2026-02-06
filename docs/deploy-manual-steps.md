# Deployment Manual Steps

These steps must be completed manually after the code changes are pushed. They configure the hosted services that the CI/CD pipelines depend on.

## 1. Supabase

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard) and create a new project.
2. Open the **SQL Editor** and run the contents of `packages/db/migrations/0000_initial.sql` to create the schema.
3. Copy the connection string:
   - Go to **Settings > Database > Connection string**
   - Select **Transaction pooler** (port `6543`)
   - The URL will look like: `postgres://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres`

## 2. GitHub Secrets

Go to your repo's **Settings > Secrets and variables > Actions** and add these three secrets:

| Secret | Value |
|--------|-------|
| `DATABASE_URL` | Supabase connection string from step 1 (port 6543) |
| `CLOUDFLARE_API_TOKEN` | From [dash.cloudflare.com/profile/api-tokens](https://dash.cloudflare.com/profile/api-tokens) — needs **Cloudflare Pages: Edit** permission |
| `CLOUDFLARE_ACCOUNT_ID` | From the Cloudflare dashboard overview page |

## 3. Cloudflare Pages Projects

1. Go to [dash.cloudflare.com](https://dash.cloudflare.com) and create two Pages projects:
   - **`nulldiary-public`**
   - **`nulldiary-admin`**
2. For each project, go to **Settings > Environment variables** and add:
   - `DATABASE_URL` = the Supabase connection string from step 1
   - `NEXT_PUBLIC_SUPABASE_URL` = Supabase project URL (e.g. `https://[project-ref].supabase.co`)
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = Supabase anon public key
   - `SUPABASE_SERVICE_ROLE_KEY` = Supabase service role key (server-only; only needed for privileged admin-role checks)

## 4. DNS (Cloudflare)

Add the following DNS records in your Cloudflare zone for `nulldiary.com`:

| Type | Name | Target |
|------|------|--------|
| CNAME | `@` | `nulldiary-public.pages.dev` |
| CNAME | `admin` | `nulldiary-admin.pages.dev` |

Then add custom domains in each Pages project:

- `nulldiary-public`: add custom domain `nulldiary.com`
- `nulldiary-admin`: add custom domain `admin.nulldiary.com`

## 5. Push and Verify

1. Push to `main`:
   ```bash
   git push origin main
   ```
2. Check that the **CI** workflow passes in the Actions tab.
3. Check that **Deploy Public** and **Deploy Admin** workflows complete successfully.
4. Verify the public site:
   ```bash
   curl -X POST https://nulldiary.com/s/test -H "x-message: hello"
   ```
5. Verify the admin UI loads at `https://admin.nulldiary.com`.
