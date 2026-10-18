import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import {
  ACCOUNT_STATUSES,
  ANALYSIS_STATUSES,
  ASSET_STATUSES,
  CAPABILITY_STATUSES,
  CONTENT_FORMATS,
  ERROR_CLASSES,
  JOB_STATUSES,
  PLATFORMS,
  PUBLISH_MODES,
} from "@/lib/domain";

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });
const createdAt = () => ts("created_at").defaultNow().notNull();
const inList = (column: string, values: readonly string[]) =>
  sql.raw(`${column} in (${values.map((v) => `'${v}'`).join(", ")})`);

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: text("email").notNull(),
    name: text("name"),
    passwordHash: text("password_hash").notNull(),
    timezone: text("timezone").notNull().default("UTC"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("users_email_lower_uq").on(sql`lower(${t.email})`)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** SHA-256 of the opaque cookie token. The raw token is never stored. */
    tokenHash: text("token_hash").notNull(),
    expiresAt: ts("expires_at").notNull(),
    lastSeenAt: ts("last_seen_at").defaultNow().notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("sessions_token_hash_uq").on(t.tokenHash), index("sessions_user_idx").on(t.userId)],
);

export const oauthStates = pgTable(
  "oauth_states",
  {
    /** SHA-256 of the state value sent to the provider. */
    stateHash: text("state_hash").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    platform: text("platform", { enum: PLATFORMS }).notNull(),
    /** PKCE verifier, encrypted. */
    codeVerifierEnc: text("code_verifier_enc"),
    expiresAt: ts("expires_at").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("oauth_states_expires_idx").on(t.expiresAt)],
);

export const connectedAccounts = pgTable(
  "connected_accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    platform: text("platform", { enum: PLATFORMS }).notNull(),
    externalAccountId: text("external_account_id").notNull(),
    displayName: text("display_name").notNull(),
    accountType: text("account_type"),
    status: text("status", { enum: ACCOUNT_STATUSES }).notNull().default("active"),
    scopes: text("scopes")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    /** AES-256-GCM ciphertext (see lib/crypto). Never returned to the browser. */
    accessTokenEnc: text("access_token_enc"),
    refreshTokenEnc: text("refresh_token_enc"),
    tokenExpiresAt: ts("token_expires_at"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    lastCheckedAt: ts("last_checked_at"),
    createdAt: createdAt(),
    updatedAt: ts("updated_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("connected_accounts_user_platform_ext_uq").on(t.userId, t.platform, t.externalAccountId),
    index("connected_accounts_user_idx").on(t.userId),
    check("connected_accounts_status_ck", inList("status", ACCOUNT_STATUSES)),
  ],
);

export const mediaAssets = pgTable(
  "media_assets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    filename: text("filename").notNull(),
    storageProvider: text("storage_provider", { enum: ["vercel_blob", "local"] }).notNull(),
    storageKey: text("storage_key").notNull(),
    mimeType: text("mime_type"),
    sizeBytes: bigint("size_bytes", { mode: "number" }),
    durationMs: integer("duration_ms"),
    width: integer("width"),
    height: integer("height"),
    container: text("container"),
    videoCodec: text("video_codec"),
    audioCodec: text("audio_codec"),
    hasAudio: boolean("has_audio"),
    checksumSha256: text("checksum_sha256"),
    status: text("status", { enum: ASSET_STATUSES }).notNull().default("uploading"),
    errorCode: text("error_code"),
    /** Representative frames extracted from the source: [{ atMs, storageKey }]. */
    frames: jsonb("frames").$type<{ atMs: number; storageKey: string }[]>().notNull().default([]),
    createdAt: createdAt(),
    updatedAt: ts("updated_at").defaultNow().notNull(),
    deletedAt: ts("deleted_at"),
  },
  (t) => [
    index("media_assets_user_created_idx").on(t.userId, t.createdAt),
    uniqueIndex("media_assets_storage_key_uq").on(t.storageKey),
    check("media_assets_status_ck", inList("status", ASSET_STATUSES)),
  ],
);

