import { desc, sql } from "drizzle-orm";
import type { Database } from "@/db/client";
import { workerHeartbeats } from "@/db/schema";
import { allFeatureStatuses, type EnvSource, type FeatureStatus } from "./env";

export type HealthStatus = "ok" | "degraded" | "down";

export interface HealthReport {
  status: HealthStatus;
  time: string;
  revision: string | null;
  database: { configured: boolean; reachable: boolean | null };
  worker: { lastBeatAt: string | null; stale: boolean | null };
  features: FeatureStatus[];
}

/** Without a heartbeat inside this window the worker is considered stale. */
export const WORKER_STALE_MS = 2 * 60 * 1000;

const CRITICAL = new Set(["database", "encryption"]);

/**
 * Builds a health report. Reports configuration by variable *name* only and never
 * includes connection strings, tokens or error bodies.
 */
export async function getHealth(
  db: Database | null,
  now: Date = new Date(),
  env: EnvSource = process.env,
): Promise<HealthReport> {
  const features = allFeatureStatuses(env);
  const databaseConfigured = Boolean(env.DATABASE_URL) && db !== null;

  let reachable: boolean | null = null;
  let lastBeatAt: Date | null = null;

  if (db) {
    try {
      await db.execute(sql`select 1`);
      reachable = true;
      const [beat] = await db
        .select({ at: workerHeartbeats.lastBeatAt })
        .from(workerHeartbeats)
        .orderBy(desc(workerHeartbeats.lastBeatAt))
        .limit(1);
      lastBeatAt = beat?.at ?? null;
    } catch {
      reachable = false;
    }
  }

  const stale = reachable
    ? lastBeatAt === null || now.getTime() - lastBeatAt.getTime() > WORKER_STALE_MS
    : null;

  const criticalMissing = features.some((f) => CRITICAL.has(f.feature) && !f.configured);
  let status: HealthStatus = "ok";
  if (criticalMissing || reachable === false || !databaseConfigured) status = "down";
  else if (stale || features.some((f) => !f.configured && (f.feature === "storage" || f.feature === "ai"))) {
    status = "degraded";
  }

  return {
    status,
    time: now.toISOString(),
    revision: env.VERCEL_GIT_COMMIT_SHA ?? null,
    database: { configured: databaseConfigured, reachable },
    worker: { lastBeatAt: lastBeatAt?.toISOString() ?? null, stale },
    features,
  };
}
