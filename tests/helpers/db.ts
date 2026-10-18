import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { Database } from "@/db/client";
import * as schema from "@/db/schema";

export interface TestDb {
  db: Database;
  close: () => Promise<void>;
}

/** Fresh in-process Postgres with every real migration applied. */
export async function createTestDb(): Promise<TestDb> {
  const client = new PGlite();
  const pg = drizzle(client, { schema });
  await migrate(pg, { migrationsFolder: "./drizzle" });
  return { db: pg as unknown as Database, close: () => client.close() };
}

let counter = 0;

export async function insertUser(db: Database, overrides: Partial<typeof schema.users.$inferInsert> = {}) {
  counter += 1;
  const [user] = await db
    .insert(schema.users)
    .values({ email: `user${counter}-${Date.now()}@example.test`, passwordHash: "x", ...overrides })
    .returning();
  if (!user) throw new Error("failed to insert test user");
  return user;
}

export async function insertAsset(
  db: Database,
  userId: string,
  overrides: Partial<typeof schema.mediaAssets.$inferInsert> = {},
) {
  counter += 1;
  const [asset] = await db
    .insert(schema.mediaAssets)
    .values({
      userId,
      filename: `clip${counter}.mp4`,
      storageProvider: "local",
      storageKey: `uploads/${userId}/${counter}-${Date.now()}.mp4`,
      status: "ready",
      ...overrides,
    })
    .returning();
  if (!asset) throw new Error("failed to insert test asset");
  return asset;
}

/** postgres-js returns an array, PGlite returns { rows }. Normalise for assertions. */
export function rowsOf<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  return ((result as { rows?: T[] }).rows ?? []) as T[];
}