export const videoAnalyses = pgTable(
  "video_analyses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    assetId: uuid("asset_id")
      .notNull()
      .references(() => mediaAssets.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    version: integer("version").notNull().default(1),
    status: text("status", { enum: ANALYSIS_STATUSES }).notNull().default("pending"),
    provider: text("provider"),
    model: text("model"),
    /** Facts measured from the media: metadata, transcript segments, scene cuts. */
    observed: jsonb("observed").$type<Record<string, unknown>>().notNull().default({}),
    /** Model-generated interpretation: topic, tone, hooks, risks. Never mixed into `observed`. */
    interpreted: jsonb("interpreted").$type<Record<string, unknown>>().notNull().default({}),
    completedSteps: text("completed_steps")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    errorCode: text("error_code"),
    attemptCount: integer("attempt_count").notNull().default(0),
    createdAt: createdAt(),
    completedAt: ts("completed_at"),
  },
  (t) => [
    uniqueIndex("video_analyses_asset_version_uq").on(t.assetId, t.version),
    index("video_analyses_user_idx").on(t.userId),
    check("video_analyses_status_ck", inList("status", ANALYSIS_STATUSES)),
  ],
);

export const campaigns = pgTable(
  "campaigns",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("campaigns_user_idx").on(t.userId)],
);

export const contentPackages = pgTable(
  "content_packages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    assetId: uuid("asset_id")
      .notNull()
      .references(() => mediaAssets.id, { onDelete: "cascade" }),
    analysisId: uuid("analysis_id").references(() => videoAnalyses.id, { onDelete: "set null" }),
    campaignId: uuid("campaign_id").references(() => campaigns.id, { onDelete: "set null" }),
    objective: text("objective"),
    createdAt: createdAt(),
    updatedAt: ts("updated_at").defaultNow().notNull(),
  },
  (t) => [index("content_packages_user_idx").on(t.userId), index("content_packages_asset_idx").on(t.assetId)],
);

export const contentRevisions = pgTable(
  "content_revisions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    packageId: uuid("package_id")
      .notNull()
      .references(() => contentPackages.id, { onDelete: "cascade" }),
    platform: text("platform", { enum: PLATFORMS }).notNull(),
    format: text("format", { enum: CONTENT_FORMATS }).notNull(),
    version: integer("version").notNull(),
    /** Title, description, hashtags, cover text, etc. Validated by zod on write. */
    fields: jsonb("fields").$type<Record<string, unknown>>().notNull(),
    source: text("source", { enum: ["ai", "user"] }).notNull(),
    /** True once the user approved this exact revision. AI output never flips this. */
    approved: boolean("approved").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("content_revisions_pkg_platform_version_uq").on(t.packageId, t.platform, t.version)],
);

export const platformCapabilities = pgTable(
  "platform_capabilities",
  {
    platform: text("platform", { enum: PLATFORMS }).notNull(),
    capability: text("capability").notNull(),
    status: text("status", { enum: CAPABILITY_STATUSES }).notNull().default("unknown"),
    notes: text("notes"),
    sourceUrl: text("source_url"),
    verifiedAt: ts("verified_at"),
  },
  (t) => [
    primaryKey({ columns: [t.platform, t.capability] }),
    check("platform_capabilities_status_ck", inList("status", CAPABILITY_STATUSES)),
  ],
);

export const publishingJobs = pgTable(
  "publishing_jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Nullable so published history survives deletion of the source asset. */
    assetId: uuid("asset_id").references(() => mediaAssets.id, { onDelete: "set null" }),
    campaignId: uuid("campaign_id").references(() => campaigns.id, { onDelete: "set null" }),
    connectedAccountId: uuid("connected_account_id").references(() => connectedAccounts.id, {
      onDelete: "set null",
    }),
    platform: text("platform", { enum: PLATFORMS }).notNull(),
    format: text("format", { enum: CONTENT_FORMATS }).notNull(),
    contentRevisionId: uuid("content_revision_id").references(() => contentRevisions.id, {
      onDelete: "set null",
    }),
    contentVersion: integer("content_version").notNull(),
    /** Frozen copy of the approved content at approval time. The worker publishes this, not live edits. */
    contentSnapshot: jsonb("content_snapshot").$type<Record<string, unknown>>().notNull(),
    mode: text("mode", { enum: PUBLISH_MODES }).notNull(),
    status: text("status", { enum: JOB_STATUSES }).notNull().default("draft"),
    progress: integer("progress"),
    attemptCount: integer("attempt_count").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(5),
    nextAttemptAt: ts("next_attempt_at"),
    scheduledFor: ts("scheduled_for"),
    leaseOwner: text("lease_owner"),
    leaseExpiresAt: ts("lease_expires_at"),
    /** Resumable upload URL or provider request id, kept so a retry can reconcile instead of re-posting. */
    providerRequestId: text("provider_request_id"),
    providerPostId: text("provider_post_id"),
    postUrl: text("post_url"),
    errorClass: text("error_class", { enum: ERROR_CLASSES }),
    errorCode: text("error_code"),
    /** Safe, user-displayable message. Never contains tokens or raw provider bodies. */
    errorMessage: text("error_message"),
    idempotencyKey: text("idempotency_key").notNull(),
    approvedAt: ts("approved_at"),
    createdAt: createdAt(),
    startedAt: ts("started_at"),
    completedAt: ts("completed_at"),
    updatedAt: ts("updated_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("publishing_jobs_idempotency_uq").on(t.userId, t.idempotencyKey),
    index("publishing_jobs_runnable_idx").on(t.status, t.nextAttemptAt),
    index("publishing_jobs_scheduled_idx").on(t.status, t.scheduledFor),
    index("publishing_jobs_user_created_idx").on(t.userId, t.createdAt),
    index("publishing_jobs_asset_idx").on(t.assetId),
    check("publishing_jobs_status_ck", inList("status", JOB_STATUSES)),
    check("publishing_jobs_progress_ck", sql`progress is null or (progress >= 0 and progress <= 100)`),
  ],
);

