import { describe, expect, it } from "vitest";
import {
  InvalidTransitionError,
  JOB_STATUSES,
  TERMINAL_JOB_STATUSES,
  assertTransition,
  canTransition,
  isTerminal,
} from "@/lib/domain";

describe("publishing job state machine", () => {
  it("allows the happy path draft -> validated -> queued -> uploading -> processing -> published", () => {
    const path = ["draft", "validated", "queued", "uploading", "processing", "published"] as const;
    for (let i = 0; i < path.length - 1; i++) {
      expect(canTransition(path[i]!, path[i + 1]!)).toBe(true);
    }
  });

  it("lets platforms without a processing phase publish straight from uploading", () => {
    expect(canTransition("uploading", "published")).toBe(true);
  });

  it("never leaves a terminal state", () => {
    for (const terminal of TERMINAL_JOB_STATUSES) {
      for (const to of JOB_STATUSES) {
        expect(canTransition(terminal, to)).toBe(false);
      }
      expect(isTerminal(terminal)).toBe(true);
    }
  });

  it("rejects skipping validation and publishing a draft", () => {
    expect(canTransition("draft", "published")).toBe(false);
    expect(canTransition("draft", "queued")).toBe(false);
    expect(() => assertTransition("draft", "published")).toThrow(InvalidTransitionError);
  });

  it("allows failed jobs to be retried but not an unknown outcome to be forced to cancelled", () => {
    expect(canTransition("failed", "queued")).toBe(true);
    expect(canTransition("unknown", "cancelled")).toBe(false);
  });

  it("lets an ambiguous result resolve either way after reconciliation", () => {
    expect(canTransition("unknown", "published")).toBe(true);
    expect(canTransition("unknown", "queued")).toBe(true);
    expect(canTransition("unknown", "failed")).toBe(true);
  });

  it("defines an entry for every status", () => {
    for (const status of JOB_STATUSES) {
      expect(() => canTransition(status, "failed")).not.toThrow();
    }
  });
});
