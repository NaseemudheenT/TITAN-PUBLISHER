/**
 * Applies versioned SQL migrations from ./drizzle to DATABASE_URL.
 * Usage: DATABASE_URL=... pnpm db:migrate
 * Safe to run repeatedly; already-applied migrations are skipped.
 */
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set. Nothing was migrated.");
    process.exit(1);
  }
  // A single connection is required for migrations.
  const client = postgres(url, { max: 1, prepare: false, connect_timeout: 15 });
  try {
    await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
    console.log("Migrations applied.");
  } finally {
    await client.end({ timeout: 5 });
  }
}

main().catch((err: unknown) => {
  // Print the message only; connection errors can embed the URL in some drivers.
  console.error("Migration failed:", err instanceof Error ? err.message : "unknown error");
  process.exit(1);
});
