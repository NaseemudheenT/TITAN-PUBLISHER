import { z } from "zod";

/**
 * Environment access. Every variable is optional at parse time so the app can boot
 * and report exactly what is missing (health endpoint, Settings screen) instead of
 * crashing. Code that needs a value calls `requireEnv` / `requireFeature`, which
 * throw a `ConfigError` naming the variables, never their values.
 */

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.string().url().optional(),
  DATABASE_URL: z.string().min(1).optional(),
  /** 32 random bytes, base64 encoded. Used for AES-256-GCM token encryption. */
  TOKEN_ENCRYPTION_KEY: z.string().min(1).optional(),
  CRON_SECRET: z.string().min(16).optional(),

  BLOB_READ_WRITE_TOKEN: z.string().min(1).optional(),
  LOCAL_STORAGE_DIR: z.string().min(1).optional(),

  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  AI_MODEL: z.string().min(1).optional(),
  AI_PROVIDER: z.enum(["anthropic", "mock"]).optional(),

  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
  META_APP_ID: z.string().min(1).optional(),
  META_APP_SECRET: z.string().min(1).optional(),

  MAX_UPLOAD_BYTES: z.coerce.number().int().positive().optional(),
  MAX_VIDEO_SECONDS: z.coerce.number().int().positive().optional(),
  WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(16).optional(),
});

export type Env = z.infer<typeof schema>;

export class ConfigError extends Error {
  constructor(
    message: string,
    public readonly missing: string[],
  ) {
    super(message);
    this.name = "ConfigError";
  }
}

let cached: Env | undefined;

export type EnvSource = Record<string, string | undefined>;

export function getEnv(source: EnvSource = process.env): Env {
  if (source === process.env && cached) return cached;
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    const names = [...new Set(parsed.error.issues.map((i) => String(i.path[0] ?? "unknown")))];
    throw new ConfigError(`Invalid environment variables: ${names.join(", ")}`, names);
  }
  if (source === process.env) cached = parsed.data;
  return parsed.data;
}

/** Test helper: forget the memoised environment. */
export function resetEnvCache(): void {
  cached = undefined;
}

export function requireEnv<K extends keyof Env>(...keys: K[]): { [P in K]-?: NonNullable<Env[P]> } {
  const env = getEnv();
  const missing = keys.filter((k) => env[k] === undefined || env[k] === "");
  if (missing.length > 0) {
    throw new ConfigError(
      `Missing required environment variables: ${missing.join(", ")}`,
      missing as string[],
    );
  }
  return Object.fromEntries(keys.map((k) => [k, env[k]])) as { [P in K]-?: NonNullable<Env[P]> };
}

export const FEATURES = {
  database: ["DATABASE_URL"],
  encryption: ["TOKEN_ENCRYPTION_KEY"],
  storage: ["BLOB_READ_WRITE_TOKEN"],
  ai: ["ANTHROPIC_API_KEY"],
  youtube: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "APP_URL"],
  meta: ["META_APP_ID", "META_APP_SECRET", "APP_URL"],
  cron: ["CRON_SECRET"],
} as const satisfies Record<string, readonly (keyof Env)[]>;

export type FeatureName = keyof typeof FEATURES;

export interface FeatureStatus {
  feature: FeatureName;
  configured: boolean;
  missing: string[];
}

/** Names only. Never returns values. */
export function featureStatus(feature: FeatureName, source: EnvSource = process.env): FeatureStatus {
  const missing = FEATURES[feature].filter((k) => !source[k]);
  return { feature, configured: missing.length === 0, missing: [...missing] };
}

export function allFeatureStatuses(source: EnvSource = process.env): FeatureStatus[] {
  return (Object.keys(FEATURES) as FeatureName[]).map((f) => featureStatus(f, source));
}

export function requireFeature(feature: FeatureName): void {
  const status = featureStatus(feature);
  if (!status.configured) {
    throw new ConfigError(
      `Feature "${feature}" is not configured. Missing: ${status.missing.join(", ")}`,
      status.missing,
    );
  }
}

export const LIMITS = {
  maxUploadBytes: () => getEnv().MAX_UPLOAD_BYTES ?? 2 * 1024 * 1024 * 1024,
  maxVideoSeconds: () => getEnv().MAX_VIDEO_SECONDS ?? 60 * 60,
  workerConcurrency: () => getEnv().WORKER_CONCURRENCY ?? 3,
};
