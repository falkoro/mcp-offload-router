import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createMiniMaxAdapter, createSyntheticNewAdapter, createGrokAdapter } from "../src/providers.js";

const minimaxConfig = {
  apiKey: "mini-key",
  baseUrl: "https://api.minimax.test",
  model: "m3",
  rpm: 10,
  tpm: 1000,
  dailyTokens: 10000,
  cooldownSeconds: 60,
};

const syntheticConfig = {
  apiKey: "syn-key",
  baseUrl: "https://api.synthetic.test",
  model: "glm-5.2",
  rpm: 10,
  tpm: 1000,
  dailyTokens: 10000,
  cooldownSeconds: 60,
};

const grokConfig = {
  apiKey: "hermes",
  baseUrl: "http://127.0.0.1:8649/v1",
  model: "grok-4.20-0309-non-reasoning",
  rpm: 10,
  tpm: 1000,
  dailyTokens: 10000,
  cooldownSeconds: 60,
};

describe("provider adapters", () => {
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn() as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns parsed text and token usage for MiniMax", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "Hello" } }],
        usage: { total_tokens: 5 },
      }),
    } as Response);

    const adapter = createMiniMaxAdapter(minimaxConfig);
    const result = await adapter.call({
      systemPrompt: "You are helpful.",
      userPrompt: "Hi",
      maxTokens: 100,
    });

    expect(result.text).toBe("Hello");
    expect(result.tokensUsed).toBe(5);
  });

  it("returns parsed text and token usage for SyntheticNew", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "Hola" } }],
        usage: { total_tokens: 3 },
      }),
    } as Response);

    const adapter = createSyntheticNewAdapter(syntheticConfig);
    const result = await adapter.call({
      systemPrompt: "You are helpful.",
      userPrompt: "Hi",
      maxTokens: 100,
    });

    expect(result.text).toBe("Hola");
    expect(result.tokensUsed).toBe(3);
  });

  it("sends correct request to the grok Hermes proxy", async () => {
    const fetchMock = vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "ok" } }],
        usage: { total_tokens: 7 },
      }),
    } as Response);

    const adapter = createGrokAdapter(grokConfig);
    const result = await adapter.call({
      systemPrompt: "You are helpful.",
      userPrompt: "Hi",
      maxTokens: 100,
    });

    expect(result.text).toBe("ok");
    expect(result.tokensUsed).toBe(7);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8649/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer hermes",
        },
        body: JSON.stringify({
          model: "grok-4.20-0309-non-reasoning",
          messages: [
            { role: "system", content: "You are helpful." },
            { role: "user", content: "Hi" },
          ],
          max_tokens: 100,
        }),
      })
    );
  });

  it("falls back to estimated tokens when usage is missing", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "abcd" } }],
      }),
    } as Response);

    const adapter = createMiniMaxAdapter(minimaxConfig);
    const result = await adapter.call({
      systemPrompt: "",
      userPrompt: "",
      maxTokens: 100,
    });

    expect(result.tokensUsed).toBe(1);
  });

  it("throws on HTTP error", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => "Unauthorized",
    } as Response);

    const adapter = createMiniMaxAdapter(minimaxConfig);
    await expect(
      adapter.call({ systemPrompt: "", userPrompt: "", maxTokens: 100 })
    ).rejects.toThrow("Provider error (minimax): HTTP 401: Unauthorized");
  });

  it("throws providerTimeoutError on AbortError", async () => {
    const abortError = new Error("The operation was aborted");
    abortError.name = "AbortError";
    vi.mocked(fetch).mockRejectedValueOnce(abortError);

    const adapter = createMiniMaxAdapter(minimaxConfig);
    await expect(
      adapter.call({ systemPrompt: "", userPrompt: "", maxTokens: 100 })
    ).rejects.toThrow("Provider timeout: minimax");
  });

  it("sends correct request body and headers", async () => {
    const fetchMock = vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "" } }],
        usage: { total_tokens: 1 },
      }),
    } as Response);

    const adapter = createMiniMaxAdapter(minimaxConfig);
    await adapter.call({
      systemPrompt: "You are helpful.",
      userPrompt: "Hi",
      maxTokens: 100,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.minimax.test/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer mini-key",
        },
        body: JSON.stringify({
          model: "m3",
          messages: [
            { role: "system", content: "You are helpful." },
            { role: "user", content: "Hi" },
          ],
          max_tokens: 100,
        }),
        signal: expect.any(Object),
      }
    );
  });
});
