/**
 * Shared domain constants and the publishing-job state machine.
 * Pure module: no I/O, safe to import from server, worker and tests.
 */

export const PLATFORMS = [
  "youtube",
  "instagram",
  "facebook",
  "tiktok",
  "vimeo",
  "snapchat",
  "linkedin",
  "google_business",
  "pinterest",
  "threads",
  "x",
  "bluesky",
  "mastodon",
  "substack",
  "whatsapp",
  "manual_export",
] as const;
export type PlatformId = (typeof PLATFORMS)[number];

/** Content formats. YouTube Shorts is a format on the YouTube platform, not a separate API. */
export const CONTENT_FORMATS = ["video", "short", "reel"] as const;
export type ContentFormat = (typeof CONTENT_FORMATS)[number];

export const JOB_STATUSES = [
  "draft",
  "validated",
  "queued",
  "scheduled",
  "uploading",
  "processing",
  "published",
  "failed",
  "cancelled",
  "requires_action",
  "unknown",
] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const TERMINAL_JOB_STATUSES: readonly JobStatus[] = ["published", "cancelled"];

export const PUBLISH_MODES = ["now", "scheduled", "export"] as const;
export type PublishMode = (typeof PUBLISH_MODES)[number];

export const ERROR_CLASSES = [
  "transient",
  "rate_limited",
  "auth",
  "permanent",
  "validation",
  "ambiguous",
] as const;
export type ErrorClass = (typeof ERROR_CLASSES)[number];

export const ACCOUNT_STATUSES = ["active", "expired", "revoked", "requires_reauth"] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export const ASSET_STATUSES = ["uploading", "uploaded", "processing", "ready", "failed"] as const;
export type AssetStatus = (typeof ASSET_STATUSES)[number];

export const ANALYSIS_STATUSES = ["pending", "running", "completed", "partial", "failed"] as const;
export type AnalysisStatus = (typeof ANALYSIS_STATUSES)[number];

export const CAPABILITY_STATUSES = ["supported", "unsupported", "conditional", "unknown"] as const;
export type CapabilityStatus = (typeof CAPABILITY_STATUSES)[number];

/**
 * Allowed transitions. Platforms have different lifecycles, so `processing` and
 * `unknown` are reachable from `uploading`, and `unknown` can resolve either way
 * once reconciliation has asked the platform what actually happened.
 */
const TRANSITIONS: Record<JobStatus, readonly JobStatus[]> = {
  draft: ["validated", "cancelled"],
  validated: ["queued", "scheduled", "requires_action", "failed", "cancelled"],
  queued: ["uploading", "scheduled", "requires_action", "failed", "cancelled"],
  scheduled: ["queued", "requires_action", "cancelled", "failed"],
  uploading: ["processing", "published", "queued", "failed", "requires_action", "unknown", "cancelled"],
  processing: ["published", "queued", "failed", "requires_action", "unknown"],
  unknown: ["published", "queued", "failed", "requires_action"],
  failed: ["queued", "cancelled"],
  requires_action: ["queued", "failed", "cancelled"],
  published: [],
  cancelled: [],
};

export function canTransition(from: JobStatus, to: JobStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export class InvalidTransitionError extends Error {
  constructor(
    public readonly from: JobStatus,
    public readonly to: JobStatus,
  ) {
    super(`Invalid job transition: ${from} -> ${to}`);
    this.name = "InvalidTransitionError";
  }
}

export function assertTransition(from: JobStatus, to: JobStatus): void {
  if (!canTransition(from, to)) throw new InvalidTransitionError(from, to);
}

export function isTerminal(status: JobStatus): boolean {
  return TERMINAL_JOB_STATUSES.includes(status);
}

/** Statuses a worker may pick up. */
export const RUNNABLE_STATUSES: readonly JobStatus[] = ["queued"];

/** Statuses during which the source media must not be deleted. */
export const MEDIA_HOLDING_STATUSES: readonly JobStatus[] = [
  "validated",
  "queued",
  "scheduled",
  "uploading",
  "processing",
  "requires_action",
  "unknown",
];
