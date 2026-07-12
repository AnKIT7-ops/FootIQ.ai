import { z } from "zod";

/**
 * Centralized, validated configuration. Nothing else in the codebase reads
 * process.env directly — every secret and knob flows through here, so a typo
 * or missing variable fails fast at boot with a readable message instead of
 * surfacing as a mystery 500 at 2am.
 *
 * The same schema runs on Node (process.env) and Cloudflare Workers (the
 * `env` binding object), which is why this is a function of a plain record
 * rather than a module-level singleton bound to process.env.
 */

const boolFromString = z
  .string()
  .optional()
  .transform((v) => v === "true" || v === "1");

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(8787),

  /** Comma-separated origin allowlist for CORS. */
  CORS_ORIGINS: z.string().default("http://localhost:5173"),

  // --- Supabase (all optional: absent => demo mode, endpoints degrade gracefully)
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20).optional(),
  /** Legacy HS256 verification secret; if unset, JWKS (RS/ES256) is used. */
  SUPABASE_JWT_SECRET: z.string().min(20).optional(),

  // --- AI providers (all optional; MockProvider used when none configured)
  AI_PROVIDER: z.enum(["claude", "openai", "gemini", "ollama", "mock"]).default("mock"),
  AI_MODEL: z.string().default("claude-opus-4-8"),
  AI_MAX_TOKENS: z.coerce.number().int().min(64).max(16000).default(2048),
  ANTHROPIC_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  OLLAMA_BASE_URL: z.string().url().optional(),

  // --- Cache
  /** Upstash Redis REST endpoint (free tier) — fetch-based, Workers-safe. */
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

  // --- Security
  /** Salt for hashing IPs in logs/audit — never store raw IPs. */
  IP_HASH_SALT: z.string().default("footiq-dev-salt-change-in-prod"),
  RATE_LIMIT_DISABLED: boolFromString,

  // --- Observability
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  SENTRY_DSN: z.string().optional(),

  // --- Feature flag overrides, e.g. FLAG_PREMIUM=true (read dynamically)
});

export type Env = z.infer<typeof envSchema> & {
  /** Raw source, kept for dynamic reads (FLAG_* overrides). */
  raw: Record<string, string | undefined>;
};

export function loadEnv(source: Record<string, string | undefined>): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return { ...parsed.data, raw: source };
}

/** True when Supabase is fully configured (DB-backed mode). */
export function hasDatabase(env: Env): boolean {
  return Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
}
