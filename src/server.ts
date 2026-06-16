import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import type { ProviderName } from "./config.js";
import type { Router } from "./router.js";
import { createToolHandlers, TOOL_DEFINITIONS } from "./tools.js";
import { invalidParamsError } from "./errors.js";

export function createMcpServer(
  defaultProvider: ProviderName | "auto",
  router: Router
): Server {
  const server = new Server(
    {
      name: "mcp-offload-router",
      version: "0.1.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  const handlers = createToolHandlers(router, defaultProvider);

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOL_DEFINITIONS.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const handler = handlers[name];
    if (!handler) {
      throw invalidParamsError(name, "Unknown tool");
    }
    return handler(args);
  });

  return server;
}

export async function startStdioServer(
  defaultProvider: ProviderName | "auto",
  router: Router
): Promise<() => Promise<void>> {
  const server = createMcpServer(defaultProvider, router);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  return async () => {
    await server.close();
  };
}
