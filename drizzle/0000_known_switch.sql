CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"action" text NOT NULL,
	"entity_type" text,
	"entity_id" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "connected_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"platform" text NOT NULL,
	"external_account_id" text NOT NULL,
	"display_name" text NOT NULL,
	"account_type" text,
	"status" text DEFAULT 'active' NOT NULL,
	"scopes" text[] DEFAULT '{}'::text[] NOT NULL,
	"access_token_enc" text,
	"refresh_token_enc" text,
	"token_expires_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_checked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "connected_accounts_status_ck" CHECK (status in ('active', 'expired', 'revoked', 'requires_reauth'))
);
--> statement-breakpoint
CREATE TABLE "content_packages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"analysis_id" uuid,
	"campaign_id" uuid,
	"objective" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"package_id" uuid NOT NULL,
	"platform" text NOT NULL,
	"format" text NOT NULL,
	"version" integer NOT NULL,
	"fields" jsonb NOT NULL,
	"source" text NOT NULL,
	"approved" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"filename" text NOT NULL,
	"storage_provider" text NOT NULL,
	"storage_key" text NOT NULL,
	"mime_type" text,
	"size_bytes" bigint,
	"duration_ms" integer,
	"width" integer,
	"height" integer,
	"container" text,
	"video_codec" text,
	"audio_codec" text,
	"has_audio" boolean,
	"checksum_sha256" text,
	"status" text DEFAULT 'uploading' NOT NULL,
	"error_code" text,
	"frames" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "media_assets_status_ck" CHECK (status in ('uploading', 'uploaded', 'processing', 'ready', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oauth_states" (
	"state_hash" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"platform" text NOT NULL,
	"code_verifier_enc" text,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_capabilities" (
	"platform" text NOT NULL,
	"capability" text NOT NULL,
	"status" text DEFAULT 'unknown' NOT NULL,
	"notes" text,
	"source_url" text,
	"verified_at" timestamp with time zone,
	CONSTRAINT "platform_capabilities_platform_capability_pk" PRIMARY KEY("platform","capability"),
	CONSTRAINT "platform_capabilities_status_ck" CHECK (status in ('supported', 'unsupported', 'conditional', 'unknown'))
);
--> statement-breakpoint
CREATE TABLE "published_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"job_id" uuid,
	"platform" text NOT NULL,
	"external_post_id" text NOT NULL,
	"url" text,
	"verification" text NOT NULL,
	"verified_at" timestamp with time zone,
	"published_at" timestamp with time zone NOT NULL,
	"title_snapshot" text,
	"asset_filename_snapshot" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "publishing_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"attempt_no" integer NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"outcome" text,
	"error_class" text,
	"error_code" text,
	"detail" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "publishing_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"asset_id" uuid,
	"campaign_id" uuid,
	"connected_account_id" uuid,
	"platform" text NOT NULL,
	"format" text NOT NULL,
	"content_revision_id" uuid,
	"content_version" integer NOT NULL,
	"content_snapshot" jsonb NOT NULL,
	"mode" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"progress" integer,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 5 NOT NULL,
	"next_attempt_at" timestamp with time zone,
	"scheduled_for" timestamp with time zone,
	"lease_owner" text,
	"lease_expires_at" timestamp with time zone,
	"provider_request_id" text,
	"provider_post_id" text,
	"post_url" text,
	"error_class" text,
	"error_code" text,
	"error_message" text,
	"idempotency_key" text NOT NULL,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "publishing_jobs_status_ck" CHECK (status in ('draft', 'validated', 'queued', 'scheduled', 'uploading', 'processing', 'published', 'failed', 'cancelled', 'requires_action', 'unknown')),
	CONSTRAINT "publishing_jobs_progress_ck" CHECK (progress is null or (progress >= 0 and progress <= 100))
);
--> statement-breakpoint
CREATE TABLE "rate_limit_buckets" (
	"key" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "rate_limit_buckets_key_window_start_pk" PRIMARY KEY("key","window_start")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usage_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"provider" text,
	"model" text,
	"quantity" bigint NOT NULL,
	"cost_micros" bigint,
	"ref_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"password_hash" text NOT NULL,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "video_analyses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"provider" text,
	"model" text,
	"observed" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"interpreted" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"completed_steps" text[] DEFAULT '{}'::text[] NOT NULL,
	"error_code" text,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "video_analyses_status_ck" CHECK (status in ('pending', 'running', 'completed', 'partial', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "worker_heartbeats" (
	"worker_id" text PRIMARY KEY NOT NULL,
	"last_beat_at" timestamp with time zone DEFAULT now() NOT NULL,
	"info" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connected_accounts" ADD CONSTRAINT "connected_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_packages" ADD CONSTRAINT "content_packages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_packages" ADD CONSTRAINT "content_packages_asset_id_media_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."media_assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_packages" ADD CONSTRAINT "content_packages_analysis_id_video_analyses_id_fk" FOREIGN KEY ("analysis_id") REFERENCES "public"."video_analyses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_packages" ADD CONSTRAINT "content_packages_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_revisions" ADD CONSTRAINT "content_revisions_package_id_content_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."content_packages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_states" ADD CONSTRAINT "oauth_states_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "published_posts" ADD CONSTRAINT "published_posts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "published_posts" ADD CONSTRAINT "published_posts_job_id_publishing_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."publishing_jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publishing_attempts" ADD CONSTRAINT "publishing_attempts_job_id_publishing_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."publishing_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publishing_jobs" ADD CONSTRAINT "publishing_jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publishing_jobs" ADD CONSTRAINT "publishing_jobs_asset_id_media_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."media_assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publishing_jobs" ADD CONSTRAINT "publishing_jobs_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publishing_jobs" ADD CONSTRAINT "publishing_jobs_connected_account_id_connected_accounts_id_fk" FOREIGN KEY ("connected_account_id") REFERENCES "public"."connected_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publishing_jobs" ADD CONSTRAINT "publishing_jobs_content_revision_id_content_revisions_id_fk" FOREIGN KEY ("content_revision_id") REFERENCES "public"."content_revisions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_records" ADD CONSTRAINT "usage_records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_analyses" ADD CONSTRAINT "video_analyses_asset_id_media_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."media_assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_analyses" ADD CONSTRAINT "video_analyses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_events_user_idx" ON "audit_events" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "campaigns_user_idx" ON "campaigns" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "connected_accounts_user_platform_ext_uq" ON "connected_accounts" USING btree ("user_id","platform","external_account_id");--> statement-breakpoint
CREATE INDEX "connected_accounts_user_idx" ON "connected_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "content_packages_user_idx" ON "content_packages" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "content_packages_asset_idx" ON "content_packages" USING btree ("asset_id");--> statement-breakpoint
CREATE UNIQUE INDEX "content_revisions_pkg_platform_version_uq" ON "content_revisions" USING btree ("package_id","platform","version");--> statement-breakpoint
CREATE INDEX "media_assets_user_created_idx" ON "media_assets" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "media_assets_storage_key_uq" ON "media_assets" USING btree ("storage_key");--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "oauth_states_expires_idx" ON "oauth_states" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "published_posts_job_uq" ON "published_posts" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "published_posts_user_idx" ON "published_posts" USING btree ("user_id","published_at");--> statement-breakpoint
CREATE UNIQUE INDEX "publishing_attempts_job_no_uq" ON "publishing_attempts" USING btree ("job_id","attempt_no");--> statement-breakpoint
CREATE UNIQUE INDEX "publishing_jobs_idempotency_uq" ON "publishing_jobs" USING btree ("user_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "publishing_jobs_runnable_idx" ON "publishing_jobs" USING btree ("status","next_attempt_at");--> statement-breakpoint
CREATE INDEX "publishing_jobs_scheduled_idx" ON "publishing_jobs" USING btree ("status","scheduled_for");--> statement-breakpoint
CREATE INDEX "publishing_jobs_user_created_idx" ON "publishing_jobs" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "publishing_jobs_asset_idx" ON "publishing_jobs" USING btree ("asset_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_hash_uq" ON "sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "usage_records_user_idx" ON "usage_records" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_lower_uq" ON "users" USING btree (lower("email"));--> statement-breakpoint
CREATE UNIQUE INDEX "video_analyses_asset_version_uq" ON "video_analyses" USING btree ("asset_id","version");--> statement-breakpoint
CREATE INDEX "video_analyses_user_idx" ON "video_analyses" USING btree ("user_id");