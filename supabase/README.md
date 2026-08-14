# ORION database migrations

Ten migrations, applied in order, build the full schema: `users`, `conversations`,
`messages`, `memories` (pgvector), `tasks`, `agents` + `agent_runs`, `briefings`,
`automations` + `automation_runs`, `business_metrics`, `notifications`.

Every table has Row Level Security enabled, scoped to the signed-in Clerk user
via `requesting_clerk_user_id()` (reads the `sub` claim off the Supabase-verified
Clerk JWT). Server code with no signed-in user — automations, agent runs, webhooks
— should use the service-role client (`src/lib/supabase/service.ts`), which bypasses
RLS by design.

## One-time setup

1. Create a Supabase project at [app.supabase.com](https://app.supabase.com).
2. In the project: **Authentication → Sign In / Providers → Third Party Auth**,
   add **Clerk** and paste your Clerk instance's Frontend API URL. This is what
   lets Supabase verify Clerk session tokens and makes `requesting_clerk_user_id()`
   resolve correctly.
3. Copy the Project URL and `anon` / `service_role` keys into `.env.local`
   (see `.env.example`).

## Applying migrations

Using the [Supabase CLI](https://supabase.com/docs/guides/cli):

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

Or paste each file in `supabase/migrations/`, in numeric order, into the
Supabase Dashboard's SQL Editor.

## Local development

```bash
supabase start   # spins up Postgres + Studio in Docker
supabase db reset  # applies all migrations to the local instance
```
