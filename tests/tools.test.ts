import { describe, it, expect, vi } from "vitest";
import { createToolHandlers, TOOL_DEFINITIONS, toolArgsSchema } from "../src/tools.js";
import type { Router } from "../src/router.js";

describe("tools", () => {
  function createFakeRouter(text: string): Router {
    return {
      route: vi.fn().mockResolvedValue({ text, tokensUsed: 1 }),
    };
  }

  it("has six tool definitions", () => {
    expect(TOOL_DEFINITIONS).toHaveLength(6);
    const names = TOOL_DEFINITIONS.map((t) => t.name);
    expect(names).toContain("summarize");
    expect(names).toContain("generate_code");
  });

  it("validates tool args with zod", () => {
    expect(() => toolArgsSchema.parse({ prompt: "hi" })).not.toThrow();
    expect(() => toolArgsSchema.parse({})).toThrow();
    expect(() => toolArgsSchema.parse({ prompt: "", max_tokens: -1 })).toThrow();
  });

  it("summarize tool calls router with system prompt", async () => {
    const router = createFakeRouter("summary");
    const handlers = createToolHandlers(router);
    const result = await handlers.summarize({ prompt: "Long text" });

    expect(result.content[0].text).toBe("summary");
    expect(router.route).toHaveBeenCalledWith("auto", {
      systemPrompt: "Summarize the user prompt concisely. Keep the key points.",
      userPrompt: "Long text",
      maxTokens: 2048,
    });
  });

  it("prepends context to prompt", async () => {
    const router = createFakeRouter("answer");
    const handlers = createToolHandlers(router);
    await handlers.rag_lookup({ prompt: "What?", context: "The sky is blue." });

    expect(router.route).toHaveBeenCalledWith(
      "auto",
      expect.objectContaining({
        userPrompt: "The sky is blue.\n\nWhat?",
      })
    );
  });

  it("uses default provider from config", async () => {
    const router = createFakeRouter("ok");
    const handlers = createToolHandlers(router, "minimax");
    await handlers.rewrite({ prompt: "Make it shorter" });

    expect(router.route).toHaveBeenCalledWith("minimax", expect.anything());
  });

  it("throws McpError for invalid args", async () => {
    const router = createFakeRouter("");
    const handlers = createToolHandlers(router);
    await expect(handlers.summarize({} as unknown)).rejects.toThrow("Invalid arguments for summarize");
  });
});