export const publishingAttempts = pgTable(
  "publishing_attempts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => publishingJobs.id, { onDelete: "cascade" }),
    attemptNo: integer("attempt_no").notNull(),
    startedAt: ts("started_at").defaultNow().notNull(),
    finishedAt: ts("finished_at"),
    outcome: text("outcome", {
      enum: ["success", "retry", "failed", "ambiguous", "requires_action", "abandoned"],
    }),
    errorClass: text("error_class", { enum: ERROR_CLASSES }),
    errorCode: text("error_code"),
    detail: jsonb("detail").$type<Record<string, unknown>>().notNull().default({}),
  },
  (t) => [uniqueIndex("publishing_attempts_job_no_uq").on(t.jobId, t.attemptNo)],
);

export const publishedPosts = pgTable(
  "published_posts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    jobId: uuid("job_id").references(() => publishingJobs.id, { onDelete: "set null" }),
    platform: text("platform", { enum: PLATFORMS }).notNull(),
    externalPostId: text("external_post_id").notNull(),
    url: text("url"),
    /** `verified` only when the platform confirmed the final state; otherwise `accepted`. */
    verification: text("verification", { enum: ["verified", "accepted", "unverifiable"] }).notNull(),
    verifiedAt: ts("verified_at"),
    publishedAt: ts("published_at").notNull(),
    /** Snapshots so history stays readable after the source asset is deleted. */
    titleSnapshot: text("title_snapshot"),
    assetFilenameSnapshot: text("asset_filename_snapshot"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("published_posts_job_uq").on(t.jobId),
    index("published_posts_user_idx").on(t.userId, t.publishedAt),
  ],
);

export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    entityType: text("entity_type"),
    entityId: text("entity_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [index("audit_events_user_idx").on(t.userId, t.createdAt)],
);

export const usageRecords = pgTable(
  "usage_records",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind", {
      enum: ["ai_input_tokens", "ai_output_tokens", "storage_bytes", "ffmpeg_ms"],
    }).notNull(),
    provider: text("provider"),
    model: text("model"),
    quantity: bigint("quantity", { mode: "number" }).notNull(),
    /** Estimated cost in millionths of a USD, only when the provider price is known. */
    costMicros: bigint("cost_micros", { mode: "number" }),
    refId: text("ref_id"),
    createdAt: createdAt(),
  },
  (t) => [index("usage_records_user_idx").on(t.userId, t.createdAt)],
);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    readAt: ts("read_at"),
    createdAt: createdAt(),
  },
  (t) => [index("notifications_user_idx").on(t.userId, t.createdAt)],
);

/** Durable fixed-window rate limiting that works across serverless instances. */
export const rateLimitBuckets = pgTable(
  "rate_limit_buckets",
  {
    key: text("key").notNull(),
    windowStart: ts("window_start").notNull(),
    count: integer("count").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.key, t.windowStart] })],
);

/** Heartbeat so health checks can tell whether a worker is actually running. */
export const workerHeartbeats = pgTable("worker_heartbeats", {
  workerId: text("worker_id").primaryKey(),
  lastBeatAt: ts("last_beat_at").defaultNow().notNull(),
  info: jsonb("info").$type<Record<string, unknown>>().notNull().default({}),
});
