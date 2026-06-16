import { describe, it, expect, vi } from "vitest";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { createMcpServer } from "../src/server.js";
import type { Router } from "../src/router.js";

describe("createMcpServer", () => {
  it("returns an MCP Server instance", () => {
    const router: Router = { route: vi.fn() };
    const server = createMcpServer("auto", router);
    expect(server).toBeInstanceOf(Server);
  });
});
