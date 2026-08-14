# ORION AI OS

> Your Intelligent Operating System.

A personal AI operating system for work, business, learning, automation, and daily life — inspired by JARVIS, built for 2026.

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 16 (App Router, Turbopack), React 19, TypeScript, Tailwind CSS v4, shadcn/ui |
| Backend | Next.js Route Handlers, Node.js |
| Database | PostgreSQL via Supabase (RLS scoped to Clerk sessions, pgvector for memory) |
| Auth | Clerk |
| AI | Claude API (Anthropic SDK) — chat, 5 specialized agents, tool use |
| Voice | Whisper (STT) + ElevenLabs (TTS), client-side VAD |
| Email | Gmail (OAuth, read/categorize/draft) |
| Browser automation | Playwright (desktop/Node only — see below) |
| Deployment | Vercel (web) + Electron (Windows desktop `.exe`) |
| Monitoring | Sentry |
| Analytics | PostHog |

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in whichever integrations you're ready to enable
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Visit `/system` to see live status of every integration — nothing crashes when a key is missing, the affected module just reports "Needs setup" until it's configured.

## Desktop app (.exe)

ORION ships as both a web app and a native Windows desktop app, from the same codebase — Electron just loads the same Next.js app in a native window.

```bash
npm run electron:dev    # hot-reloading desktop app for development
npm run electron:pack   # build a distributable .exe into /release (NSIS installer + portable)
```

`electron/main.js` starts the bundled Next.js "standalone" server in-process and points a `BrowserWindow` at it. Everything built for the web (auth, chat, database, memory, agents, email) works identically in the desktop build. Desktop-specific behavior: microphone permission handling for voice, external links (OAuth redirects) open in the OS browser instead of the app window, and a local timer drives the automation engine (see Deployment below) since there's no Vercel Cron on desktop. Playwright browser automation only really comes alive here — see the Browser automation note below.

For a packaged `.exe`, place secrets in a `.env` file next to the executable (or set real OS environment variables) — `.env.local` itself is dev-only and never bundled.

## Architecture

```
src/
  app/
    (dashboard)/            route group: sidebar + topbar shell
      page.tsx               Command Center (module overview + KPIs)
      chat/                   AI Chat + 5 agent personas       — Phase 5, 8
      briefing/               Daily Briefing                   — Phase 10
      business/               Business Command Center          — Phase 3
      email/                  Email Center (Gmail)              — Phase 9
      tasks/                  Task Center + Automations panel   — Phase 3, 10
      system/                 System Monitor (live integration status)
      settings/               Account settings + memory browser — Phase 2, 6
    api/
      chat/                   Streaming chat + tool-use loop
      agents/orchestrate/     Executive agent multi-agent orchestration
      voice/                  Whisper transcription + ElevenLabs TTS
      email/                  Gmail messages/draft/follow-up
      automations/            List/seed/manually-run automations
      cron/run/                Vercel Cron entry point (CRON_SECRET-gated)
      auth/google/            Gmail OAuth flow
      briefing/generate/       Manual briefing trigger
      health/                  Health check + integration status
    layout.tsx                Root layout: fonts, theme, Clerk, PostHog
    globals.css                Design tokens (ORION theme)
  components/                 ui/ (shadcn), layout/, dashboard/, chat/, voice/, email/, providers/
  config/site.ts               Nav items, app metadata
  lib/
    env.ts                     Validated env config + feature flags (the load-bearing file)
    ai/                        Anthropic client, system prompt, embeddings, email drafting
    agents/                    5 agent personas + tool definitions (registry.ts, tools.ts)
    memory/                    pgvector save/search (store.ts)
    automations/               Action implementations + cron engine
    google/                    OAuth + Gmail client
    browser/                   Playwright runner
    security/                  Encryption, rate limiting, RBAC, audit log
    supabase/                  server/service/browser clients + types
electron/                      main.js, preload.js — desktop shell
supabase/migrations/           13 SQL migrations — the full schema
```

## Design system

Dark-first, glassmorphic "command center" aesthetic (Iron Man HUD × Tesla × Linear × Arc):

- **Tokens** live in `src/app/globals.css` — `--orion-cyan`, `--orion-violet`, `--orion-success/warning/danger`, `--glass-surface`, `--glass-border`, on top of the standard shadcn `--background/--card/--primary/...` scale, all in OKLCH.
- **Utilities**: `.glass-panel` (blurred translucent surface), `.glow-border` / `.glow-text` (signal-cyan glow), `.hud-grid-bg` (faint schematic grid).
- **Theming** is architected through `next-themes` (`ThemeProvider`) so a light/dark toggle can be added later; dark is forced as the only mode for now per the product brief.
- **Typography**: Geist Sans for UI, Geist Mono for data/HUD readouts (stat tiles, timestamps, env values).

