import { z } from "zod";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import type { Router } from "./router.js";
import type { ProviderName } from "./config.js";

export const toolArgsSchema = z.object({
  prompt: z.string().min(1),
  context: z.string().optional(),
  provider_preference: z.enum(["auto", "minimax", "syntheticnew", "zai", "grok"]).optional(),
  max_tokens: z.number().int().positive().optional(),
});

export type ToolArgs = z.infer<typeof toolArgsSchema>;

const DEFAULT_MAX_TOKENS = 2048;

function buildUserPrompt(args: ToolArgs): string {
  return args.context ? `${args.context}\n\n${args.prompt}` : args.prompt;
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: object;
  systemPrompt: string;
}

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: "summarize",
    description: "Summarize text using a cheap backend model.",
    inputSchema: {
      type: "object",
      properties: {
        prompt: { type: "string", description: "Text to summarize" },
        context: { type: "string", description: "Optional additional context" },
        provider_preference: { type: "string", enum: ["auto", "minimax", "syntheticnew", "zai", "grok"] },
        max_tokens: { type: "number" },
      },
      required: ["prompt"],
    },
    systemPrompt: "Summarize the user prompt concisely. Keep the key points.",
  },
  {
    name: "rewrite",
    description: "Rewrite text using a cheap backend model.",
    inputSchema: {
      type: "object",
      properties: {
        prompt: { type: "string", description: "Text and instructions" },
        context: { type: "string" },
        provider_preference: { type: "string", enum: ["auto", "minimax", "syntheticnew", "zai", "grok"] },
        max_tokens: { type: "number" },
      },
      required: ["prompt"],
    },
    systemPrompt: "Rewrite the user prompt according to the requested style or constraints. Preserve meaning.",
  },
  {
    name: "generate_code",
    description: "Generate code using a cheap backend model.",
    inputSchema: {
      type: "object",
      properties: {
        prompt: { type: "string", description: "Code generation prompt" },
        context: { type: "string" },
        provider_preference: { type: "string", enum: ["auto", "minimax", "syntheticnew", "zai", "grok"] },
        max_tokens: { type: "number" },
      },
      required: ["prompt"],
    },
    systemPrompt: "You are an expert programmer. Generate clean, working code matching the request. Output only code unless explanation is asked for.",
  },
  {
    name: "review_code",
    description: "Review code using a cheap backend model.",
    inputSchema: {
      type: "object",
      properties: {
        prompt: { type: "string", description: "Code to review" },
        context: { type: "string" },
        provider_preference: { type: "string", enum: ["auto", "minimax", "syntheticnew", "zai", "grok"] },
        max_tokens: { type: "number" },
      },
      required: ["prompt"],
    },
    systemPrompt: "You are a senior code reviewer. Review the code for bugs, style issues, and improvements. Be concise and actionable.",
  },
  {
    name: "rag_lookup",
    description: "Answer a question from provided context using a cheap backend model.",
    inputSchema: {
      type: "object",
      properties: {
        prompt: { type: "string", description: "Question" },
        context: { type: "string", description: "Context to search" },
        provider_preference: { type: "string", enum: ["auto", "minimax", "syntheticnew", "zai", "grok"] },
        max_tokens: { type: "number" },
      },
      required: ["prompt"],
    },
    systemPrompt: "Answer the question using only the provided context. If the answer is not in the context, say so.",
  },
  {
    name: "delegate_task",
    description: "Delegate a multi-step task to a cheap backend model.",
    inputSchema: {
      type: "object",
      properties: {
        prompt: { type: "string", description: "Task description" },
        context: { type: "string" },
        provider_preference: { type: "string", enum: ["auto", "minimax", "syntheticnew", "zai", "grok"] },
        max_tokens: { type: "number" },
      },
      required: ["prompt"],
    },
    systemPrompt: "You are a helpful assistant carrying out a multi-step task. Work through the task carefully and return a final answer.",
  },
];

export function createToolHandlers(router: Router, defaultProvider: ProviderName | "auto" = "auto") {
  const handlers: Record<
    string,
    (rawArgs: unknown) => Promise<{ content: Array<{ type: "text"; text: string }> }>
  > = {};

  for (const tool of TOOL_DEFINITIONS) {
    handlers[tool.name] = async (rawArgs: unknown) => {
      const parseResult = toolArgsSchema.safeParse(rawArgs);
      if (!parseResult.success) {
        const issues = parseResult.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
        throw new McpError(ErrorCode.InvalidParams, `Invalid arguments for ${tool.name}: ${issues}`);
      }
      const args = parseResult.data;
      const preference = args.provider_preference ?? defaultProvider;
      const response = await router.route(preference, {
        systemPrompt: tool.systemPrompt,
        userPrompt: buildUserPrompt(args),
        maxTokens: args.max_tokens ?? DEFAULT_MAX_TOKENS,
      });
      return { content: [{ type: "text", text: response.text }] };
    };
  }

  return handlers;
}

export type ToolHandlers = ReturnType<typeof createToolHandlers>;
