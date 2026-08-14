import { z } from "zod";

/**
 * Centralized, validated environment configuration.
 * Every external integration ORION depends on is declared here so
 * missing configuration fails fast and loudly at startup instead of
 * surfacing as a confusing runtime error deep in a feature module.
 *
 * All fields are optional at the schema level because each phase of
 * ORION is wired in incrementally — a feature module should check
 * `env.FEATURE_KEY` itself and degrade/explain rather than this file
 * throwing for integrations that simply haven't been provisioned yet.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),

  // Auth — Clerk (Phase 2)
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().optional(),
  CLERK_SECRET_KEY: z.string().optional(),

  // Database — Supabase / Postgres (Phase 3)
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  DATABASE_URL: z.string().optional(),

  // AI — Claude (Phase 5)
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default("claude-sonnet-5"),

  // Voice — Whisper (STT) + ElevenLabs (TTS) (Phase 7)
  OPENAI_API_KEY: z.string().optional(),
  WHISPER_MODEL: z.string().default("whisper-1"),
  ELEVENLABS_API_KEY: z.string().optional(),
  // Defaults to ElevenLabs' public "Rachel" premade voice so TTS works
  // the moment ELEVENLABS_API_KEY is set, with no extra lookup required.
  ELEVENLABS_VOICE_ID: z.string().default("21m00Tcm4TlvDq8ikWAM"),
  ELEVENLABS_MODEL: z.string().default("eleven_turbo_v2_5"),

  // Email — Gmail (Phase 9)
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().default("http://localhost:3000/api/auth/google/callback"),

  // Browser automation (Phase 11)
  PLAYWRIGHT_HEADLESS: z
    .string()
    .optional()
    .transform((v) => v !== "false"),
  // Set automatically by Vercel — used to disable Playwright there, since
  // serverless functions can't host a real browser process.
  VERCEL: z.string().optional(),

  // Monitoring (Phase 12)
  NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),
  SENTRY_AUTH_TOKEN: z.string().optional(),
  SENTRY_ORG: z.string().optional(),
  SENTRY_PROJECT: z.string().optional(),
  NEXT_PUBLIC_POSTHOG_KEY: z.string().optional(),
  NEXT_PUBLIC_POSTHOG_HOST: z.string().default("https://us.i.posthog.com"),

  // Security
  ENCRYPTION_SECRET: z.string().optional(),
  CRON_SECRET: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors);
    throw new Error("Invalid environment configuration. Check .env.local against .env.example.");
  }
  return parsed.data;
}

export const env = loadEnv();

/** Feature availability flags, derived from which integrations are configured. */
export const features = {
  auth: Boolean(env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && env.CLERK_SECRET_KEY),
  database: Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  ai: Boolean(env.ANTHROPIC_API_KEY),
  voiceStt: Boolean(env.OPENAI_API_KEY),
  embeddings: Boolean(env.OPENAI_API_KEY),
  voiceTts: Boolean(env.ELEVENLABS_API_KEY),
  email: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
  // Playwright needs a real, long-lived browser process — available on
  // the Electron desktop build and any traditional Node host, not on
  // Vercel's serverless functions.
  browserAutomation: !env.VERCEL,
  monitoring: Boolean(env.NEXT_PUBLIC_SENTRY_DSN),
  analytics: Boolean(env.NEXT_PUBLIC_POSTHOG_KEY),
} as const;