## Feature flags

`src/lib/env.ts` exports a `features` object (`auth`, `database`, `ai`, `voiceStt`, `embeddings`, `voiceTts`, `email`, `browserAutomation`, `monitoring`, `analytics`) derived from which env vars are present — checked live on `/system`. Modules read this to show real "Online / Needs setup" status instead of fabricated data, and to degrade gracefully instead of crashing when something isn't configured yet.

## AI agents

Five specialist personas (`src/lib/agents/registry.ts`) run on the same streaming chat pipeline as general chat — pick one from the selector on `/chat`. Business and Executive get a `get_business_metrics` tool; Research, Marketing, and Executive get a `browse_web` tool (Playwright, where available). The Developer Agent is **advisory-only by design** — it reviews and debugs code but has no tools that execute commands, write files, or deploy anything. The Executive Agent can also orchestrate the others directly ("Ask all agents" in the chat UI) via `/api/agents/orchestrate`: it plans which specialists are relevant, consults each in parallel, and synthesizes a single report.

## Browser automation

Playwright needs a real, long-lived browser process, which Vercel's serverless functions can't provide. `features.browserAutomation` auto-detects this (`!process.env.VERCEL`) — it's live on the Electron desktop build and any traditional Node host, and cleanly disabled with an explanatory message on Vercel. Run `npx playwright install chromium` once before using it.

## Deployment

### Web (Vercel)

1. Push to a Git repo, import into Vercel.
2. Add every env var you're enabling from `.env.example` as a Vercel project env var (Production + Preview as needed).
3. Set `CRON_SECRET` — Vercel automatically adds it as the `Authorization: Bearer` header on Cron invocations, which `/api/cron/run` requires. `vercel.json` already schedules that route every 15 minutes; adjust to your plan's cron limits.
4. In Supabase: **Authentication → Third Party Auth**, add Clerk's Frontend API URL (see `supabase/README.md`), then apply the migrations in `supabase/migrations/` in order.
5. Deploy. Visit `/system` on the deployed URL to confirm what's connected.

### Desktop (.exe)

See "Desktop app" above — `npm run electron:pack`. The automation engine runs off a local 15-minute timer in `electron/main.js` instead of Vercel Cron, using the same `CRON_SECRET` and `/api/cron/run` endpoint.

## Roadmap

All 13 phases plus desktop packaging are built and verified (`npm run build` + `npm run lint` clean after each). Every phase after Foundation needs its corresponding third-party credentials (see `.env.example`) to run live — the integration code itself is real and complete, not a stub.

1. **Foundation & architecture** ✅ — Next.js/Tailwind/shadcn scaffold, design tokens, dashboard shell, env architecture.
2. **Authentication** ✅ — Clerk middleware (`proxy.ts`), sign-in/up, session-aware routes.
3. **Database** ✅ — 13 Supabase/Postgres migrations: users, conversations, messages, memories (pgvector), tasks, agents, briefings, automations, business metrics, notifications, oauth_connections, browser_tasks, audit_log.
4. **Dashboard UI** ✅ — every module bound to real data via the schema above.
5. **AI Chat** ✅ — streaming Claude API, image attachments, tool-use loop.
6. **Long-term memory** ✅ — save/search/rank via pgvector, auto-injected into chat's system prompt.
7. **Voice assistant** ✅ — Whisper → Claude → ElevenLabs pipeline, client-side VAD, barge-in interruption.
8. **AI agent system** ✅ — Developer (advisory-only), Business, Marketing, Research, Executive, with real tool use and multi-agent orchestration.
9. **Email automation** ✅ — Gmail OAuth (encrypted token storage), categorization, urgency detection, AI-drafted replies, follow-up tasks.
10. **Automation engine** ✅ — cron-scheduled morning briefing + evening summary, manual "run now", Vercel Cron + Electron-local scheduling.
11. **Browser automation** ✅ — Playwright search/scrape, wired as an agent tool, auto-disabled on Vercel.
12. **Security & monitoring** ✅ — AES-256-GCM token encryption, rate limiting, RBAC helper, audit log, Sentry + PostHog.
13. **Deployment** ✅ — Vercel config (`vercel.json`, Sentry build integration) + Electron desktop packaging.
