import { afterEach, describe, expect, it } from "vitest";
import { ConfigError, allFeatureStatuses, featureStatus, getEnv, requireEnv, resetEnvCache } from "@/lib/env";

describe("environment handling", () => {
  const original = { ...process.env };
  afterEach(() => {
    process.env = { ...original };
    resetEnvCache();
  });

  it("reports missing variables by name only", () => {
    const status = featureStatus("youtube", { GOOGLE_CLIENT_ID: "super-secret-id" });
    expect(status.configured).toBe(false);
    expect(status.missing).toEqual(["GOOGLE_CLIENT_SECRET", "APP_URL"]);
    expect(JSON.stringify(status)).not.toContain("super-secret-id");
  });

  it("marks a feature configured when every variable is present", () => {
    expect(featureStatus("database", { DATABASE_URL: "postgres://x" }).configured).toBe(true);
  });

  it("covers every feature in the overall status list", () => {
    const names = allFeatureStatuses({}).map((s) => s.feature);
    expect(names).toEqual(
      expect.arrayContaining(["database", "encryption", "storage", "ai", "youtube", "meta", "cron"]),
    );
  });

  it("throws a ConfigError naming the missing variable when it is required", () => {
    delete process.env.DATABASE_URL;
    resetEnvCache();
    try {
      requireEnv("DATABASE_URL");
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(ConfigError);
      expect((err as ConfigError).missing).toEqual(["DATABASE_URL"]);
    }
  });

  it("rejects malformed values without echoing them", () => {
    try {
      getEnv({ APP_URL: "not-a-url-with-secret" });
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(ConfigError);
      expect((err as Error).message).not.toContain("not-a-url-with-secret");
    }
  });
});
