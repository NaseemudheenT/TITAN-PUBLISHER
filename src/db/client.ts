import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { requireEnv } from "@/lib/env";
import * as schema from "./schema";

/**
 * Driver-agnostic database type. Production uses postgres-js; tests use PGlite
 * (in-process Postgres) through the same drizzle query API.
 */
export type Database = PgDatabase<PgQueryResultHKT, typeof schema>;
export type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];
export type DbOrTx = Database | Tx;

let instance: Database | undefined;

export function getDb(): Database {
  if (instance) return instance;
  const { DATABASE_URL } = requireEnv("DATABASE_URL");
  const client = postgres(DATABASE_URL, {
    max: process.env.VERCEL ? 3 : 10,
    // Compatible with transaction-mode poolers (Neon, Supabase, pgbouncer).
    prepare: false,
    idle_timeout: 20,
    connect_timeout: 10,
  });
  instance = drizzle(client, { schema });
  return instance;
}

export { schema };
