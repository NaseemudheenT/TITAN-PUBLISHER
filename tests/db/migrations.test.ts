import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { schema } from "@/db/client";
import type { Database } from "@/db/client";
import { createTestDb, insertAsset, insertUser, rowsOf, type TestDb } from "../helpers/db";

describe("database migrations and constraints", () => {
  let t: TestDb;
  let db: Database;

  beforeAll(async () => {
    t = await createTestDb();
    db = t.db;
  });
  afterAll(async () => {
    await t.close();
  });

  it("creates every table in the data model", async () => {
    const result = await db.execute(
      sql`select table_name from information_schema.tables where table_schema = 'public'`,
    );
    const names = new Set(rowsOf<{ table_name: string }>(result).map((r) => r.table_name));
    for (const table of [
      "users",
      "sessions",
      "oauth_states",
      "connected_accounts",
      "media_assets",
      "video_analyses",
      "campaigns",
      "content_packages",
      "content_revisions",
      "platform_capabilities",
      "publishing_jobs",
      "publishing_attempts",
      "published_posts",
      "audit_events",
      "usage_records",
      "notifications",
      "rate_limit_buckets",
      "worker_heartbeats",
    ]) {
      expect(names.has(table), `missing table ${table}`).toBe(true);
    }
  });

  it("treats email as case-insensitively unique", async () => {
    await insertUser(db, { email: "Case@Example.test" });
    await expect(insertUser(db, { email: "case@example.test" })).rejects.toThrow();
  });

  async function newJob(userId: string, assetId: string | null, key: string, status = "draft") {
    const [job] = await db
      .insert(schema.publishingJobs)
      .values({
        userId,
        assetId,
        platform: "youtube",
        format: "short",
        contentVersion: 1,
        contentSnapshot: { title: "t" },
        mode: "now",
        status: status as "draft",
        idempotencyKey: key,
      })
      .returning();
    return job!;
  }

  it("rejects an invalid job status at the database level", async () => {
    const user = await insertUser(db);
    await expect(newJob(user.id, null, "bad-status", "exploded")).rejects.toThrow();
  });

  it("enforces one job per idempotency key per user, but not across users", async () => {
    const a = await insertUser(db);
    const b = await insertUser(db);
    await newJob(a.id, null, "same-key");
    await expect(newJob(a.id, null, "same-key")).rejects.toThrow();
    await expect(newJob(b.id, null, "same-key")).resolves.toBeDefined();
  });

  it("keeps publishing history when the source asset is deleted", async () => {
    const user = await insertUser(db);
    const asset = await insertAsset(db, user.id);
    const job = await newJob(user.id, asset.id, "history-key", "published");
    await db.delete(schema.mediaAssets).where(eq(schema.mediaAssets.id, asset.id));
    const [after] = await db.select().from(schema.publishingJobs).where(eq(schema.publishingJobs.id, job.id));
    expect(after).toBeDefined();
    expect(after!.assetId).toBeNull();
  });

  it("rejects out-of-range progress", async () => {
    const user = await insertUser(db);
    await expect(
      db.insert(schema.publishingJobs).values({
        userId: user.id,
        platform: "youtube",
        format: "video",
        contentVersion: 1,
        contentSnapshot: {},
        mode: "now",
        idempotencyKey: "progress-key",
        progress: 140,
      }),
    ).rejects.toThrow();
  });

  it("cascades user deletion to their assets and sessions", async () => {
    const user = await insertUser(db);
    await insertAsset(db, user.id);
    await db.insert(schema.sessions).values({
      userId: user.id,
      tokenHash: `hash-${user.id}`,
      expiresAt: new Date(Date.now() + 1000),
    });
    await db.delete(schema.users).where(eq(schema.users.id, user.id));
    const assets = await db.select().from(schema.mediaAssets).where(eq(schema.mediaAssets.userId, user.id));
    const sessions = await db.select().from(schema.sessions).where(eq(schema.sessions.userId, user.id));
    expect(assets).toHaveLength(0);
    expect(sessions).toHaveLength(0);
  });
});
