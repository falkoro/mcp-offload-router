import { describe, it, expect, vi } from "vitest";
import { createRouter } from "../src/router.js";
import { UsageTracker } from "../src/tracker.js";
import type { ProviderName } from "../src/config.js";
import type { ProviderAdapter, ProviderRequest, ProviderResponse } from "../src/providers.js";
import { McpError } from "@modelcontextprotocol/sdk/types.js";

function fakeAdapter(name: ProviderName, response: ProviderResponse): ProviderAdapter {
  return {
    name,
    call: vi.fn().mockResolvedValue(response),
  };
}

function failingAdapter(name: ProviderName, error: Error): ProviderAdapter {
  return {
    name,
    call: vi.fn().mockRejectedValue(error),
  };
}

const limits = {
  rpm: 10,
  tpm: 10000,
  dailyTokens: 100000,
  cooldownSeconds: 60,
};

const request: ProviderRequest = {
  systemPrompt: "sys",
  userPrompt: "user",
  maxTokens: 100,
};

describe("createRouter", () => {
  it("routes to preferred provider", async () => {
    const minimax = fakeAdapter("minimax", { text: "mini", tokensUsed: 5 });
    const tracker = new UsageTracker({ minimax: limits, syntheticnew: limits, zai: limits });
    const router = createRouter([minimax], tracker);

    const result = await router.route("minimax", request);
    expect(result.text).toBe("mini");
    expect(minimax.call).toHaveBeenCalledTimes(1);
  });

  it("records usage on successful call", async () => {
    const minimax = fakeAdapter("minimax", { text: "mini", tokensUsed: 42 });
    const tracker = new UsageTracker({ minimax: limits, syntheticnew: limits, zai: limits });
    const router = createRouter([minimax], tracker);

    await router.route("minimax", request);
    expect(tracker.isAvailable("minimax")).toBe(true);
    // After 42 tokens with rpm:10, tpm:10000, daily:100000 it should still be available.
    // Verify a second call works.
    const result = await router.route("minimax", request);
    expect(result.text).toBe("mini");
  });

  it("falls back when preferred is rate-limited", async () => {
    const minimax = fakeAdapter("minimax", { text: "mini", tokensUsed: 5 });
    const syntheticnew = fakeAdapter("syntheticnew", { text: "syn", tokensUsed: 5 });
    const tracker = new UsageTracker({ minimax: limits, syntheticnew: limits, zai: limits });
    tracker.markRateLimited("minimax");

    const router = createRouter([minimax, syntheticnew], tracker);
    const result = await router.route("auto", request);
    expect(result.text).toBe("syn");
    expect(minimax.call).not.toHaveBeenCalled();
  });

  it("throws specific error when requested provider is unavailable up-front", async () => {
    const minimax = fakeAdapter("minimax", { text: "mini", tokensUsed: 5 });
    const tracker = new UsageTracker({ minimax: limits, syntheticnew: limits, zai: limits });
    tracker.markRateLimited("minimax");

    const router = createRouter([minimax], tracker);
    await expect(router.route("minimax", request)).rejects.toThrow(
      "Provider minimax is currently unavailable"
    );
  });

  it("throws rate-limited error when explicit provider call is rate-limited", async () => {
    const minimax = failingAdapter("minimax", new McpError(-32002, "rate limited"));
    const tracker = new UsageTracker({ minimax: limits, syntheticnew: limits, zai: limits });

    const router = createRouter([minimax], tracker);
    await expect(router.route("minimax", request)).rejects.toThrow(
      "All providers rate-limited"
    );
  });

  it("throws rate-limited error when all auto providers are rate-limited", async () => {
    const minimax = failingAdapter("minimax", new Error("Provider error (minimax): HTTP 429: too many requests"));
    const syntheticnew = failingAdapter("syntheticnew", new McpError(-32002, "rate limited"));
    const zai = failingAdapter("zai", new McpError(-32002, "rate limited"));
    const tracker = new UsageTracker({ minimax: limits, syntheticnew: limits, zai: limits });

    const router = createRouter([minimax, syntheticnew, zai], tracker);
    await expect(router.route("auto", request)).rejects.toThrow(
      "All providers rate-limited"
    );
  });

  it("does not mark provider rate-limited on non-rate-limit errors", async () => {
    const minimax = failingAdapter("minimax", new Error("network error"));
    const syntheticnew = fakeAdapter("syntheticnew", { text: "syn", tokensUsed: 5 });
    const tracker = new UsageTracker({ minimax: limits, syntheticnew: limits, zai: limits });

    const router = createRouter([minimax, syntheticnew], tracker);
    const result = await router.route("auto", request);
    expect(result.text).toBe("syn");
    expect(tracker.isAvailable("minimax")).toBe(true);
  });

  it("throws when all providers fail with non-rate-limit errors", async () => {
    const minimax = failingAdapter("minimax", new Error("mini failed"));
    const syntheticnew = failingAdapter("syntheticnew", new Error("syn failed"));
    const zai = failingAdapter("zai", new Error("zai failed"));
    const tracker = new UsageTracker({ minimax: limits, syntheticnew: limits, zai: limits });

    const router = createRouter([minimax, syntheticnew, zai], tracker);
    await expect(router.route("auto", request)).rejects.toThrow("Provider error (router)");
  });
});
