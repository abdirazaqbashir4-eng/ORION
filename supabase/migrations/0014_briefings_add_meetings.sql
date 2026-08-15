-- Adds a meetings section to the daily briefing (Phase 14 — Fireflies.ai).
alter table briefings
  add column meetings_summary jsonb not null default '{}';
