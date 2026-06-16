import { PROVIDER_NAMES } from "./config.js";
import type { ProviderName } from "./config.js";
import type { ProviderAdapter, ProviderRequest, ProviderResponse } from "./providers.js";
import type { UsageTracker } from "./tracker.js";
import { McpError } from "@modelcontextprotocol/sdk/types.js";
import { rateLimitedError, providerError, RATE_LIMITED_ERROR_CODE } from "./errors.js";

export interface Router {
  route(
    preference: ProviderName | "auto",
    request: ProviderRequest
  ): Promise<ProviderResponse>;
}

function isRateLimitError(err: unknown): boolean {
  if (err instanceof McpError && err.code === RATE_LIMITED_ERROR_CODE) {
    return true;
  }
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    return msg.includes("429") || msg.includes("rate limit");
  }
  return false;
}

function computeRetryAfter(tracker: UsageTracker, providers: ProviderName[]): number {
  return Math.max(
    ...providers.map((name) => tracker.getRetryAfter(name)),
    0
  );
}

export function createRouter(
  adapters: ProviderAdapter[],
  tracker: UsageTracker
): Router {
  const providerMap = new Map<ProviderName, ProviderAdapter>();
  for (const adapter of adapters) {
    providerMap.set(adapter.name, adapter);
  }

  return {
    async route(preference, request) {
      const providers: ProviderName[] =
        preference === "auto" ? PROVIDER_NAMES : [preference];

      let lastError: Error | undefined;

      for (const name of providers) {
        if (!tracker.isAvailable(name)) {
          continue;
        }

        const adapter = providerMap.get(name);
        if (!adapter) {
          lastError = new Error(`No adapter for provider: ${name}`);
          continue;
        }

        try {
          const response = await adapter.call(request);
          tracker.recordUsage(name, response.tokensUsed);
          return response;
        } catch (err) {
          const error = err instanceof Error ? err : new Error(String(err));
          if (isRateLimitError(error)) {
            tracker.markRateLimited(name);
          }
          lastError = error;
        }
      }

      const retryAfter = computeRetryAfter(tracker, providers);

      if (lastError && isRateLimitError(lastError)) {
        throw rateLimitedError(retryAfter);
      }

      if (lastError) {
        throw providerError("router", lastError.message);
      }

      if (preference === "auto") {
        throw rateLimitedError(retryAfter);
      }
      throw new McpError(
        RATE_LIMITED_ERROR_CODE,
        `Provider ${preference} is currently unavailable; retry after ${retryAfter} seconds`
      );
    },
  };
}
