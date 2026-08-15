-- ORION AI OS — schema bootstrap
-- Extensions and shared helpers used across every subsequent migration.

create extension if not exists "pgcrypto";   -- gen_random_uuid()
create extension if not exists "vector";     -- embeddings for long-term memory (Phase 6)
create extension if not exists "pg_trgm";    -- fuzzy text search

-- Every table with an `updated_at` column uses this trigger to keep it current.
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Resolves the Clerk user id ("sub" claim) from the request JWT.
-- ORION uses Clerk for auth (not Supabase Auth), wired up via Supabase's
-- third-party auth integration for Clerk: Project Settings -> Auth ->
-- Third Party Auth -> Clerk. Until that's configured, auth.jwt() is null
-- and every RLS policy below simply denies anonymous access — server
-- code should use the service-role client (lib/supabase/service.ts),
-- which bypasses RLS entirely, for any agent/automation/webhook path.
create or replace function requesting_clerk_user_id()
returns text
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claims', true)::json ->> 'sub', '');
$$;
