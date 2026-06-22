import { z } from "zod";
import type { Config, ProviderName } from "./config.js";
import { providerError, providerTimeoutError } from "./errors.js";

export interface ProviderRequest {
  systemPrompt: string;
  userPrompt: string;
  maxTokens: number;
}

export interface ProviderResponse {
  text: string;
  tokensUsed: number;
}

export interface ProviderAdapter {
  name: ProviderName;
  call(request: ProviderRequest): Promise<ProviderResponse>;
}

const providerResponseSchema = z.object({
  choices: z.array(
    z.object({
      message: z.object({
        content: z.string(),
      }),
    })
  ).min(1),
  usage: z
    .object({
      total_tokens: z.number().optional(),
    })
    .optional(),
});

function buildChatBody(model: string, system: string, user: string, maxTokens: number) {
  return {
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    max_tokens: maxTokens,
  };
}

function estimateTokens(text: string): number {
  // Rough heuristic: ~4 characters per token on average.
  return Math.max(1, Math.ceil(text.length / 4));
}

async function parseProviderResponse(
  provider: ProviderName,
  response: Response
): Promise<ProviderResponse> {
  if (!response.ok) {
    const text = await response.text();
    throw providerError(provider, `HTTP ${response.status}: ${text}`);
  }

  let raw: unknown;
  try {
    raw = await response.json();
  } catch (err) {
    throw providerError(provider, "Failed to parse provider response as JSON");
  }

  const parsed = providerResponseSchema.safeParse(raw);
  if (!parsed.success) {
    throw providerError(provider, `Unexpected response shape: ${parsed.error.message}`);
  }

  const text = parsed.data.choices[0]?.message?.content ?? "";
  const tokensUsed = parsed.data.usage?.total_tokens ?? estimateTokens(text);
  return { text, tokensUsed };
}

function createOpenAiStyleAdapter(
  name: ProviderName,
  config: Config["minimax"] | Config["syntheticnew"] | Config["zai"] | Config["grok"]
): ProviderAdapter {
  return {
    name,
    async call({ systemPrompt, userPrompt, maxTokens }) {
      const body = buildChatBody(config.model, systemPrompt, userPrompt, maxTokens);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30_000);

      try {
        const response = await fetch(`${config.baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${config.apiKey}`,
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        return parseProviderResponse(name, response);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          throw providerTimeoutError(name);
        }
        throw err;
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}

export function createMiniMaxAdapter(config: Config["minimax"]): ProviderAdapter {
  return createOpenAiStyleAdapter("minimax", config);
}

export function createSyntheticNewAdapter(config: Config["syntheticnew"]): ProviderAdapter {
  return createOpenAiStyleAdapter("syntheticnew", config);
}

export function createZaiAdapter(config: Config["zai"]): ProviderAdapter {
  return createOpenAiStyleAdapter("zai", config);
}

export function createGrokAdapter(config: Config["grok"]): ProviderAdapter {
  return createOpenAiStyleAdapter("grok", config);
}
