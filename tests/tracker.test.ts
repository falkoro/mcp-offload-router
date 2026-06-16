import { describe, it, expect } from "vitest";
import { UsageTracker } from "../src/tracker.js";

describe("UsageTracker", () => {
  const limits = {
    rpm: 2,
    tpm: 100,
    dailyTokens: 1000,
    cooldownSeconds: 10,
  };

  it("allows requests when under limits", () => {
    const tracker = new UsageTracker({ minimax: limits });
    expect(tracker.isAvailable("minimax")).toBe(true);
  });

  it("blocks requests when RPM is exceeded", () => {
    const tracker = new UsageTracker({ minimax: limits });
    tracker.recordUsage("minimax", 10);
    tracker.recordUsage("minimax", 10);
    expect(tracker.isAvailable("minimax")).toBe(false);
  });

  it("blocks requests when TPM is exceeded", () => {
    const tracker = new UsageTracker({ minimax: limits });
    tracker.recordUsage("minimax", 60);
    expect(tracker.isAvailable("minimax")).toBe(true);
    tracker.recordUsage("minimax", 50);
    expect(tracker.isAvailable("minimax")).toBe(false);
  });

  it("blocks requests when daily token limit is exceeded", () => {
    const tracker = new UsageTracker({ minimax: { ...limits, dailyTokens: 90 } });
    tracker.recordUsage("minimax", 100);
    expect(tracker.isAvailable("minimax")).toBe(false);
  });

  it("blocks requests when rate-limited", () => {
    const tracker = new UsageTracker({ minimax: limits });
    tracker.markRateLimited("minimax");
    expect(tracker.isAvailable("minimax")).toBe(false);
  });

  it("returns retry-after seconds while rate-limited", () => {
    const now = Date.now();
    const tracker = new UsageTracker({ minimax: limits });
    tracker.markRateLimited("minimax", now);
    const retryAfter = tracker.getRetryAfter("minimax");
    expect(retryAfter).toBeGreaterThanOrEqual(9);
    expect(retryAfter).toBeLessThanOrEqual(10);
  });

  it("throws for unknown provider", () => {
    const tracker = new UsageTracker({ minimax: limits });
    expect(() => tracker.isAvailable("unknown")).toThrow("Unknown provider: unknown");
  });

  it("throws for negative token usage", () => {
    const tracker = new UsageTracker({ minimax: limits });
    expect(() => tracker.recordUsage("minimax", -1)).toThrow("Invalid token usage");
  });
});
